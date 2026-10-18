import assert from 'node:assert/strict';
import test from 'node:test';

import { attackDamage, Block, foodValue, Item } from '../src/game/blocks.ts';
import { createGame, respawn, revive, stepGame, tapWorld, type GameState } from '../src/game/game.ts';
import { addItem } from '../src/game/inventory.ts';
import {
  createMonster,
  isLitByBlocks,
  MONSTER_CAP,
  MONSTER_HEALTH,
  SPAWN_MAX_DISTANCE,
  SPAWN_MIN_DISTANCE,
  spawnSpotAt,
  stepMonster,
  trySpawn,
} from '../src/game/monsters.ts';
import { createPlayer, MAX_HEALTH } from '../src/game/player.ts';
import {
  canEat,
  createSurvival,
  eatFood,
  HUNGER_SECONDS,
  MAX_HUNGER,
  REGEN_SECONDS,
  STARVE_SECONDS,
  stepSurvival,
} from '../src/game/survival.ts';
import { createEmptyWorld, refreshSky, setFg, type World } from '../src/game/world.ts';

const idle = { left: false, right: false, jump: false };

function flatWorld(width = 128): World {
  const world = createEmptyWorld(width, 32);
  for (let x = 0; x < width; x++) {
    for (let y = 20; y < 32; y++) world.fg[y * width + x] = y === 20 ? Block.Grass : Block.Stone;
  }
  refreshSky(world);
  return world;
}

function flatGame(): GameState {
  const game = createGame(1);
  game.world = flatWorld();
  game.player = createPlayer(60.15, 18.2);
  game.spawn = { x: 60.15, y: 18.2 };
  for (let i = 0; i < 30; i++) stepGame(game, idle, 1 / 60);
  return game;
}

function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

test('hunger drains slowly and faster while moving', () => {
  const player = createPlayer(0, 0);
  const still = createSurvival();
  const moving = createSurvival();
  stepSurvival(player, still, 'normal', HUNGER_SECONDS, false);
  stepSurvival(player, moving, 'normal', HUNGER_SECONDS, true);
  assert.ok(Math.abs(still.hunger - (MAX_HUNGER - 1)) < 1e-9);
  assert.ok(moving.hunger < still.hunger);
});

test('peaceful mode never gets hungry', () => {
  const player = createPlayer(0, 0);
  const s = createSurvival();
  s.hunger = 2;
  for (let i = 0; i < 1000; i++) stepSurvival(player, s, 'peaceful', 1, true);
  assert.equal(s.hunger, MAX_HUNGER);
});

test('health regenerates when fed and costs hunger', () => {
  const player = createPlayer(0, 0);
  player.health = 5;
  player.sinceHurt = 10;
  const s = createSurvival();
  let healed = 0;
  for (let t = 0; t < REGEN_SECONDS * 3 + 0.01; t += 0.1) healed += stepSurvival(player, s, 'normal', 0.1, false).healed;
  assert.equal(healed, 3);
  assert.equal(player.health, 8);
  assert.ok(s.hunger < MAX_HUNGER - 1.4);
});

test('no regeneration while hungry, and right after being hurt', () => {
  const player = createPlayer(0, 0);
  player.health = 5;
  const s = createSurvival();
  s.hunger = 3;
  player.sinceHurt = 10;
  for (let i = 0; i < 100; i++) stepSurvival(player, s, 'normal', 0.1, false);
  assert.equal(player.health, 5);
  s.hunger = 8;
  player.sinceHurt = 0;
  stepSurvival(player, s, 'normal', 2, false);
  assert.equal(player.health, 5);
});

test('starving hurts slowly but never below one heart', () => {
  const player = createPlayer(0, 0);
  player.health = 3;
  const s = createSurvival();
  s.hunger = 0;
  let starved = 0;
  for (let t = 0; t < STARVE_SECONDS * 6; t += 0.5) starved += stepSurvival(player, s, 'normal', 0.5, false).starved;
  assert.equal(player.health, 1);
  assert.equal(starved, 2);
});

test('food values and eating', () => {
  assert.ok(foodValue(Item.Berries) > 0);
  assert.ok(foodValue(Item.BerryPie) > foodValue(Item.Apple));
  assert.equal(foodValue(Item.Stone), 0);
  const s = createSurvival();
  assert.ok(!canEat(s, Item.Apple), 'cannot eat when full');
  s.hunger = 9;
  assert.equal(eatFood(s, Item.BerryPie), 1, 'hunger caps at the maximum');
});

test('a hard fall hurts the player', () => {
  const game = flatGame();
  game.player.y = 4;
  game.player.fallStartY = 4;
  game.player.onGround = false;
  const events = [];
  for (let i = 0; i < 90; i++) events.push(...stepGame(game, idle, 1 / 60));
  assert.ok(game.player.health < MAX_HEALTH);
  assert.ok(events.some((e) => e.type === 'hurt' && e.cause === 'fall'));
  assert.ok(game.player.hurtTime > 0 || events.some((e) => e.type === 'hurt'));
});

test('monsters only spawn at night, never in peaceful, and respect the cap', () => {
  const game = flatGame();
  const roll = sequence(0.9, 0.5);
  assert.equal(trySpawn(game.world, game.player, [], { night: false, peaceful: false }, 1, roll), null);
  assert.equal(trySpawn(game.world, game.player, [], { night: true, peaceful: true }, 1, roll), null);
  const monster = trySpawn(game.world, game.player, [], { night: true, peaceful: false }, 1, roll);
  assert.ok(monster);
  const full = Array.from({ length: MONSTER_CAP }, (_, i) => createMonster(i, 0, 0));
  assert.equal(trySpawn(game.world, game.player, full, { night: true, peaceful: false }, 9, roll), null);
});

