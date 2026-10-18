import { isKnownItem, maxStack, pickaxeTier } from './blocks';

export const HOTBAR_SIZE = 8;
export const INVENTORY_SIZE = 32;

export type Stack = { item: number; count: number };
export type Slot = Stack | null;

export type Inventory = {
  slots: Slot[];
  /** Index into the hotbar, 0 to HOTBAR_SIZE - 1. */
  selected: number;
};

export function createInventory(): Inventory {
  return { slots: Array.from({ length: INVENTORY_SIZE }, () => null), selected: 0 };
}

export function cloneInventory(inv: Inventory): Inventory {
  return { selected: inv.selected, slots: inv.slots.map((s) => (s ? { ...s } : null)) };
}

export function countItem(inv: Inventory, item: number): number {
  let total = 0;
  for (const slot of inv.slots) if (slot && slot.item === item) total += slot.count;
  return total;
}

/** How many of `item` would fit right now. */
export function spaceFor(inv: Inventory, item: number): number {
  const max = maxStack(item);
  let space = 0;
  for (const slot of inv.slots) {
    if (!slot) space += max;
    else if (slot.item === item) space += max - slot.count;
  }
  return space;
}

/**
 * Adds items, topping up existing stacks first (hotbar first), then empty slots.
 * Returns how many did not fit.
 */
export function addItem(inv: Inventory, item: number, count: number): number {
  if (!isKnownItem(item) || count <= 0) return count;
  const max = maxStack(item);
  let left = count;
  for (const slot of inv.slots) {
    if (left === 0) break;
    if (slot && slot.item === item && slot.count < max) {
      const moved = Math.min(max - slot.count, left);
      slot.count += moved;
      left -= moved;
    }
  }
  for (let i = 0; i < inv.slots.length && left > 0; i++) {
    if (inv.slots[i]) continue;
    const moved = Math.min(max, left);
    inv.slots[i] = { item, count: moved };
    left -= moved;
  }
  return left;
}

/** Removes up to `count`, taking from the back of the inventory first. Returns how many were removed. */
export function removeItem(inv: Inventory, item: number, count: number): number {
  let left = count;
  for (let i = inv.slots.length - 1; i >= 0 && left > 0; i--) {
    const slot = inv.slots[i];
    if (!slot || slot.item !== item) continue;
    const taken = Math.min(slot.count, left);
    slot.count -= taken;
    left -= taken;
    if (slot.count === 0) inv.slots[i] = null;
  }
  return count - left;
}

/** Removes one item from a specific slot. */
export function takeFromSlot(inv: Inventory, index: number): number | null {
  const slot = inv.slots[index];
  if (!slot) return null;
  slot.count -= 1;
  if (slot.count <= 0) inv.slots[index] = null;
  return slot.item;
}

export function selectedStack(inv: Inventory): Slot {
  return inv.slots[inv.selected] ?? null;
}

export function selectSlot(inv: Inventory, index: number): void {
  if (index >= 0 && index < HOTBAR_SIZE) inv.selected = index;
}

/** Swaps two slots, or merges them when both hold the same item. */
export function moveSlot(inv: Inventory, from: number, to: number): void {
  if (from === to) return;
  const a = inv.slots[from];
  const b = inv.slots[to];
  if (a && b && a.item === b.item) {
    const max = maxStack(a.item);
    const moved = Math.min(max - b.count, a.count);
    b.count += moved;
    a.count -= moved;
    if (a.count === 0) inv.slots[from] = null;
    return;
  }
  inv.slots[from] = b;
  inv.slots[to] = a;
}

/** Highest pickaxe tier anywhere in the inventory. Players never have to equip a tool. */
export function bestPickaxeTier(inv: Inventory): number {
  let best = 0;
  for (const slot of inv.slots) if (slot) best = Math.max(best, pickaxeTier(slot.item));
  return best;
}
