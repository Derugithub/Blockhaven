import assert from 'node:assert/strict';
import test from 'node:test';

import { Block, Item } from '../src/game/blocks.ts';
import { BEACON_CRYSTALS, findRecipe } from '../src/game/crafting.ts';
import { checkQuests, craftInGame, createGame, depthOf, eatSelected, stepGame, tapWorld, type GameState } from '../src/game/game.ts';
import { addItem, countItem } from '../src/game/inventory.ts';
import { createPlayer } from '../src/game/player.ts';
import {
  createStats,
  currentQuest,
  DEPTH_GOAL,
  newlyCompleted,
  QUESTS,
  questProgress,
  questsFor,
  shelterParts,
} from '../src/game/quests.ts';
import { createEmptyWorld, refreshSky, setFg, type World } from '../src/game/world.ts';

const idle = { left: false, right: false, jump: false };

function flatWorld(): World {
  const world = createEmptyWorld(64, 32);
  for (let x = 0; x < 64; x++) {
    for (let y = 20; y < 32; y++) world.fg[y * 64 + x] = y === 20 ? Block.Grass : Block.Stone;
  }
  refreshSky(world);
  return world;
}

function flatGame(): GameState {
  const game = createGame(1);
  game.world = flatWorld();
  game.player = createPlayer(10.15, 18.2);
  game.spawn = { x: 10.15, y: 18.2 };
  for (let i = 0; i < 30; i++) stepGame(game, idle, 1 / 60);
  return game;
}

test('quest ids are unique and every quest has a reward', () => {
  const ids = QUESTS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const quest of QUESTS) {
    assert.ok(quest.rewards.length > 0, quest.id);
    assert.ok(quest.target > 0, quest.id);
  }
});

test('the first quest is collecting wood and progress counts collected logs', () => {
  const game = flatGame();
  assert.equal(currentQuest(game.quests, game.difficulty)?.id, 'wood');
  const wood = QUESTS.find((q) => q.id === 'wood')!;
  const ctx = { stats: game.stats, world: game.world, player: game.player, difficulty: game.difficulty };
  game.stats.collected[Item.Wood] = 4;
  assert.equal(questProgress(wood, ctx), 4);
  game.stats.collected[Item.Wood] = 25;
  assert.equal(questProgress(wood, ctx), 10, 'progress is clamped to the target');
});

test('mining a log counts towards the wood quest and completing it pays the reward once', () => {
  const game = flatGame();
  setFg(game.world, 12, 19, Block.Wood);
  game.stats.collected[Item.Wood] = 9;
  tapWorld(game, 12.5, 19.5);
  for (let i = 0; i < 120 && game.world.fg[19 * 64 + 12] !== Block.Air; i++) stepGame(game, idle, 1 / 30);
  assert.equal(game.stats.collected[Item.Wood], 10);
  assert.equal(game.stats.mined[Block.Wood], 1);
  const events = [];
  for (let i = 0; i < 20; i++) events.push(...stepGame(game, idle, 1 / 30));
  const quest = events.filter((e) => e.type === 'quest');
  assert.equal(quest.length, 1);
  assert.ok(game.quests.includes('wood'));
  assert.equal(countItem(game.inventory, Item.Apple), 2);
  assert.equal(checkQuests(game).length, 0, 'a finished quest is not paid twice');
  assert.equal(currentQuest(game.quests, game.difficulty)?.id, 'wooden_pickaxe');
});

test('quests can finish out of order', () => {
  const game = flatGame();
  game.stats.collected[Item.Coal] = 1;
  const done = checkQuests(game);
  assert.deepEqual(
    done.map((e) => (e.type === 'quest' ? e.quest.id : '')),
    ['coal'],
  );
  assert.equal(currentQuest(game.quests, game.difficulty)?.id, 'wood');
});

test('crafting through the game records recipes and the beacon wins', () => {
  const game = flatGame();
  addItem(game.inventory, Item.Wood, 1);
  const planks = craftInGame(game, findRecipe('planks')!);
  assert.equal(planks.result, 'crafted');
  assert.equal(game.stats.crafted.planks, 1);
  assert.ok(!game.won);

  addItem(game.inventory, Item.Crystal, BEACON_CRYSTALS);
  addItem(game.inventory, Item.Stone, 5);
  const beacon = craftInGame(game, findRecipe('beacon')!);
  assert.equal(beacon.result, 'crafted');
  assert.ok(game.won);
  assert.ok(beacon.events.some((e) => e.type === 'won'));
  assert.ok(game.quests.includes('beacon'));
  assert.equal(countItem(game.inventory, Item.Beacon), 1);
  // A second beacon does not trigger the win again.
  addItem(game.inventory, Item.Crystal, BEACON_CRYSTALS);
  addItem(game.inventory, Item.Stone, 5);
  assert.ok(!craftInGame(game, findRecipe('beacon')!).events.some((e) => e.type === 'won'));
});

