import assert from 'node:assert/strict';
import test from 'node:test';

import { Block } from '../src/game/blocks.ts';
import { seedFromText } from '../src/game/rng.ts';
import { generateWorld, surfaceHeight } from '../src/game/terrain.ts';
import { getFg, WORLD_HEIGHT, WORLD_WIDTH } from '../src/game/world.ts';

test('the same seed always generates the same world', () => {
  const a = generateWorld(424242);
  const b = generateWorld(424242);
  assert.deepEqual(a.world.fg, b.world.fg);
  assert.deepEqual(a.world.bg, b.world.bg);
  assert.equal(a.spawnX, b.spawnX);
  assert.equal(a.spawnY, b.spawnY);
});

test('different seeds generate different worlds', () => {
  const a = generateWorld(1);
  const b = generateWorld(2);
  assert.notDeepEqual(a.world.fg, b.world.fg);
});

test('text seeds are stable and numeric seeds are used as numbers', () => {
  assert.equal(seedFromText('haven'), seedFromText('haven'));
  assert.notEqual(seedFromText('haven'), seedFromText('Haven'));
  assert.equal(seedFromText('42'), 42);
  assert.equal(seedFromText(' 42 '), 42);
  assert.equal(seedFromText('ብሎክ'), seedFromText('ብሎክ'));
});

test('world is 256 x 128 with a bedrock floor', () => {
  const { world } = generateWorld(7);
  assert.equal(world.width, WORLD_WIDTH);
  assert.equal(world.height, WORLD_HEIGHT);
  for (let x = 0; x < world.width; x++) assert.equal(getFg(world, x, world.height - 1), Block.Bedrock);
});

test('generated worlds contain every natural block type', () => {
  const { world } = generateWorld(2026);
  const seen = new Set(world.fg);
  for (const id of [Block.Grass, Block.Dirt, Block.Stone, Block.Wood, Block.Leaves, Block.CoalOre, Block.IronOre, Block.Bedrock]) {
    assert.ok(seen.has(id), `missing block ${id}`);
  }
  assert.ok(seen.has(Block.Air));
});

test('caves exist underground', () => {
  const { world } = generateWorld(99);
  let caveAir = 0;
  for (let x = 0; x < world.width; x++) {
    const surf = surfaceHeight(x, 99);
    for (let y = surf + 8; y < world.height - 3; y++) if (getFg(world, x, y) === Block.Air) caveAir++;
  }
  assert.ok(caveAir > 200, `expected caves, found ${caveAir} air tiles`);
});

test('spawn point is open air standing on ground', () => {
  for (const seed of [1, 2, 3, 12345, 987654]) {
    const { world, spawnX, spawnY } = generateWorld(seed);
    const tx = Math.floor(spawnX);
    const head = Math.floor(spawnY);
    assert.equal(getFg(world, tx, head), Block.Air);
    assert.equal(getFg(world, tx, head + 1), Block.Air);
    assert.notEqual(getFg(world, tx, head + 2), Block.Air);
  }
});
