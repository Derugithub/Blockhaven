import { Block, Item } from './blocks';
import { hash2 } from './rng';

/** Every texture is a 16 x 16 RGBA tile drawn from code. No external art is used. */
export const TEX = 16;

type Rgb = [number, number, number];

class Canvas16 {
  readonly px = new Uint8Array(TEX * TEX * 4);

  set(x: number, y: number, c: Rgb, a = 255) {
    if (x < 0 || y < 0 || x >= TEX || y >= TEX) return;
    const i = (y * TEX + x) * 4;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
    this.px[i + 3] = a;
  }

  fill(fn: (x: number, y: number) => Rgb | null) {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const c = fn(x, y);
        if (c) this.set(x, y, c);
      }
    }
  }
}

function shade(c: Rgb, k: number): Rgb {
  return [clamp(c[0] * k), clamp(c[1] * k), clamp(c[2] * k)];
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Picks a slightly varied shade of `c` per pixel, stable for a given salt. */
function speckle(c: Rgb, x: number, y: number, salt: number, spread = 0.14): Rgb {
  const n = hash2(x, y, salt);
  return shade(c, 1 - spread + n * spread * 2);
}

const DIRT: Rgb = [134, 90, 52];
const GRASS: Rgb = [86, 166, 60];
const STONE: Rgb = [128, 134, 142];
const SAND: Rgb = [226, 204, 140];
const BARK: Rgb = [112, 74, 40];
const LEAF: Rgb = [58, 138, 62];
const PLANK: Rgb = [186, 140, 82];
const BEDROCK: Rgb = [58, 58, 66];
const COAL: Rgb = [34, 34, 38];
const IRON: Rgb = [214, 164, 120];
const STICK: Rgb = [140, 96, 50];

function stoneBase(c: Canvas16, salt: number) {
  c.fill((x, y) => {
    const crack = hash2(x >> 1, y >> 1, salt + 3) > 0.86;
    return crack ? shade(STONE, 0.78) : speckle(STONE, x, y, salt, 0.08);
  });
}

function oreSpots(c: Canvas16, color: Rgb, salt: number) {
  const spots = [
    [3, 3],
    [10, 4],
    [5, 10],
    [11, 11],
  ];
  for (const [sx, sy] of spots) {
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        if ((dx === 0 || dx === 2) && (dy === 0 || dy === 2) && hash2(sx + dx, sy + dy, salt) > 0.4) continue;
        c.set(sx + dx, sy + dy, speckle(color, sx + dx, sy + dy, salt, 0.12));
      }
    }
  }
}

function drawLine(c: Canvas16, x0: number, y0: number, x1: number, y1: number, color: Rgb) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    c.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), color);
  }
}

function pickaxe(c: Canvas16, head: Rgb) {
  // Handle from bottom-left towards the head.
  drawLine(c, 3, 13, 10, 6, STICK);
  drawLine(c, 4, 13, 11, 6, shade(STICK, 0.8));
  // Curved head across the top-right.
  const headPixels = [
    [6, 2], [7, 2], [8, 2], [9, 2], [10, 3], [11, 3], [12, 4], [12, 5], [13, 6], [13, 7], [13, 8],
    [7, 3], [8, 3], [9, 3], [10, 4], [11, 4], [11, 5], [12, 6], [12, 7],
  ];
  for (const [x, y] of headPixels) c.set(x, y, speckle(head, x, y, 9, 0.1));
  c.set(5, 2, shade(head, 0.8));
  c.set(13, 9, shade(head, 0.8));
}

