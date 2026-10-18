import assert from 'node:assert/strict';
import test from 'node:test';

import { Block, Item } from '../src/game/blocks.ts';
import { createGame } from '../src/game/game.ts';
import { addItem } from '../src/game/inventory.ts';
import { deserializeGame, migrateMeta, rleEncode, SAVE_VERSION, serializeGame } from '../src/game/save-format.ts';
import { addCrystals, crystalLayer, generateWorld } from '../src/game/terrain.ts';
import { advanceTutorial, TUTORIAL_STEPS, tutorialPosition, type TutorialStep } from '../src/game/tutorial.ts';

/** Builds the save a v1 build would have written for this game: no v2 fields, no crystals or bushes. */
function v1Save(seed: number) {
  const game = createGame(seed);
  addItem(game.inventory, Item.Torch, 7);
  game.player.health = 6;
  game.time = 900;
  const fg = game.world.fg.slice();
  for (let i = 0; i < fg.length; i++) {
    if (fg[i] === Block.CrystalOre) fg[i] = Block.Stone;
    if (fg[i] === Block.BerryBush) fg[i] = Block.Air;
  }
  const v2 = JSON.parse(serializeGame(game).meta);
  const meta = {
    version: 1,
    seed: v2.seed,
    width: v2.width,
    height: v2.height,
    time: v2.time,
    spawn: v2.spawn,
    player: v2.player,
    inventory: v2.inventory,
  };
  const a = rleEncode(fg);
  const b = rleEncode(game.world.bg);
  const tiles = new Uint8Array(a.length + b.length);
  tiles.set(a);
  tiles.set(b, a.length);
  return { game, saved: { meta: JSON.stringify(meta), tiles } };
}

test('the save format is version 2', () => {
  assert.equal(SAVE_VERSION, 2);
});

test('a v1 save migrates to v2 with fresh survival and quest state', () => {
  const { saved } = v1Save(4242);
  const meta = migrateMeta(JSON.parse(saved.meta));
  assert.equal(meta.version, 2);
  assert.equal(meta.difficulty, 'normal');
  assert.equal(meta.hunger, 10);
  assert.deepEqual(meta.quests, []);
  assert.equal(meta.won, false);
  assert.equal(meta.tilesVersion, 1);
  assert.equal(meta.stats.maxDepth, 0);
});

test('a v1 world still loads, keeps its progress, and gains crystals and berry bushes', () => {
  const { game, saved } = v1Save(4242);
  const loaded = deserializeGame(saved);
  assert.equal(loaded.player.health, 6);
  assert.equal(loaded.time, 900);
  assert.deepEqual(loaded.inventory.slots, game.inventory.slots);
  assert.equal(loaded.difficulty, 'normal');
  assert.equal(loaded.survival.hunger, 10);
  // Upgrading an untouched v1 world gives exactly the tiles a fresh v2 world has.
  assert.deepEqual(loaded.world.fg, game.world.fg);
  assert.ok(loaded.world.fg.includes(Block.CrystalOre));

  // Saving again writes v2 and the upgrade does not run twice.
  const again = serializeGame(loaded);
  const meta = JSON.parse(again.meta);
  assert.equal(meta.version, 2);
  assert.equal(meta.tilesVersion, 2);
  assert.deepEqual(deserializeGame(again).world.fg, loaded.world.fg);
});

test('the v1 upgrade only touches untouched stone and grass', () => {
  const { saved } = v1Save(77);
  const meta = JSON.parse(saved.meta);
  const loaded = deserializeGame(saved);
  // Fill the crystal layer with planks in a fresh copy: the upgrade must leave them alone.
  const game = createGame(77);
  const { top, bottom } = crystalLayer(game.world.height);
  for (let y = top; y <= bottom; y++) for (let x = 0; x < game.world.width; x++) game.world.fg[y * game.world.width + x] = Block.Planks;
  assert.equal(addCrystals(game.world, meta.seed), 0);
  assert.ok(loaded.world.fg.includes(Block.CrystalOre));
});

test('v2 progress round-trips through a save', () => {
  const game = createGame(9, 'peaceful');
  game.survival.hunger = 6.5;
  game.quests = ['wood', 'coal'];
  game.stats.collected[Item.Crystal] = 4;
  game.stats.maxDepth = 33;
  game.stats.nightsSurvived = 2;
  game.won = true;
  const loaded = deserializeGame(serializeGame(game));
  assert.equal(loaded.difficulty, 'peaceful');
  assert.equal(loaded.survival.hunger, 10, 'peaceful keeps hunger full');
  assert.deepEqual(loaded.quests, ['wood', 'coal']);
  assert.equal(loaded.stats.collected[Item.Crystal], 4);
  assert.equal(loaded.stats.maxDepth, 33);
  assert.equal(loaded.stats.nightsSurvived, 2);
  assert.ok(loaded.won);

  const normal = createGame(9);
  normal.survival.hunger = 6.5;
  assert.equal(deserializeGame(serializeGame(normal)).survival.hunger, 6.5);
});

