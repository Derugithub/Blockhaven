import { Block, blockInfo } from './blocks';

export const WORLD_WIDTH = 256;
export const WORLD_HEIGHT = 128;

/** Tile grid. y = 0 is the top row. `fg` holds blocks, `bg` holds the darker back wall. */
export type World = {
  width: number;
  height: number;
  fg: Uint8Array;
  bg: Uint8Array;
  /** First opaque row per column, used for sky light. Rebuilt with `refreshSkyColumn`. */
  skyTop: Int16Array;
};

export function createEmptyWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT): World {
  return {
    width,
    height,
    fg: new Uint8Array(width * height),
    bg: new Uint8Array(width * height),
    skyTop: new Int16Array(width).fill(height),
  };
}

export function inBounds(world: World, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

export function getFg(world: World, x: number, y: number): number {
  if (!inBounds(world, x, y)) return Block.Air;
  return world.fg[y * world.width + x];
}

export function getBg(world: World, x: number, y: number): number {
  if (!inBounds(world, x, y)) return Block.Air;
  return world.bg[y * world.width + x];
}

export function setFg(world: World, x: number, y: number, id: number): void {
  if (!inBounds(world, x, y)) return;
  world.fg[y * world.width + x] = id;
  refreshSkyColumn(world, x);
}

/** Out of bounds counts as solid on the sides and bottom so the player cannot leave the world. */
export function isSolidAt(world: World, x: number, y: number): boolean {
  if (x < 0 || x >= world.width || y >= world.height) return true;
  if (y < 0) return false;
  return blockInfo(world.fg[y * world.width + x]).solid;
}

export function refreshSkyColumn(world: World, x: number): void {
  let top = world.height;
  for (let y = 0; y < world.height; y++) {
    if (blockInfo(world.fg[y * world.width + x]).opaque) {
      top = y;
      break;
    }
  }
  world.skyTop[x] = top;
}

export function refreshSky(world: World): void {
  for (let x = 0; x < world.width; x++) refreshSkyColumn(world, x);
}
