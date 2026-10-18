import { breakBlock, canMine, miningTime, pickaxeTierOf, placeSelected, REACH, withinReach } from './actions';
import { attackDamage, Block, blockInfo, foodValue, isPlaceable, Item } from './blocks';
import { craft, type CraftResult, type Recipe } from './crafting';
import { isNight, START_TIME } from './daycycle';
import { addItem, createInventory, selectedStack, takeFromSlot, type Inventory } from './inventory';
import {
  hitMonster,
  MONSTER_HEIGHT,
  MONSTER_WIDTH,
  monsterContains,
  SPAWN_INTERVAL,
  stepMonster,
  trySpawn,
  type Monster,
} from './monsters';
import {
  createPlayer,
  hurtPlayer,
  MAX_HEALTH,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  playerCenter,
  stepPlayer,
  SWING_SECONDS,
  type MoveInput,
  type Player,
} from './player';
import { bump, createStats, newlyCompleted, type Quest, type Stats } from './quests';
import { createSurvival, eatFood, canEat, MAX_HUNGER, stepSurvival, type Difficulty, type Survival } from './survival';
import { generateWorld } from './terrain';
import { getFg, type World } from './world';

export type Mining = { x: number; y: number; progress: number; time: number; nextHit: number };

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
  difficulty: Difficulty;
  survival: Survival;
  monsters: Monster[];
  nextMonsterId: number;
  spawnTimer: number;
  stats: Stats;
  /** Ids of finished quests. */
  quests: string[];
  questTimer: number;
  /** Seconds until the player can hit again. */
  attackCooldown: number;
  /** True once the Haven Beacon has been crafted. Play continues afterwards. */
  won: boolean;
  /** Bumped whenever the HUD needs to redraw (inventory, health, selection, quests). */
  hudVersion: number;
  /** Bumped whenever tiles change, so cached lighting can be rebuilt. */
  worldVersion: number;
};

export type HurtCause = 'fall' | 'monster' | 'hunger';

export type GameEvent =
  | { type: 'mined'; block: number; item: number | null; lost: number }
  | { type: 'dig'; block: number }
  | { type: 'placed'; block: number }
  | { type: 'needs-tool'; block: number }
  | { type: 'unsupported' }
  | { type: 'blocked' }
  | { type: 'out-of-reach' }
  | { type: 'hurt'; damage: number; cause: HurtCause }
  | { type: 'died' }
  | { type: 'step'; block: number }
  | { type: 'jump' }
  | { type: 'land'; block: number }
  | { type: 'swing' }
  | { type: 'monster-spawned' }
  | { type: 'monster-hit' }
  | { type: 'monster-defeated' }
  | { type: 'monster-burned' }
  | { type: 'monster-growl'; distance: number }
  | { type: 'quest'; quest: Quest; lost: number }
  | { type: 'crafted'; recipe: string }
  | { type: 'ate'; item: number }
  | { type: 'won' };

/** Seconds between digging sounds while a block is being mined. */
const DIG_HIT_SECONDS = 0.24;
/** Seconds between player attacks. */
export const ATTACK_COOLDOWN = 0.35;
const QUEST_CHECK_SECONDS = 0.5;

export function createGame(seed: number, difficulty: Difficulty = 'normal'): GameState {
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
    difficulty,
    survival: createSurvival(),
    monsters: [],
    nextMonsterId: 1,
    spawnTimer: 0,
    stats: createStats(),
    quests: [],
    questTimer: 0,
    attackCooldown: 0,
    won: false,
    hudVersion: 0,
    worldVersion: 0,
  };
}

/** Row of the ground at the spawn point; depth is measured from here. */
export function groundRow(state: GameState): number {
  return Math.floor(state.spawn.y + PLAYER_HEIGHT + 0.01);
}

/** Metres below the spawn ground (one tile = one metre). Negative values are above it. */
export function depthOf(state: GameState): number {
  return Math.floor(state.player.y + PLAYER_HEIGHT - groundRow(state));
}

