import assert from 'node:assert/strict';
import test from 'node:test';

import { breakBlock, canMine, miningTime, placeSelected, REACH, withinReach } from '../src/game/actions.ts';
import { Block, Item } from '../src/game/blocks.ts';
import { createGame, stepGame, tapTile, type GameState } from '../src/game/game.ts';
import { addItem, countItem, createInventory } from '../src/game/inventory.ts';
import { createPlayer, MAX_HEALTH, stepPlayer } from '../src/game/player.ts';
import { createEmptyWorld, getFg, refreshSky, setFg, type World } from '../src/game/world.ts';

/** A flat test world: stone floor at row 20, air above. */
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
  // Let the player settle on the floor.
  for (let i = 0; i < 30; i++) stepGame(game, { left: false, right: false, jump: false }, 1 / 60);
  return game;
}

test('the player falls onto the ground and stands on it', () => {
  const game = flatGame();
  assert.ok(game.player.onGround);
  assert.ok(Math.abs(game.player.y + 1.8 - 20) < 0.01);
});

test('walking moves the player and jumping leaves the ground', () => {
  const game = flatGame();
  const startX = game.player.x;
  for (let i = 0; i < 60; i++) stepGame(game, { left: false, right: true, jump: false }, 1 / 60);
  assert.ok(game.player.x > startX + 4);
  stepGame(game, { left: false, right: false, jump: true }, 1 / 60);
  assert.equal(game.player.onGround, false);
});

test('walls stop the player', () => {
  const game = flatGame();
  setFg(game.world, 13, 19, Block.Stone);
  setFg(game.world, 13, 18, Block.Stone);
  for (let i = 0; i < 120; i++) stepGame(game, { left: false, right: true, jump: false }, 1 / 60);
  assert.ok(game.player.x + 0.7 <= 13.0001);
});

test('one-block ledges are stepped up automatically', () => {
  const game = flatGame();
  setFg(game.world, 13, 19, Block.Dirt);
  for (let i = 0; i < 90; i++) stepGame(game, { left: false, right: true, jump: false }, 1 / 60);
  assert.ok(game.player.x > 13, `player stuck at ${game.player.x}`);
});

test('long falls hurt', () => {
  const world = flatWorld();
  const player = createPlayer(10.15, 4);
  for (let i = 0; i < 240; i++) stepPlayer(world, player, { left: false, right: false, jump: false }, 1 / 60);
  assert.ok(player.health < MAX_HEALTH);
});

test('mining needs the right pickaxe tier', () => {
  assert.ok(canMine(Block.Dirt, 0));
  assert.ok(canMine(Block.Wood, 0));
  assert.equal(canMine(Block.Stone, 0), false);
  assert.ok(canMine(Block.Stone, 1));
  assert.equal(canMine(Block.IronOre, 1), false);
  assert.ok(canMine(Block.IronOre, 2));
  assert.equal(canMine(Block.Bedrock, 3), false);
  assert.ok(miningTime(Block.Stone, 2) < miningTime(Block.Stone, 1));
  assert.ok(miningTime(Block.Stone, 3) < miningTime(Block.Stone, 2));
});

test('tapping a block mines it over time and yields the drop', () => {
  const game = flatGame();
  const tx = 11;
  const ty = 20;
  assert.equal(getFg(game.world, tx, ty), Block.Grass);
  tapTile(game, tx, ty);
  assert.ok(game.mining);
  stepGame(game, { left: false, right: false, jump: false }, 0.1);
  assert.equal(getFg(game.world, tx, ty), Block.Grass, 'grass should take longer than 0.1s');
  for (let i = 0; i < 20; i++) stepGame(game, { left: false, right: false, jump: false }, 0.05);
  assert.equal(getFg(game.world, tx, ty), Block.Air);
  assert.equal(countItem(game.inventory, Item.Dirt), 1);
});

test('stone without a pickaxe reports that a tool is needed', () => {
  const game = flatGame();
  setFg(game.world, 11, 19, Block.Stone);
  const events = tapTile(game, 11, 19);
  assert.deepEqual(events, [{ type: 'needs-tool', block: Block.Stone }]);
  assert.equal(game.mining, null);
});

test('ores drop items, not ore blocks', () => {
  const world = flatWorld();
  const inv = createInventory();
  setFg(world, 5, 25, Block.CoalOre);
  setFg(world, 6, 25, Block.IronOre);
  breakBlock(world, inv, 5, 25, 0.5);
  breakBlock(world, inv, 6, 25, 0.5);
  assert.equal(countItem(inv, Item.Coal), 1);
  assert.equal(countItem(inv, Item.RawIron), 1);
  assert.equal(countItem(inv, Item.CoalOre), 0);
});

test('bedrock cannot be broken', () => {
  const world = flatWorld();
  const inv = createInventory();
  setFg(world, 5, 31, Block.Bedrock);
  assert.deepEqual(breakBlock(world, inv, 5, 31), { ok: false });
  assert.equal(getFg(world, 5, 31), Block.Bedrock);
});

test('placing uses the selected hotbar item and needs support', () => {
  const game = flatGame();
  addItem(game.inventory, Item.Planks, 3);
  game.inventory.selected = 0;
  // Next to the floor: supported.
  assert.equal(placeSelected(game.world, game.inventory, game.player, 12, 19), 'placed');
  assert.equal(getFg(game.world, 12, 19), Block.Planks);
  assert.equal(countItem(game.inventory, Item.Planks), 2);
  // Floating in open sky: not supported.
  assert.equal(placeSelected(game.world, game.inventory, game.player, 12, 14), 'unsupported');
  // Occupied tile.
  assert.equal(placeSelected(game.world, game.inventory, game.player, 12, 19), 'occupied');
});

test('blocks cannot be placed inside the player', () => {
  const game = flatGame();
  addItem(game.inventory, Item.Dirt, 1);
  const tx = Math.floor(game.player.x);
  const ty = Math.floor(game.player.y + 1);
  assert.equal(placeSelected(game.world, game.inventory, game.player, tx, ty), 'blocked');
});

test('torches are not solid and can be placed where the player stands', () => {
  const game = flatGame();
  addItem(game.inventory, Item.Torch, 1);
  const tx = Math.floor(game.player.x);
  const ty = Math.floor(game.player.y + 1);
  assert.equal(placeSelected(game.world, game.inventory, game.player, tx, ty), 'placed');
});

test('reach is limited', () => {
  const game = flatGame();
  const cx = Math.floor(game.player.x);
  assert.ok(withinReach(game.player, cx + 2, 20));
  assert.equal(withinReach(game.player, cx + Math.ceil(REACH) + 2, 20), false);
  assert.deepEqual(tapTile(game, cx + 12, 20), [{ type: 'out-of-reach' }]);
});

test('tap on empty space places the selected block through the game API', () => {
  const game = flatGame();
  addItem(game.inventory, Item.Stone, 5);
  const events = tapTile(game, 13, 19);
  assert.deepEqual(events, [{ type: 'placed', block: Block.Stone }]);
  assert.equal(getFg(game.world, 13, 19), Block.Stone);
});
