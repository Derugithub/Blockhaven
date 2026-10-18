import assert from 'node:assert/strict';
import test from 'node:test';

import { Block, Item } from '../src/game/blocks.ts';
import { createGame } from '../src/game/game.ts';
import { addItem } from '../src/game/inventory.ts';
import {
  deserializeGame,
  migrateMeta,
  rleDecode,
  rleEncode,
  SAVE_VERSION,
  serializeGame,
} from '../src/game/save-format.ts';
import { setFg } from '../src/game/world.ts';

test('run-length encoding round-trips', () => {
  const data = new Uint8Array(1000);
  data.fill(3, 100, 700);
  data[999] = 9;
  const encoded = rleEncode(data);
  assert.ok(encoded.length < 40);
  assert.deepEqual(rleDecode(encoded, data.length).bytes, data);
});

test('corrupt or truncated tile data is rejected', () => {
  const encoded = rleEncode(new Uint8Array(500).fill(2));
  assert.throws(() => rleDecode(encoded.subarray(0, encoded.length - 2), 500));
  assert.throws(() => rleDecode(Uint8Array.from([0, 1]), 10));
});

test('a world saves and loads with tiles, player, inventory and time intact', () => {
  const game = createGame(31337);
  setFg(game.world, 10, 10, Block.Torch);
  setFg(game.world, 11, 10, Block.Planks);
  addItem(game.inventory, Item.StonePickaxe, 1);
  addItem(game.inventory, Item.Torch, 12);
  game.inventory.selected = 1;
  game.player.x = 42.5;
  game.player.y = 30.25;
  game.player.health = 7;
  game.player.facing = -1;
  game.time = 1234.5;

  const saved = serializeGame(game);
  assert.ok(saved.tiles.length < game.world.fg.length, 'tiles should compress');
  const loaded = deserializeGame({ meta: saved.meta, tiles: new Uint8Array(saved.tiles) });

  assert.deepEqual(loaded.world.fg, game.world.fg);
  assert.deepEqual(loaded.world.bg, game.world.bg);
  assert.deepEqual(loaded.world.skyTop, game.world.skyTop);
  assert.equal(loaded.player.x, 42.5);
  assert.equal(loaded.player.y, 30.25);
  assert.equal(loaded.player.health, 7);
  assert.equal(loaded.player.facing, -1);
  assert.equal(loaded.time, 1234.5);
  assert.equal(loaded.seed, 31337);
  assert.equal(loaded.inventory.selected, 1);
  assert.deepEqual(loaded.inventory.slots, game.inventory.slots);
  assert.deepEqual(loaded.spawn, game.spawn);
});

test('the save carries the current format version', () => {
  const meta = JSON.parse(serializeGame(createGame(5)).meta);
  assert.equal(meta.version, SAVE_VERSION);
});

test('saves from a newer version or with no version are refused', () => {
  assert.throws(() => migrateMeta({ version: SAVE_VERSION + 1 }), /newer version/);
  assert.throws(() => migrateMeta({}), /Unsupported/);
  assert.throws(() => migrateMeta(null), /missing/);
});

test('unknown items in a save are dropped instead of crashing', () => {
  const game = createGame(8);
  const saved = serializeGame(game);
  const meta = JSON.parse(saved.meta);
  meta.inventory.slots[0] = [250, 5];
  meta.inventory.slots[1] = [Item.Coal, 3];
  const loaded = deserializeGame({ meta: JSON.stringify(meta), tiles: saved.tiles });
  assert.equal(loaded.inventory.slots[0], null);
  assert.deepEqual(loaded.inventory.slots[1], { item: Item.Coal, count: 3 });
});