/** Block under the middle of the player's feet. */
function blockUnderFeet(state: GameState): number {
  const p = state.player;
  return getFg(state.world, Math.floor(p.x + PLAYER_WIDTH / 2), Math.floor(p.y + PLAYER_HEIGHT + 0.05));
}

/** Advances the game. Returns events the UI turns into sounds, toasts and overlays. */
export function stepGame(state: GameState, input: MoveInput, dt: number, roll = Math.random): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.dead) return events;
  state.time += dt;
  const player = state.player;

  const before = player.health;
  const step = stepPlayer(state.world, player, input, dt);
  if (step.jumped) events.push({ type: 'jump' });
  if (step.landed > 9) events.push({ type: 'land', block: blockUnderFeet(state) });
  if (step.step) events.push({ type: 'step', block: blockUnderFeet(state) });
  if (step.damage > 0) events.push({ type: 'hurt', damage: step.damage, cause: 'fall' });

  const moving = input.left !== input.right;
  const hungerBefore = Math.ceil(state.survival.hunger * 2);
  const tick = stepSurvival(player, state.survival, state.difficulty, dt, moving);
  if (tick.starved > 0) events.push({ type: 'hurt', damage: tick.starved, cause: 'hunger' });
  if (Math.ceil(state.survival.hunger * 2) !== hungerBefore) state.hudVersion++;

  const night = isNight(state.time);
  stepMonsters(state, dt, night, roll, events);
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);

  if (player.health !== before) state.hudVersion++;
  if (player.health <= 0) {
    state.dead = true;
    state.mining = null;
    state.stats.sawNight = false;
    state.hudVersion++;
    events.push({ type: 'died' });
    return events;
  }

  // A night counts as survived when the sun comes up without dying since it got dark.
  if (night && !state.stats.sawNight) state.stats.sawNight = true;
  else if (!night && state.stats.sawNight) {
    state.stats.sawNight = false;
    state.stats.nightsSurvived++;
  }
  const depth = depthOf(state);
  if (depth > state.stats.maxDepth) state.stats.maxDepth = depth;

  const mining = state.mining;
  if (mining) {
    const block = getFg(state.world, mining.x, mining.y);
    if (block === Block.Air || !withinReach(player, mining.x, mining.y)) {
      state.mining = null;
    } else {
      mining.progress += dt / mining.time;
      mining.nextHit -= dt;
      if (mining.nextHit <= 0 && mining.progress < 1) {
        mining.nextHit += DIG_HIT_SECONDS;
        player.swingTime = SWING_SECONDS;
        events.push({ type: 'dig', block });
      }
      if (mining.progress >= 1) {
        const result = breakBlock(state.world, state.inventory, mining.x, mining.y, roll());
        state.mining = null;
        if (result.ok) {
          state.worldVersion++;
          state.hudVersion++;
          bump(state.stats.mined, result.block);
          if (result.drop) bump(state.stats.collected, result.drop.item, result.drop.count);
          if (result.extra) bump(state.stats.collected, result.extra.item, result.extra.count);
          events.push({ type: 'mined', block: result.block, item: result.drop?.item ?? null, lost: result.lost });
        }
      }
    }
  }

  state.questTimer += dt;
  if (state.questTimer >= QUEST_CHECK_SECONDS) {
    state.questTimer = 0;
    events.push(...checkQuests(state));
  }
  return events;
}

