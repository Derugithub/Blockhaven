import { isKnownItem } from './blocks';
import { HOTBAR_SIZE, INVENTORY_SIZE, type Inventory, type Slot } from './inventory';
import { createPlayer, MAX_HEALTH, type Player } from './player';
import type { GameState } from './game';
import { createStats, findQuest, type Stats } from './quests';
import { isDifficulty, MAX_HUNGER, type Difficulty } from './survival';
import { addBerryBushes, addCrystals } from './terrain';
import { createEmptyWorld, refreshSky } from './world';

/**
 * Save format. Bump SAVE_VERSION when the shape changes and add a step to `migrateMeta`.
 * v1: meta JSON + one blob holding run-length encoded fg then bg tiles.
 * v2: adds difficulty, hunger, quest progress, stats and the win flag. v1 worlds also get crystals
 *     and berry bushes added to their tiles when they are loaded (see `upgradeTiles`).
 */
export const SAVE_VERSION = 2;

/** Meta as written by v1 builds. */
export type SaveMetaV1 = {
  version: number;
  seed: number;
  width: number;
  height: number;
  time: number;
  spawn: { x: number; y: number };
  player: { x: number; y: number; health: number; facing: 1 | -1 };
  inventory: { selected: number; slots: ([number, number] | null)[] };
};

export type SaveMeta = Omit<SaveMetaV1, 'version'> & {
  version: number;
  difficulty: Difficulty;
  hunger: number;
  quests: string[];
  stats: Stats;
  won: boolean;
  /** Version the tiles were generated with; below 2 means crystals and bushes still need adding. */
  tilesVersion: number;
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
    difficulty: state.difficulty,
    hunger: Math.round(state.survival.hunger * 100) / 100,
    quests: [...state.quests],
    stats: state.stats,
    won: state.won,
    tilesVersion: SAVE_VERSION,
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
  let current = { ...(meta as Record<string, unknown>) };
  if (version < 2) current = migrateV1toV2(current);
  return sanitizeV2(current);
}

/** v1 → v2: survival, quests and stats did not exist, so start them fresh on Normal difficulty. */
function migrateV1toV2(meta: Record<string, unknown>): Record<string, unknown> {
  return {
    ...meta,
    version: 2,
    difficulty: 'normal',
    hunger: MAX_HUNGER,
    quests: [],
    stats: createStats(),
    won: false,
    tilesVersion: 1,
  };
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numberRecord(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[key] = Math.floor(v);
  }
  return out;
}

/** Fills in anything missing or malformed so a damaged v2 save still loads. */
function sanitizeV2(meta: Record<string, unknown>): SaveMeta {
  const raw = (meta.stats ?? {}) as Partial<Stats>;
  const stats: Stats = {
    ...createStats(),
    collected: numberRecord(raw.collected),
    mined: numberRecord(raw.mined),
    crafted: numberRecord(raw.crafted),
    placed: numberRecord(raw.placed),
    maxDepth: Math.max(0, finite(raw.maxDepth, 0)),
    nightsSurvived: Math.max(0, finite(raw.nightsSurvived, 0)),
    monstersDefeated: Math.max(0, finite(raw.monstersDefeated, 0)),
    foodEaten: Math.max(0, finite(raw.foodEaten, 0)),
    sawNight: raw.sawNight === true,
  };
  const quests = Array.isArray(meta.quests)
    ? (meta.quests as unknown[]).filter((id): id is string => typeof id === 'string' && !!findQuest(id))
    : [];
  return {
    ...(meta as unknown as SaveMetaV1),
    version: SAVE_VERSION,
    difficulty: isDifficulty(meta.difficulty) ? meta.difficulty : 'normal',
    hunger: Math.max(0, Math.min(MAX_HUNGER, finite(meta.hunger, MAX_HUNGER))),
    quests: [...new Set(quests)],
    stats,
    won: meta.won === true,
    tilesVersion: finite(meta.tilesVersion, SAVE_VERSION),
  };
}

export function deserializeGame(saved: SavedGame): GameState {
  const meta = migrateMeta(JSON.parse(saved.meta));
  const size = meta.width * meta.height;
  const world = createEmptyWorld(meta.width, meta.height);
  const fg = rleDecode(saved.tiles, size, 0);
  const bg = rleDecode(saved.tiles, size, fg.next);
  world.fg.set(fg.bytes);
  world.bg.set(bg.bytes);
  if (meta.tilesVersion < 2) {
    // Worlds from v1 had no crystals or berry bushes. Both only replace untouched stone and open grass,
    // so anything the player built stays as it was.
    addCrystals(world, meta.seed);
    addBerryBushes(world, meta.seed, meta.spawn.x);
  }
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
    difficulty: meta.difficulty,
    survival: { hunger: meta.difficulty === 'peaceful' ? MAX_HUNGER : meta.hunger, regenTimer: 0, starveTimer: 0 },
    monsters: [],
    nextMonsterId: 1,
    spawnTimer: 0,
    stats: meta.stats,
    quests: meta.quests,
    questTimer: 0,
    attackCooldown: 0,
    won: meta.won,
    hudVersion: 0,
    worldVersion: 0,
  };
}
