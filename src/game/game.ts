import { breakBlock, canMine, miningTime, pickaxeTierOf, placeSelected, withinReach } from './actions';
import { Block, isPlaceable } from './blocks';
import { START_TIME } from './daycycle';
import { createInventory, selectedStack, type Inventory } from './inventory';
import { createPlayer, MAX_HEALTH, stepPlayer, type MoveInput, type Player } from './player';
import { generateWorld } from './terrain';
import { getFg, type World } from './world';

export type Mining = { x: number; y: number; progress: number; time: number };

export type GameState = {
  world: World;
  player: Player;
  inventory: Inventory;
  seed: number;
  /** Seconds of world time; drives the day cycle. */
  time: number;
  spawn: { x: number; y: number };
  mining: Mining | null;
  dead: boolean;
  /** Bumped whenever the HUD needs to redraw (inventory, health, selection). */
  hudVersion: number;
  /** Bumped whenever tiles change, so cached lighting can be rebuilt. */
  worldVersion: number;
};

export type GameEvent =
  | { type: 'mined'; item: number | null; lost: number }
  | { type: 'placed' }
  | { type: 'needs-tool'; block: number }
  | { type: 'unsupported' }
  | { type: 'out-of-reach' }
  | { type: 'hurt'; damage: number }
  | { type: 'died' };

export function createGame(seed: number): GameState {
  const { world, spawnX, spawnY } = generateWorld(seed);
  return {
    world,
    player: createPlayer(spawnX, spawnY),
    inventory: createInventory(),
    seed,
    time: START_TIME,
    spawn: { x: spawnX, y: spawnY },
    mining: null,
    dead: false,
    hudVersion: 0,
    worldVersion: 0,
  };
}

/** Advances the game. Returns events the UI may want to show. */
export function stepGame(state: GameState, input: MoveInput, dt: number, roll = Math.random): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.dead) return events;
  state.time += dt;

  const before = state.player.health;
  const { damage } = stepPlayer(state.world, state.player, input, dt);
  if (state.player.health !== before) state.hudVersion++;
  if (damage > 0) events.push({ type: 'hurt', damage });
  if (state.player.health <= 0) {
    state.dead = true;
    state.mining = null;
    state.hudVersion++;
    events.push({ type: 'died' });
    return events;
  }

  const mining = state.mining;
  if (mining) {
    const block = getFg(state.world, mining.x, mining.y);
    if (block === Block.Air || !withinReach(state.player, mining.x, mining.y)) {
      state.mining = null;
    } else {
      mining.progress += dt / mining.time;
      if (mining.progress >= 1) {
        const result = breakBlock(state.world, state.inventory, mining.x, mining.y, roll());
        state.mining = null;
        if (result.ok) {
          state.worldVersion++;
          state.hudVersion++;
          events.push({ type: 'mined', item: result.drop?.item ?? null, lost: result.lost });
        }
      }
    }
  }
  return events;
}

/**
 * A tap on a tile: start mining a block, or place the selected item in empty space.
 * Tapping the block already being mined keeps mining it.
 */
export function tapTile(state: GameState, tx: number, ty: number): GameEvent[] {
  if (state.dead) return [];
  if (!withinReach(state.player, tx, ty)) return [{ type: 'out-of-reach' }];
  const block = getFg(state.world, tx, ty);
  if (block !== Block.Air) {
    if (state.mining && state.mining.x === tx && state.mining.y === ty) return [];
    const tier = pickaxeTierOf(state.inventory);
    if (!canMine(block, tier)) {
      state.mining = null;
      return [{ type: 'needs-tool', block }];
    }
    state.mining = { x: tx, y: ty, progress: 0, time: Math.max(0.05, miningTime(block, tier)) };
    return [];
  }
  state.mining = null;
  const stack = selectedStack(state.inventory);
  if (!stack || !isPlaceable(stack.item)) return [];
  const result = placeSelected(state.world, state.inventory, state.player, tx, ty);
  if (result === 'placed') {
    state.worldVersion++;
    state.hudVersion++;
    return [{ type: 'placed' }];
  }
  if (result === 'unsupported') return [{ type: 'unsupported' }];
  return [];
}

/** Revive in place with half health (rewarded ad). */
export function revive(state: GameState): void {
  state.dead = false;
  state.player.health = Math.ceil(MAX_HEALTH / 2);
  state.player.vy = 0;
  state.player.fallStartY = state.player.y;
  state.player.sinceHurt = 0;
  state.hudVersion++;
}

/** Respawn at the world spawn point with full health. The inventory is kept. */
export function respawn(state: GameState): void {
  state.dead = false;
  state.player.x = state.spawn.x;
  state.player.y = state.spawn.y;
  // If the player built over the spawn point, rise until the box is free.
  while (state.player.y > 1 && isBoxBlocked(state)) state.player.y -= 1;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.health = MAX_HEALTH;
  state.player.fallStartY = state.player.y;
  state.mining = null;
  state.hudVersion++;
}

function isBoxBlocked(state: GameState): boolean {
  const x = Math.floor(state.player.x);
  const y = Math.floor(state.player.y);
  for (let dy = 0; dy < 2; dy++) {
    if (getFg(state.world, x, y + dy) !== Block.Air && getFg(state.world, x, y + dy) !== Block.Torch) return true;
  }
  return false;
}