function stepMonsters(state: GameState, dt: number, night: boolean, roll: () => number, events: GameEvent[]): void {
  const player = state.player;
  const peaceful = state.difficulty === 'peaceful';
  if (peaceful && state.monsters.length > 0) state.monsters = [];

  state.spawnTimer += dt;
  if (state.spawnTimer >= SPAWN_INTERVAL) {
    state.spawnTimer = 0;
    const monster = trySpawn(state.world, player, state.monsters, { night, peaceful }, state.nextMonsterId, roll);
    if (monster) {
      state.nextMonsterId++;
      state.monsters.push(monster);
      events.push({ type: 'monster-spawned' });
    }
  }

  if (state.monsters.length === 0) return;
  const keep: Monster[] = [];
  for (const monster of state.monsters) {
    const result = stepMonster(state.world, monster, player, dt, !night);
    if (result.burned) {
      events.push({ type: 'monster-burned' });
      continue;
    }
    if (result.despawned) continue;
    if (result.contact > 0 && player.health > 0) {
      hurtPlayer(player, result.contact);
      player.knockback = result.push * 7;
      if (player.onGround) {
        player.vy = -5;
        player.onGround = false;
      }
      events.push({ type: 'hurt', damage: result.contact, cause: 'monster' });
    }
    if (result.growl) {
      const distance = Math.abs(monster.x - player.x);
      events.push({ type: 'monster-growl', distance });
    }
    keep.push(monster);
  }
  state.monsters = keep;
}

/** Marks finished quests complete and hands out their rewards. */
export function checkQuests(state: GameState): GameEvent[] {
  const ctx = { stats: state.stats, world: state.world, player: state.player, difficulty: state.difficulty };
  const done = newlyCompleted(state.quests, ctx);
  const events: GameEvent[] = [];
  for (const quest of done) {
    state.quests.push(quest.id);
    let lost = 0;
    for (const reward of quest.rewards) lost += addItem(state.inventory, reward.item, reward.count);
    events.push({ type: 'quest', quest, lost });
  }
  if (done.length > 0) state.hudVersion++;
  return events;
}

/**
 * A tap at a point in tile coordinates. Hits a monster under the finger first, otherwise acts on the
 * tile there (see tapTile).
 */
export function tapWorld(state: GameState, wx: number, wy: number, allowPlace = true): GameEvent[] {
  if (state.dead) return [];
  const center = playerCenter(state.player);
  for (const monster of state.monsters) {
    if (!monsterContains(monster, wx, wy)) continue;
    const mx = monster.x + MONSTER_WIDTH / 2;
    const my = monster.y + MONSTER_HEIGHT / 2;
    const dx = mx - center.x;
    const dy = my - center.y;
    if (dx * dx + dy * dy > REACH * REACH) return [{ type: 'out-of-reach' }];
    return attack(state, monster);
  }
  const tx = Math.floor(wx);
  const ty = Math.floor(wy);
  if (!allowPlace && getFg(state.world, tx, ty) === Block.Air) return [];
  return tapTile(state, tx, ty);
}

function attack(state: GameState, monster: Monster): GameEvent[] {
  if (state.attackCooldown > 0) return [];
  state.attackCooldown = ATTACK_COOLDOWN;
  state.mining = null;
  const player = state.player;
  player.swingTime = SWING_SECONDS;
  player.facing = monster.x + MONSTER_WIDTH / 2 >= player.x + PLAYER_WIDTH / 2 ? 1 : -1;
  const item = selectedStack(state.inventory)?.item ?? null;
  const defeated = hitMonster(monster, attackDamage(item), player.x + PLAYER_WIDTH / 2);
  if (!defeated) return [{ type: 'monster-hit' }];
  state.monsters = state.monsters.filter((m) => m !== monster);
  state.stats.monstersDefeated++;
  return [{ type: 'monster-defeated' }, ...checkQuests(state)];
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
    state.mining = { x: tx, y: ty, progress: 0, time: Math.max(0.05, miningTime(block, tier)), nextHit: 0 };
    faceTile(state.player, tx);
    return [];
  }
  state.mining = null;
  const stack = selectedStack(state.inventory);
  if (!stack || !isPlaceable(stack.item)) return [];
  const item = stack.item;
  if (blockInfo(item).solid && state.monsters.some((m) => overlapsTile(m, tx, ty))) return [{ type: 'blocked' }];
  const result = placeSelected(state.world, state.inventory, state.player, tx, ty);
  if (result === 'placed') {
    state.worldVersion++;
    state.hudVersion++;
    state.player.swingTime = SWING_SECONDS;
    faceTile(state.player, tx);
    bump(state.stats.placed, item);
    return [{ type: 'placed', block: item }];
  }
  if (result === 'unsupported') return [{ type: 'unsupported' }];
  return [];
}