test('a beacon needs ten crystals', () => {
  const game = flatGame();
  addItem(game.inventory, Item.Crystal, BEACON_CRYSTALS - 1);
  addItem(game.inventory, Item.Stone, 5);
  assert.equal(craftInGame(game, findRecipe('beacon')!).result, 'missing');
  assert.ok(!game.won);
});

test('placing torches counts for the torch quest', () => {
  const game = flatGame();
  addItem(game.inventory, Item.Torch, 5);
  game.inventory.selected = 0;
  for (const x of [8, 9, 12, 13, 14]) tapWorld(game, x + 0.5, 19.5);
  assert.equal(game.stats.placed[Block.Torch], 5);
  assert.ok(checkQuests(game).some((e) => e.type === 'quest' && e.quest.id === 'torches'));
});

test('the shelter check needs placed blocks, a roof and two walls', () => {
  const game = flatGame();
  const p = game.player;
  const left = Math.floor(p.x);
  const head = Math.floor(p.y);
  assert.equal(shelterParts(game.world, p, 0), 0);
  for (let y = head; y < 20; y++) {
    setFg(game.world, left - 2, y, Block.Planks);
    setFg(game.world, left + 3, y, Block.Planks);
  }
  assert.equal(shelterParts(game.world, p, 3), 2, 'two walls, no roof, not enough blocks');
  for (let x = left - 2; x <= left + 3; x++) setFg(game.world, x, head - 2, Block.Planks);
  assert.equal(shelterParts(game.world, p, 8), 4);
});

test('depth is measured from the spawn ground and recorded', () => {
  const game = flatGame();
  assert.equal(depthOf(game), 0);
  game.player.y += 12;
  assert.equal(depthOf(game), 12);
  game.stats.maxDepth = DEPTH_GOAL;
  const ctx = { stats: game.stats, world: game.world, player: game.player, difficulty: game.difficulty };
  assert.ok(newlyCompleted([], ctx).some((q) => q.id === 'depth'));
});

test('peaceful worlds skip the monster quest', () => {
  assert.ok(questsFor('normal').some((q) => q.id === 'monster'));
  assert.ok(!questsFor('peaceful').some((q) => q.id === 'monster'));
  const stats = createStats();
  stats.monstersDefeated = 3;
  const ctx = { stats, world: flatWorld(), player: createPlayer(1, 1), difficulty: 'peaceful' as const };
  assert.ok(!newlyCompleted([], ctx).some((q) => q.id === 'monster'));
});

test('surviving from dusk to dawn counts a night, dying resets it', () => {
  const game = flatGame();
  game.difficulty = 'peaceful';
  game.time = 480 * 0.6; // evening, night
  stepGame(game, idle, 1 / 30);
  assert.ok(game.stats.sawNight);
  game.time = 480 * 1.02; // next morning
  stepGame(game, idle, 1 / 30);
  assert.equal(game.stats.nightsSurvived, 1);

  game.time = 480 * 1.6;
  stepGame(game, idle, 1 / 30);
  game.player.health = 0.5;
  game.player.y = 2; // falls far enough to die
  for (let i = 0; i < 120 && !game.dead; i++) stepGame(game, idle, 1 / 30);
  assert.ok(game.dead);
  assert.ok(!game.stats.sawNight);
});

test('eating food fills hunger and uses up the item', () => {
  const game = flatGame();
  game.survival.hunger = 3;
  addItem(game.inventory, Item.Apple, 2);
  game.inventory.selected = 0;
  const first = eatSelected(game);
  assert.equal(first.result, 'ate');
  assert.equal(game.survival.hunger, 5.5);
  assert.equal(countItem(game.inventory, Item.Apple), 1);
  game.survival.hunger = 10;
  assert.equal(eatSelected(game).result, 'full');
  game.inventory.selected = 3;
  assert.equal(eatSelected(game).result, 'not-food');
});
