import assert from 'node:assert/strict';
import test from 'node:test';

import { Item } from '../src/game/blocks.ts';
import { craft, findRecipe, hasIngredients } from '../src/game/crafting.ts';
import { addItem, bestPickaxeTier, countItem, createInventory, INVENTORY_SIZE, moveSlot } from '../src/game/inventory.ts';

test('a log becomes four planks', () => {
  const inv = createInventory();
  addItem(inv, Item.Wood, 1);
  assert.equal(craft(inv, findRecipe('planks')!), 'crafted');
  assert.equal(countItem(inv, Item.Wood), 0);
  assert.equal(countItem(inv, Item.Planks), 4);
});

test('full tool chain from logs to an iron pickaxe', () => {
  const inv = createInventory();
  addItem(inv, Item.Wood, 3);
  addItem(inv, Item.Stone, 3);
  addItem(inv, Item.RawIron, 3);
  addItem(inv, Item.Coal, 1);
  for (let i = 0; i < 3; i++) assert.equal(craft(inv, findRecipe('planks')!), 'crafted');
  assert.equal(countItem(inv, Item.Planks), 12);
  for (let i = 0; i < 2; i++) assert.equal(craft(inv, findRecipe('sticks')!), 'crafted');
  assert.equal(countItem(inv, Item.Stick), 8);
  assert.equal(craft(inv, findRecipe('wood_pickaxe')!), 'crafted');
  assert.equal(bestPickaxeTier(inv), 1);
  assert.equal(craft(inv, findRecipe('stone_pickaxe')!), 'crafted');
  assert.equal(bestPickaxeTier(inv), 2);
  assert.equal(craft(inv, findRecipe('iron_pickaxe')!), 'crafted');
  assert.equal(bestPickaxeTier(inv), 3);
  assert.equal(craft(inv, findRecipe('torches')!), 'crafted');
  assert.equal(countItem(inv, Item.Torch), 4);
  assert.equal(countItem(inv, Item.Stick), 8 - 2 - 2 - 2 - 1);
});

test('crafting without ingredients changes nothing', () => {
  const inv = createInventory();
  addItem(inv, Item.Planks, 1);
  const recipe = findRecipe('sticks')!;
  assert.equal(hasIngredients(inv, recipe), false);
  assert.equal(craft(inv, recipe), 'missing');
  assert.equal(countItem(inv, Item.Planks), 1);
  assert.equal(countItem(inv, Item.Stick), 0);
});

test('crafting into a full inventory is refused and rolled back', () => {
  const inv = createInventory();
  // Fill every slot with full stacks except one log.
  for (let i = 0; i < INVENTORY_SIZE - 1; i++) inv.slots[i] = { item: Item.Dirt, count: 99 };
  inv.slots[INVENTORY_SIZE - 1] = { item: Item.Stick, count: 99 };
  inv.slots[0] = { item: Item.Wood, count: 2 };
  assert.equal(craft(inv, findRecipe('planks')!), 'full');
  assert.equal(countItem(inv, Item.Wood), 2);
});

test('stacks cap at 99 and tools do not stack', () => {
  const inv = createInventory();
  assert.equal(addItem(inv, Item.Dirt, 150), 0);
  assert.equal(inv.slots[0]?.count, 99);
  assert.equal(inv.slots[1]?.count, 51);
  addItem(inv, Item.WoodPickaxe, 2);
  assert.equal(inv.slots[2]?.count, 1);
  assert.equal(inv.slots[3]?.count, 1);
});

test('moving slots swaps or merges', () => {
  const inv = createInventory();
  inv.slots[0] = { item: Item.Dirt, count: 10 };
  inv.slots[5] = { item: Item.Dirt, count: 95 };
  moveSlot(inv, 0, 5);
  assert.equal(inv.slots[5]?.count, 99);
  assert.equal(inv.slots[0]?.count, 6);
  inv.slots[1] = { item: Item.Stone, count: 3 };
  moveSlot(inv, 1, 9);
  assert.equal(inv.slots[1], null);
  assert.deepEqual(inv.slots[9], { item: Item.Stone, count: 3 });
});
