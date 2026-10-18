import { Block } from './blocks';
import { fbm1, fbm2, hash2, mulberry32, noise2 } from './rng';
import { createEmptyWorld, refreshSky, WORLD_HEIGHT, WORLD_WIDTH, type World } from './world';

export type GeneratedWorld = {
  world: World;
  spawnX: number;
  spawnY: number;
};

/** Surface row for a column. Shared by generation and tests. */
export function surfaceHeight(x: number, seed: number, height = WORLD_HEIGHT): number {
  const base = height * 0.36;
  const hills = (fbm1(x / 48, seed, 4) - 0.5) * 26;
  const bumps = (fbm1(x / 9, seed ^ 0x9e3779b9, 2) - 0.5) * 5;
  return Math.max(8, Math.min(height - 40, Math.round(base + hills + bumps)));
}

/**
 * Generates a finite world from a seed. The same seed and size always give the same tiles.
 * Layers from the top: air, grass (or sand), dirt, stone with caves and ores, bedrock.
 */
export function generateWorld(seed: number, width = WORLD_WIDTH, height = WORLD_HEIGHT): GeneratedWorld {
  const world = createEmptyWorld(width, height);
  const { fg, bg } = world;
  const surface = new Int16Array(width);
  const spawnX = Math.floor(width / 2);

  for (let x = 0; x < width; x++) {
    const surf = surfaceHeight(x, seed, height);
    surface[x] = surf;
    const desert = fbm1(x / 70, seed ^ 0x51ed270b, 2) > 0.72;
    const dirtDepth = 3 + Math.floor(hash2(x, 1, seed) * 3);

    for (let y = surf; y < height; y++) {
      const i = y * width + x;
      let id: number;
      if (y === surf) id = desert ? Block.Sand : Block.Grass;
      else if (y <= surf + dirtDepth) id = desert ? Block.Sand : Block.Dirt;
      else id = Block.Stone;

      if (y >= height - 1) id = Block.Bedrock;
      else if (y === height - 2 && hash2(x, y, seed) < 0.6) id = Block.Bedrock;
      else if (y === height - 3 && hash2(x, y, seed) < 0.25) id = Block.Bedrock;

      fg[i] = id;
      if (y > surf) bg[i] = y <= surf + dirtDepth ? Block.Dirt : Block.Stone;
    }
  }

  // Caves: carve where 2D noise is high, below the dirt layer and above bedrock.
  for (let x = 0; x < width; x++) {
    const surf = surface[x];
    for (let y = surf + 6; y < height - 3; y++) {
      const depth = (y - surf) / height;
      const cave = fbm2(x / 18, y / 11, seed ^ 0x2545f491, 3);
      const threshold = 0.64 - Math.min(0.06, depth * 0.12);
      if (cave > threshold) fg[y * width + x] = Block.Air;
    }
  }

  // Ores sit in stone only, as small clusters.
  for (let x = 0; x < width; x++) {
    const surf = surface[x];
    for (let y = surf + 5; y < height - 2; y++) {
      const i = y * width + x;
      if (fg[i] !== Block.Stone) continue;
      if (noise2(x / 2.5, y / 2.5, seed ^ 0x68e31da4) > 0.82 && hash2(x, y, seed ^ 0x1b56c4e9) < 0.75) {
        fg[i] = Block.CoalOre;
      } else if (y > surf + 18 && noise2(x / 2, y / 2, seed ^ 0x5b9f0c1d) > 0.87) {
        fg[i] = Block.IronOre;
      }
    }
  }

  // Trees on grass, spaced out, never right on the spawn point.
  const rand = mulberry32(seed ^ 0x7f4a7c15);
  let lastTree = -10;
  for (let x = 3; x < width - 3; x++) {
    const roll = rand();
    if (Math.abs(x - spawnX) <= 2) continue;
    if (x - lastTree < 5 || roll > 0.16) continue;
    const surf = surface[x];
    if (fg[surf * width + x] !== Block.Grass) continue;
    const trunk = 4 + Math.floor(rand() * 3);
    const topY = surf - trunk;
    if (topY < 4) continue;
    for (let y = surf - 1; y >= topY; y--) fg[y * width + x] = Block.Wood;
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) === 2 && (dy === -2 || dy === 1)) continue;
        const lx = x + dx;
        const ly = topY + dy;
        if (lx < 0 || lx >= width || ly < 0) continue;
        const li = ly * width + lx;
        if (fg[li] === Block.Air) fg[li] = Block.Leaves;
      }
    }
    lastTree = x;
  }

  refreshSky(world);
  // Feet stand on the surface tile; the player box top is 2 rows higher.
  return { world, spawnX: spawnX + 0.15, spawnY: surface[spawnX] - 1.8 };
}
