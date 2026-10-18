/**
 * Block and item catalogue. Block ids are stored in the world byte arrays, so they must stay
 * stable across save versions. Items 1-63 are placeable blocks; 64+ are plain items and tools.
 */
export const Block = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Sand: 4,
  Wood: 5,
  Leaves: 6,
  CoalOre: 7,
  IronOre: 8,
  Bedrock: 9,
  Planks: 10,
  Torch: 11,
  BerryBush: 12,
  CrystalOre: 13,
  Beacon: 14,
} as const;

export type BlockId = (typeof Block)[keyof typeof Block];

export const Item = {
  ...Block,
  Stick: 64,
  Coal: 65,
  RawIron: 66,
  Berries: 67,
  Apple: 68,
  Crystal: 69,
  BerryPie: 70,
  WoodPickaxe: 80,
  StonePickaxe: 81,
  IronPickaxe: 82,
  WoodSword: 83,
  StoneSword: 84,
} as const;

export type ItemId = (typeof Item)[keyof typeof Item];

export type BlockInfo = {
  name: string;
  /** Collides with the player. */
  solid: boolean;
  /** Stops sky light from passing down the column. */
  opaque: boolean;
  /** Seconds to mine with the right tool at tier speed 1. Infinity cannot be mined. */
  hardness: number;
  /** Minimum pickaxe tier needed. 0 means by hand. */
  tier: number;
  /** True when a pickaxe speeds up mining. */
  pickaxe: boolean;
  /** Light radius in tiles, 0 for none. */
  light: number;
};

export const BLOCKS: Record<BlockId, BlockInfo> = {
  [Block.Air]: { name: 'Air', solid: false, opaque: false, hardness: 0, tier: 0, pickaxe: false, light: 0 },
  [Block.Grass]: { name: 'Grass', solid: true, opaque: true, hardness: 0.45, tier: 0, pickaxe: false, light: 0 },
  [Block.Dirt]: { name: 'Dirt', solid: true, opaque: true, hardness: 0.4, tier: 0, pickaxe: false, light: 0 },
  [Block.Stone]: { name: 'Stone', solid: true, opaque: true, hardness: 1.2, tier: 1, pickaxe: true, light: 0 },
  [Block.Sand]: { name: 'Sand', solid: true, opaque: true, hardness: 0.35, tier: 0, pickaxe: false, light: 0 },
  [Block.Wood]: { name: 'Log', solid: true, opaque: true, hardness: 1.0, tier: 0, pickaxe: false, light: 0 },
  [Block.Leaves]: { name: 'Leaves', solid: true, opaque: false, hardness: 0.15, tier: 0, pickaxe: false, light: 0 },
  [Block.CoalOre]: { name: 'Coal ore', solid: true, opaque: true, hardness: 1.5, tier: 1, pickaxe: true, light: 0 },
  [Block.IronOre]: { name: 'Iron ore', solid: true, opaque: true, hardness: 2.0, tier: 2, pickaxe: true, light: 0 },
  [Block.Bedrock]: { name: 'Bedrock', solid: true, opaque: true, hardness: Infinity, tier: 99, pickaxe: true, light: 0 },
  [Block.Planks]: { name: 'Planks', solid: true, opaque: true, hardness: 0.9, tier: 0, pickaxe: false, light: 0 },
  [Block.Torch]: { name: 'Torch', solid: false, opaque: false, hardness: 0.05, tier: 0, pickaxe: false, light: 7 },
  [Block.BerryBush]: { name: 'Berry bush', solid: false, opaque: false, hardness: 0.2, tier: 0, pickaxe: false, light: 0 },
  [Block.CrystalOre]: { name: 'Crystal ore', solid: true, opaque: true, hardness: 2.4, tier: 3, pickaxe: true, light: 3 },
  [Block.Beacon]: { name: 'Haven Beacon', solid: true, opaque: true, hardness: 1.5, tier: 0, pickaxe: false, light: 10 },
};

export const BLOCK_IDS = Object.keys(BLOCKS).map(Number) as BlockId[];

export function blockInfo(id: number): BlockInfo {
  return BLOCKS[id as BlockId] ?? BLOCKS[Block.Air];
}

export function isBlockId(id: number): id is BlockId {
  return id in BLOCKS;
}

export const ITEM_NAMES: Record<ItemId, string> = {
  [Item.Air]: '',
  [Item.Grass]: 'Grass',
  [Item.Dirt]: 'Dirt',
  [Item.Stone]: 'Stone',
  [Item.Sand]: 'Sand',
  [Item.Wood]: 'Log',
  [Item.Leaves]: 'Leaves',
  [Item.CoalOre]: 'Coal ore',
  [Item.IronOre]: 'Iron ore',
  [Item.Bedrock]: 'Bedrock',
  [Item.Planks]: 'Planks',
  [Item.Torch]: 'Torch',
  [Item.BerryBush]: 'Berry bush',
  [Item.CrystalOre]: 'Crystal ore',
  [Item.Beacon]: 'Haven Beacon',
  [Item.Stick]: 'Stick',
  [Item.Coal]: 'Coal',
  [Item.RawIron]: 'Raw iron',
  [Item.Berries]: 'Berries',
  [Item.Apple]: 'Apple',
  [Item.Crystal]: 'Crystal',
  [Item.BerryPie]: 'Berry pie',
  [Item.WoodPickaxe]: 'Wooden pickaxe',
  [Item.StonePickaxe]: 'Stone pickaxe',
  [Item.IronPickaxe]: 'Iron pickaxe',
  [Item.WoodSword]: 'Wooden sword',
  [Item.StoneSword]: 'Stone sword',
};

export function itemName(id: number): string {
  return ITEM_NAMES[id as ItemId] ?? 'Unknown';
}

export function isKnownItem(id: number): boolean {
  return id !== 0 && id in ITEM_NAMES;
}

/** Items that can be put into the world. Bedrock never drops, so it is never placeable in practice. */
export function isPlaceable(item: number): boolean {
  return item > 0 && item < 64 && item !== Block.Bedrock && isBlockId(item);
}

/** Pickaxe tier an item grants, 0 when it is not a pickaxe. */
export function pickaxeTier(item: number): number {
  if (item === Item.WoodPickaxe) return 1;
  if (item === Item.StonePickaxe) return 2;
  if (item === Item.IronPickaxe) return 3;
  return 0;
}

export function isTool(item: number): boolean {
  return pickaxeTier(item) > 0 || item === Item.WoodSword || item === Item.StoneSword;
}

export function maxStack(item: number): number {
  return isTool(item) ? 1 : 99;
}

/** Hunger restored by eating one, 0 when the item is not food. */
export function foodValue(item: number): number {
  if (item === Item.Berries) return 1.5;
  if (item === Item.Apple) return 2.5;
  if (item === Item.BerryPie) return 6;
  return 0;
}

/** Damage one hit deals to a monster with this item in hand. */
export function attackDamage(item: number | null): number {
  if (item === Item.StoneSword) return 5;
  if (item === Item.WoodSword) return 3;
  if (item != null && pickaxeTier(item) > 0) return 2;
  return 1;
}

/** Mining speed multiplier for a pickaxe tier on pickaxe blocks. */
export function tierSpeed(tier: number): number {
  if (tier >= 3) return 2.8;
  if (tier === 2) return 1.8;
  return 1;
}
