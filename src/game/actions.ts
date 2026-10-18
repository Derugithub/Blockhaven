import { Block, blockInfo, isPlaceable, Item, tierSpeed } from './blocks';
import { addItem, bestPickaxeTier, selectedStack, takeFromSlot, type Inventory } from './inventory';
import { playerCenter, playerOverlapsTile, type Player } from './player';
import { getBg, getFg, inBounds, isSolidAt, setFg, type World } from './world';

/** Reach from the player's centre to a tile centre, in tiles. */
export const REACH = 5.2;

export function withinReach(player: Player, tx: number, ty: number): boolean {
  const c = playerCenter(player);
  const dx = tx + 0.5 - c.x;
  const dy = ty + 0.5 - c.y;
  return dx * dx + dy * dy <= REACH * REACH;
}

/** Seconds to break a block with the given pickaxe tier, or Infinity when the tier is too low. */
export function miningTime(block: number, tier: number): number {
  const info = blockInfo(block);
  if (block === Block.Air || !Number.isFinite(info.hardness)) return Infinity;
  if (tier < info.tier) return Infinity;
  if (info.pickaxe && tier > 0) return info.hardness / tierSpeed(tier);
  return info.hardness;
}

export function canMine(block: number, tier: number): boolean {
  return Number.isFinite(miningTime(block, tier));
}

/** What a broken block gives. `roll` is a random number in [0, 1) for chance drops. */
export function dropFor(block: number, roll: number): { item: number; count: number } | null {
  switch (block) {
    case Block.Grass:
      return { item: Item.Dirt, count: 1 };
    case Block.CoalOre:
      return { item: Item.Coal, count: 1 };
    case Block.IronOre:
      return { item: Item.RawIron, count: 1 };
    case Block.Leaves:
      if (roll < 0.08) return { item: Item.Apple, count: 1 };
      return roll < 0.33 ? { item: Item.Stick, count: 1 } : null;
    case Block.BerryBush:
      return { item: Item.Berries, count: 2 };
    case Block.CrystalOre:
      return { item: Item.Crystal, count: 1 };
    case Block.Air:
    case Block.Bedrock:
      return null;
    default:
      return { item: block, count: 1 };
  }
}

/** A second drop on top of the main one: a berry bush sometimes gives itself back so it can be replanted. */
export function extraDropFor(block: number, roll: number): { item: number; count: number } | null {
  if (block === Block.BerryBush && roll >= 0.5) return { item: Item.BerryBush, count: 1 };
  return null;
}

export type Drop = { item: number; count: number };

export type BreakResult = { ok: true; block: number; drop: Drop | null; extra: Drop | null; lost: number } | { ok: false };

/** Removes a block and puts its drop in the inventory. Torches resting on it are not affected. */
export function breakBlock(world: World, inv: Inventory, tx: number, ty: number, roll = Math.random()): BreakResult {
  const block = getFg(world, tx, ty);
  if (block === Block.Air || block === Block.Bedrock) return { ok: false };
  setFg(world, tx, ty, Block.Air);
  const drop = dropFor(block, roll);
  const extra = extraDropFor(block, roll);
  let lost = drop ? addItem(inv, drop.item, drop.count) : 0;
  if (extra) lost += addItem(inv, extra.item, extra.count);
  return { ok: true, block, drop, extra, lost };
}

/** A block needs something next to it, or a back wall, so it cannot float in open sky. */
export function hasSupport(world: World, tx: number, ty: number): boolean {
  if (getBg(world, tx, ty) !== Block.Air) return true;
  const around = [
    [tx - 1, ty],
    [tx + 1, ty],
    [tx, ty - 1],
    [tx, ty + 1],
  ];
  return around.some(([x, y]) => blockInfo(getFg(world, x, y)).solid);
}

export type PlaceResult = 'placed' | 'occupied' | 'nothing' | 'blocked' | 'unsupported' | 'out';

/** Places the selected hotbar item at a tile. */
export function placeSelected(world: World, inv: Inventory, player: Player, tx: number, ty: number): PlaceResult {
  if (!inBounds(world, tx, ty)) return 'out';
  if (getFg(world, tx, ty) !== Block.Air) return 'occupied';
  const stack = selectedStack(inv);
  if (!stack || !isPlaceable(stack.item)) return 'nothing';
  const item = stack.item;
  if (blockInfo(item).solid && playerOverlapsTile(player, tx, ty)) return 'blocked';
  if (item === Block.Torch) {
    const wall = getBg(world, tx, ty) !== Block.Air;
    const side = isSolidAt(world, tx - 1, ty) || isSolidAt(world, tx + 1, ty) || isSolidAt(world, tx, ty + 1);
    if (!wall && !side) return 'unsupported';
  } else if (item === Block.BerryBush) {
    const below = getFg(world, tx, ty + 1);
    if (below !== Block.Grass && below !== Block.Dirt) return 'unsupported';
  } else if (!hasSupport(world, tx, ty)) {
    return 'unsupported';
  }
  takeFromSlot(inv, inv.selected);
  setFg(world, tx, ty, item);
  return 'placed';
}

export function pickaxeTierOf(inv: Inventory): number {
  return bestPickaxeTier(inv);
}