test('damaged v2 fields fall back to safe defaults', () => {
  const game = createGame(3);
  const saved = serializeGame(game);
  const meta = JSON.parse(saved.meta);
  meta.difficulty = 'nightmare';
  meta.hunger = 'lots';
  meta.quests = ['wood', 42, 'not-a-quest', 'wood'];
  meta.stats = { collected: { 5: -3, 65: 2 }, maxDepth: 'deep' };
  const loaded = deserializeGame({ meta: JSON.stringify(meta), tiles: saved.tiles });
  assert.equal(loaded.difficulty, 'normal');
  assert.equal(loaded.survival.hunger, 10);
  assert.deepEqual(loaded.quests, ['wood']);
  assert.deepEqual(loaded.stats.collected, { 65: 2 });
  assert.equal(loaded.stats.maxDepth, 0);
});

test('crystal generation is deterministic and stays in the deep layer', () => {
  const a = generateWorld(20261018).world;
  const b = generateWorld(20261018).world;
  assert.deepEqual(a.fg, b.fg);
  const { top, bottom } = crystalLayer(a.height);
  let count = 0;
  for (let i = 0; i < a.fg.length; i++) {
    if (a.fg[i] !== Block.CrystalOre) continue;
    count++;
    const y = Math.floor(i / a.width);
    assert.ok(y >= top && y <= bottom, `crystal at row ${y}`);
  }
  const other = generateWorld(20261019).world;
  assert.notDeepEqual(other.fg, a.fg);
  assert.ok(count >= 20, `only ${count} crystals`);
});

test('every world has enough crystals to build the beacon', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const { world } = generateWorld(seed * 7919);
    let count = 0;
    for (const id of world.fg) if (id === Block.CrystalOre) count++;
    assert.ok(count >= 20, `seed ${seed * 7919}: ${count} crystals`);
  }
});

test('worlds have berry bushes on grass for food', () => {
  const { world } = generateWorld(555);
  let bushes = 0;
  for (let i = 0; i < world.fg.length; i++) {
    if (world.fg[i] !== Block.BerryBush) continue;
    bushes++;
    assert.equal(world.fg[i + world.width], Block.Grass);
  }
  assert.ok(bushes >= 3);
});

test('the tutorial advances step by step and ignores unrelated actions', () => {
  let step: TutorialStep = 'walk';
  step = advanceTutorial(step, { type: 'jumped' });
  assert.equal(step, 'walk');
  step = advanceTutorial(step, { type: 'walked', tiles: 1 });
  assert.equal(step, 'walk');
  step = advanceTutorial(step, { type: 'walked', tiles: 3 });
  assert.equal(step, 'jump');
  step = advanceTutorial(step, { type: 'jumped' });
  step = advanceTutorial(step, { type: 'mined' });
  step = advanceTutorial(step, { type: 'selected' });
  step = advanceTutorial(step, { type: 'placed', block: Block.Dirt });
  assert.equal(step, 'inventory');
  step = advanceTutorial(step, { type: 'crafted', recipe: 'planks' });
  assert.equal(step, 'inventory', 'crafting before opening the bag does not skip ahead');
  step = advanceTutorial(step, { type: 'inventory-opened' });
  step = advanceTutorial(step, { type: 'crafted', recipe: 'sticks' });
  assert.equal(step, 'planks');
  step = advanceTutorial(step, { type: 'crafted', recipe: 'planks' });
  step = advanceTutorial(step, { type: 'crafted', recipe: 'sticks' });
  step = advanceTutorial(step, { type: 'crafted', recipe: 'wood_pickaxe' });
  assert.equal(step, 'torch');
  step = advanceTutorial(step, { type: 'placed', block: Block.Dirt });
  assert.equal(step, 'torch');
  step = advanceTutorial(step, { type: 'placed', block: Block.Torch });
  assert.equal(step, 'done');
  assert.equal(advanceTutorial('done', { type: 'jumped' }), 'done');
  assert.deepEqual(tutorialPosition('walk'), { index: 1, total: TUTORIAL_STEPS.length - 1 });
});