test('monsters spawn away from the player, on the surface', () => {
  const game = flatGame();
  const px = game.player.x + 0.35;
  for (let tx = 0; tx < game.world.width; tx++) {
    const spot = spawnSpotAt(game.world, game.player, tx);
    const d = Math.abs(tx + 0.5 - px);
    if (d < SPAWN_MIN_DISTANCE || d > SPAWN_MAX_DISTANCE) assert.equal(spot, null, `column ${tx}`);
    else {
      assert.ok(spot, `column ${tx}`);
      assert.ok(Math.abs(spot.y + 1.7 - 20) < 1e-9, 'stands on the grass');
    }
  }
});

test('torches stop monsters spawning nearby', () => {
  const game = flatGame();
  const tx = 86;
  assert.ok(spawnSpotAt(game.world, game.player, tx));
  setFg(game.world, tx + 3, 19, Block.Torch);
  assert.ok(isLitByBlocks(game.world, tx, 19));
  assert.equal(spawnSpotAt(game.world, game.player, tx), null);
  assert.ok(spawnSpotAt(game.world, game.player, 75), 'far from the torch is still dark');
});

test('monsters do not spawn under or on a built roof', () => {
  const game = flatGame();
  const tx = 80;
  setFg(game.world, tx, 10, Block.Planks);
  refreshSky(game.world);
  assert.equal(spawnSpotAt(game.world, game.player, tx), null);
});

test('a monster walks toward the player, hits on contact, and burns in daylight', () => {
  const game = flatGame();
  const m = createMonster(1, game.player.x + 6, 18.3);
  for (let i = 0; i < 30; i++) stepMonster(game.world, m, game.player, 1 / 30, false);
  assert.ok(m.x < game.player.x + 6, 'moves toward the player');
  let contact = 0;
  for (let i = 0; i < 200 && contact === 0; i++) contact = stepMonster(game.world, m, game.player, 1 / 30, false).contact;
  assert.ok(contact > 0);
  let burned = false;
  for (let i = 0; i < 120 && !burned; i++) burned = stepMonster(game.world, m, game.player, 1 / 30, true).burned;
  assert.ok(burned);
});

test('tapping a monster damages it, swords hit harder', () => {
  assert.ok(attackDamage(Item.StoneSword) > attackDamage(Item.WoodSword));
  assert.ok(attackDamage(Item.WoodSword) > attackDamage(Item.WoodPickaxe));
  assert.ok(attackDamage(Item.WoodPickaxe) > attackDamage(null));

  const game = flatGame();
  const m = createMonster(1, game.player.x + 2, 18.3);
  game.monsters.push(m);
  addItem(game.inventory, Item.StoneSword, 1);
  game.inventory.selected = 0;
  const first = tapWorld(game, m.x + 0.4, m.y + 0.8);
  assert.deepEqual(first, [{ type: 'monster-hit' }]);
  assert.equal(m.health, MONSTER_HEALTH - attackDamage(Item.StoneSword));
  assert.deepEqual(tapWorld(game, m.x + 0.4, m.y + 0.8), [], 'attack cooldown');
  for (let i = 0; i < 15; i++) stepGame(game, idle, 1 / 30);
  const target = game.monsters[0];
  const second = tapWorld(game, target.x + 0.4, target.y + 0.8);
  assert.equal(second[0].type, 'monster-defeated');
  assert.equal(game.monsters.length, 0);
  assert.equal(game.stats.monstersDefeated, 1);
});

test('death, respawn and the rewarded revive', () => {
  const game = flatGame();
  game.monsters.push(createMonster(1, game.player.x + 1, 18.3));
  game.player.health = 1;
  game.survival.hunger = 1;
  revive(game);
  assert.equal(game.player.health, 5);
  assert.equal(game.monsters.length, 0, 'revive clears monsters right next to you');
  assert.ok(game.survival.hunger >= 5);

  game.player.x = 30;
  game.player.health = 0;
  game.dead = true;
  respawn(game);
  assert.ok(!game.dead);
  assert.equal(game.player.health, MAX_HEALTH);
  assert.equal(game.survival.hunger, MAX_HUNGER);
  assert.equal(game.player.x, game.spawn.x);
});

test('walking advances the walk cycle and emits footsteps on the beat', () => {
  const game = flatGame();
  const steps = [];
  for (let i = 0; i < 60; i++) steps.push(...stepGame(game, { left: false, right: true, jump: false }, 1 / 60).filter((e) => e.type === 'step'));
  // 5.2 tiles per second for one second, a step every 1.1 tiles.
  assert.ok(steps.length >= 4 && steps.length <= 5, `got ${steps.length} steps`);
  assert.ok(steps.every((e) => e.type === 'step' && e.block === Block.Grass));
  assert.equal(game.player.facing, 1);
  stepGame(game, { left: true, right: false, jump: false }, 1 / 60);
  assert.equal(game.player.facing, -1);
  const quiet = [];
  for (let i = 0; i < 60; i++) quiet.push(...stepGame(game, idle, 1 / 60).filter((e) => e.type === 'step'));
  assert.equal(quiet.length, 0, 'no footsteps while standing');
});