/** RGBA pixels for an item or block icon. */
export function texturePixels(id: number): Uint8Array {
  const c = new Canvas16();
  switch (id) {
    case Block.Grass:
      c.fill((x, y) => {
        const edge = 3 + Math.floor(hash2(x, 0, 11) * 3);
        return y < edge ? speckle(GRASS, x, y, 12, 0.12) : speckle(DIRT, x, y, 13);
      });
      break;
    case Block.Dirt:
      c.fill((x, y) => (hash2(x, y, 21) > 0.9 ? shade(DIRT, 0.7) : speckle(DIRT, x, y, 22)));
      break;
    case Block.Stone:
      stoneBase(c, 31);
      break;
    case Block.Sand:
      c.fill((x, y) => (hash2(x, y, 41) > 0.92 ? shade(SAND, 0.85) : speckle(SAND, x, y, 42, 0.06)));
      break;
    case Block.Wood:
      c.fill((x, y) => {
        const stripe = x % 4 === 0 || (x % 4 === 2 && hash2(x, y >> 2, 51) > 0.6);
        return stripe ? shade(BARK, 0.75) : speckle(BARK, x, y, 52, 0.08);
      });
      break;
    case Block.Leaves:
      c.fill((x, y) => {
        const n = hash2(x, y, 61);
        if (n > 0.86) return shade(LEAF, 0.6);
        if (n < 0.12) return shade(LEAF, 1.25);
        return speckle(LEAF, x, y, 62, 0.1);
      });
      break;
    case Block.CoalOre:
      stoneBase(c, 71);
      oreSpots(c, COAL, 72);
      break;
    case Block.IronOre:
      stoneBase(c, 81);
      oreSpots(c, IRON, 82);
      break;
    case Block.Bedrock:
      c.fill((x, y) => (hash2(x >> 1, y >> 1, 91) > 0.55 ? shade(BEDROCK, 0.6) : speckle(BEDROCK, x, y, 92, 0.1)));
      break;
    case Block.Planks:
      c.fill((x, y) => {
        if (y % 4 === 3) return shade(PLANK, 0.72);
        const seam = (x + (y >> 2) * 5) % 8 === 0;
        return seam ? shade(PLANK, 0.8) : speckle(PLANK, x, y, 102, 0.06);
      });
      break;
    case Block.Torch:
      for (let y = 7; y < 16; y++) {
        c.set(7, y, STICK);
        c.set(8, y, shade(STICK, 0.8));
      }
      c.set(7, 6, [255, 236, 140]);
      c.set(8, 6, [255, 236, 140]);
      c.set(7, 5, [255, 196, 64]);
      c.set(8, 5, [255, 170, 40]);
      c.set(6, 5, [255, 150, 40], 200);
      c.set(9, 5, [255, 150, 40], 200);
      c.set(7, 4, [255, 120, 30]);
      c.set(8, 4, [255, 200, 80]);
      c.set(8, 3, [255, 120, 30], 180);
      break;
    case Item.Stick:
      drawLine(c, 4, 12, 11, 3, STICK);
      drawLine(c, 5, 12, 12, 3, shade(STICK, 0.75));
      break;
    case Item.Coal:
    case Item.RawIron: {
      const color = id === Item.Coal ? COAL : IRON;
      c.fill((x, y) => {
        const dx = x - 7.5;
        const dy = y - 8;
        const r = dx * dx * 0.9 + dy * dy * 1.2;
        if (r > 26 + hash2(x, y, 111) * 6) return null;
        return speckle(color, x, y, 112, 0.2);
      });
      break;
    }
    case Item.WoodPickaxe:
      pickaxe(c, PLANK);
      break;
    case Item.StonePickaxe:
      pickaxe(c, STONE);
      break;
    case Item.IronPickaxe:
      pickaxe(c, [226, 228, 232]);
      break;
    default:
      break;
  }
  return c.px;
}

/** Crack overlay for mining progress, stage 0-3. Transparent except the crack lines. */
export function crackPixels(stage: number): Uint8Array {
  const c = new Canvas16();
  const lines: [number, number, number, number][] = [
    [8, 8, 4, 3],
    [8, 8, 13, 5],
    [8, 8, 5, 13],
    [8, 8, 12, 12],
    [4, 3, 1, 6],
    [13, 5, 15, 2],
    [5, 13, 2, 14],
    [12, 12, 14, 15],
  ];
  const count = 2 + stage * 2;
  for (let i = 0; i < Math.min(count, lines.length); i++) {
    const [x0, y0, x1, y1] = lines[i];
    drawLine(c, x0, y0, x1, y1, [20, 20, 24]);
  }
  return c.px;
}

/** Darkens a texture for back walls. */
export function backWallPixels(id: number): Uint8Array {
  const src = texturePixels(id);
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out[i] = clamp(src[i] * 0.45);
    out[i + 1] = clamp(src[i + 1] * 0.45);
    out[i + 2] = clamp(src[i + 2] * 0.5);
    out[i + 3] = src[i + 3];
  }
  return out;
}

/** World atlas layout: row 0 blocks by id, row 1 back walls, row 2 crack stages. */
export const ATLAS_COLUMNS = 12;
export const ATLAS_ROWS = 3;

/** Item ids that have an icon. */
export const ICON_ITEMS = [
  Item.Grass, Item.Dirt, Item.Stone, Item.Sand, Item.Wood, Item.Leaves, Item.CoalOre, Item.IronOre,
  Item.Planks, Item.Torch, Item.Stick, Item.Coal, Item.RawIron, Item.WoodPickaxe, Item.StonePickaxe, Item.IronPickaxe,
];

/** Full atlas pixels, ATLAS_COLUMNS * 16 wide and ATLAS_ROWS * 16 tall. */
export function atlasPixels(): { width: number; height: number; pixels: Uint8Array } {
  const width = ATLAS_COLUMNS * TEX;
  const height = ATLAS_ROWS * TEX;
  const pixels = new Uint8Array(width * height * 4);
  const blit = (src: Uint8Array, col: number, row: number) => {
    for (let y = 0; y < TEX; y++) {
      const dst = ((row * TEX + y) * width + col * TEX) * 4;
      pixels.set(src.subarray(y * TEX * 4, (y + 1) * TEX * 4), dst);
    }
  };
  for (let id = 1; id <= 11; id++) {
    blit(texturePixels(id), id, 0);
    blit(backWallPixels(id), id, 1);
  }
  for (let s = 0; s < 4; s++) blit(crackPixels(s), s, 2);
  return { width, height, pixels };
}