function faceTile(player: Player, tx: number): void {
  const dx = tx + 0.5 - (player.x + PLAYER_WIDTH / 2);
  if (Math.abs(dx) > 0.3) player.facing = dx > 0 ? 1 : -1;
}

function overlapsTile(m: Monster, tx: number, ty: number): boolean {
  return m.x < tx + 1 && m.x + MONSTER_WIDTH > tx && m.y < ty + 1 && m.y + MONSTER_HEIGHT > ty;
}

/** Crafts once and records it for quests. Crafting the Haven Beacon wins the game. */
export function craftInGame(state: GameState, recipe: Recipe): { result: CraftResult; events: GameEvent[] } {
  const result = craft(state.inventory, recipe);
  if (result !== 'crafted') return { result, events: [] };
  bump(state.stats.crafted, recipe.id);
  state.hudVersion++;
  const events: GameEvent[] = [{ type: 'crafted', recipe: recipe.id }];
  if (recipe.output.item === Item.Beacon && !state.won) {
    state.won = true;
    events.push({ type: 'won' });
  }
  events.push(...checkQuests(state));
  return { result, events };
}

export type EatResult = 'ate' | 'full' | 'not-food';

/** Eats the selected item when it is food and the player is hungry. */
export function eatSelected(state: GameState): { result: EatResult; events: GameEvent[] } {
  const stack = selectedStack(state.inventory);
  if (!stack || foodValue(stack.item) <= 0) return { result: 'not-food', events: [] };
  if (!canEat(state.survival, stack.item)) return { result: 'full', events: [] };
  const item = stack.item;
  takeFromSlot(state.inventory, state.inventory.selected);
  eatFood(state.survival, item);
  state.stats.foodEaten++;
  state.hudVersion++;
  return { result: 'ate', events: [{ type: 'ate', item }] };
}

/** Revive in place with half health (rewarded ad). Monsters right next to the player are cleared. */
export function revive(state: GameState): void {
  state.dead = false;
  const p = state.player;
  p.health = Math.ceil(MAX_HEALTH / 2);
  p.vy = 0;
  p.knockback = 0;
  p.fallStartY = p.y;
  p.sinceHurt = 0;
  state.survival.hunger = Math.max(state.survival.hunger, MAX_HUNGER / 2);
  state.survival.starveTimer = 0;
  state.monsters = state.monsters.filter((m) => Math.abs(m.x - p.x) > 8);
  state.hudVersion++;
}

/** Respawn at the world spawn point with full health and hunger. The inventory is kept. */
export function respawn(state: GameState): void {
  state.dead = false;
  const p = state.player;
  p.x = state.spawn.x;
  p.y = state.spawn.y;
  // If the player built over the spawn point, rise until the box is free.
  while (p.y > 1 && isBoxBlocked(state)) p.y -= 1;
  p.vx = 0;
  p.vy = 0;
  p.knockback = 0;
  p.health = MAX_HEALTH;
  p.fallStartY = p.y;
  state.survival = createSurvival();
  state.monsters = [];
  state.mining = null;
  state.hudVersion++;
}

function isBoxBlocked(state: GameState): boolean {
  const x = Math.floor(state.player.x);
  const y = Math.floor(state.player.y);
  for (let dy = 0; dy < 2; dy++) {
    if (blockInfo(getFg(state.world, x, y + dy)).solid) return true;
  }
  return false;
}
