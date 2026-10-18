import { isKnownItem } from './blocks';
import { HOTBAR_SIZE, INVENTORY_SIZE, type Inventory, type Slot } from './inventory';
import { createPlayer, MAX_HEALTH, type Player } from './player';
import type { GameState } from './game';
import { createEmptyWorld, refreshSky } from './world';

/**
 * Save format. Bump SAVE_VERSION when the shape changes and add a step to `migrateMeta`.
 * v1: meta JSON + one blob holding run-length encoded fg then bg tiles.
 */
export const SAVE_VERSION = 1;

export type SaveMeta = {
  version: number;
  seed: number;
  width: number;
  height: number;
  time: number;
  spawn: { x: number; y: number };
  player: { x: number; y: number; health: number; facing: 1 | -1 };
  inventory: { selected: number; slots: ([number, number] | null)[] };
};

export type SavedGame = { meta: string; tiles: Uint8Array };

/** Run-length encoding as (count, value) byte pairs, count 1-255. */
export function rleEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const value = data[i];
    let run = 1;
    while (i + run < data.length && data[i + run] === value && run < 255) run++;
    out.push(run, value);
    i += run;
  }
  return Uint8Array.from(out);
}

export function rleDecode(data: Uint8Array, expectedLength: number, offset = 0): { bytes: Uint8Array; next: number } {
  const bytes = new Uint8Array(expectedLength);
  let o = 0;
  let i = offset;
  while (o < expectedLength) {
    if (i + 1 >= data.length) throw new Error('Save data is truncated');
    const run = data[i];
    const value = data[i + 1];
    if (run === 0 || o + run > expectedLength) throw new Error('Save data is corrupt');
    bytes.fill(value, o, o + run);
    o += run;
    i += 2;
  }
  return { bytes, next: i };
}

export function serializeGame(state: GameState): SavedGame {
  const { world, player, inventory } = state;
  const meta: SaveMeta = {
    version: SAVE_VERSION,
    seed: state.seed,
    width: world.width,
    height: world.height,
    time: Math.round(state.time * 100) / 100,
    spawn: { ...state.spawn },
    player: { x: player.x, y: player.y, health: player.health, facing: player.facing },
    inventory: {
      selected: inventory.selected,
      slots: inventory.slots.map((s) => (s ? [s.item, s.count] : null)),
    },
  };
  const fg = rleEncode(world.fg);
  const bg = rleEncode(world.bg);
  const tiles = new Uint8Array(fg.length + bg.length);
  tiles.set(fg, 0);
  tiles.set(bg, fg.length);
  return { meta: JSON.stringify(meta), tiles };
}

/** Upgrades older meta to the current version. Throws for saves from a newer app. */
export function migrateMeta(raw: unknown): SaveMeta {
  if (!raw || typeof raw !== 'object') throw new Error('Save metadata is missing');
  const meta = raw as Partial<SaveMeta>;
  const version = typeof meta.version === 'number' ? meta.version : 0;
  if (version > SAVE_VERSION) throw new Error('This world was saved by a newer version of Blockhaven');
  if (version < 1) throw new Error('Unsupported save version');
  return meta as SaveMeta;
}

export function deserializeGame(saved: SavedGame): GameState {
  const meta = migrateMeta(JSON.parse(saved.meta));
  const size = meta.width * meta.height;
  const world = createEmptyWorld(meta.width, meta.height);
  const fg = rleDecode(saved.tiles, size, 0);
  const bg = rleDecode(saved.tiles, size, fg.next);
  world.fg.set(fg.bytes);
  world.bg.set(bg.bytes);
  refreshSky(world);

  const player: Player = createPlayer(meta.player.x, meta.player.y);
  player.health = Math.max(1, Math.min(MAX_HEALTH, Math.round(meta.player.health)));
  player.facing = meta.player.facing === -1 ? -1 : 1;

  const slots: Slot[] = Array.from({ length: INVENTORY_SIZE }, (_, i) => {
    const entry = meta.inventory.slots[i];
    if (!entry || !isKnownItem(entry[0]) || entry[1] <= 0) return null;
    return { item: entry[0], count: entry[1] };
  });
  const inventory: Inventory = {
    slots,
    selected: Math.max(0, Math.min(HOTBAR_SIZE - 1, meta.inventory.selected | 0)),
  };

  return {
    world,
    player,
    inventory,
    seed: meta.seed,
    time: meta.time,
    spawn: { ...meta.spawn },
    mining: null,
    dead: false,
    hudVersion: 0,
    worldVersion: 0,
  };
}
