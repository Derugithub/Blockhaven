import { Item } from './blocks';
import { addItem, cloneInventory, countItem, removeItem, type Inventory } from './inventory';

export type Ingredient = { item: number; count: number };

/** Crystals needed for the Haven Beacon, the goal of the game. */
export const BEACON_CRYSTALS = 10;

export type Recipe = {
  id: string;
  output: Ingredient;
  inputs: Ingredient[];
};

export const RECIPES: Recipe[] = [
  { id: 'planks', output: { item: Item.Planks, count: 4 }, inputs: [{ item: Item.Wood, count: 1 }] },
  { id: 'sticks', output: { item: Item.Stick, count: 4 }, inputs: [{ item: Item.Planks, count: 2 }] },
  {
    id: 'wood_pickaxe',
    output: { item: Item.WoodPickaxe, count: 1 },
    inputs: [
      { item: Item.Planks, count: 3 },
      { item: Item.Stick, count: 2 },
    ],
  },
  {
    id: 'wood_sword',
    output: { item: Item.WoodSword, count: 1 },
    inputs: [
      { item: Item.Planks, count: 2 },
      { item: Item.Stick, count: 1 },
    ],
  },
  {
    id: 'torches',
    output: { item: Item.Torch, count: 4 },
    inputs: [
      { item: Item.Coal, count: 1 },
      { item: Item.Stick, count: 1 },
    ],
  },
  {
    id: 'stone_pickaxe',
    output: { item: Item.StonePickaxe, count: 1 },
    inputs: [
      { item: Item.Stone, count: 3 },
      { item: Item.Stick, count: 2 },
    ],
  },
  {
    id: 'stone_sword',
    output: { item: Item.StoneSword, count: 1 },
    inputs: [
      { item: Item.Stone, count: 2 },
      { item: Item.Stick, count: 1 },
    ],
  },
  {
    id: 'iron_pickaxe',
    output: { item: Item.IronPickaxe, count: 1 },
    inputs: [
      { item: Item.RawIron, count: 3 },
      { item: Item.Stick, count: 2 },
    ],
  },
  {
    id: 'berry_pie',
    output: { item: Item.BerryPie, count: 1 },
    inputs: [
      { item: Item.Berries, count: 3 },
      { item: Item.Apple, count: 1 },
    ],
  },
  {
    id: 'beacon',
    output: { item: Item.Beacon, count: 1 },
    inputs: [
      { item: Item.Crystal, count: BEACON_CRYSTALS },
      { item: Item.Stone, count: 5 },
    ],
  },
];

export function findRecipe(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}

export function hasIngredients(inv: Inventory, recipe: Recipe): boolean {
  return recipe.inputs.every((input) => countItem(inv, input.item) >= input.count);
}

export type CraftResult = 'crafted' | 'missing' | 'full';

/** Crafts once. The inventory is left untouched when ingredients are missing or the output does not fit. */
export function craft(inv: Inventory, recipe: Recipe): CraftResult {
  if (!hasIngredients(inv, recipe)) return 'missing';
  const trial = cloneInventory(inv);
  for (const input of recipe.inputs) removeItem(trial, input.item, input.count);
  if (addItem(trial, recipe.output.item, recipe.output.count) > 0) return 'full';
  inv.slots = trial.slots;
  return 'crafted';
}
