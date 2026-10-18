import { Block, blockInfo } from './blocks';
import type { World } from './world';

export const LIGHT_LEVELS = 8;
const TORCH_RADIUS = 7.5;
const PLAYER_GLOW = 4.2;
const AMBIENT = 0.05;

export type LightRegion = { x0: number; y0: number; w: number; h: number };

/**
 * Light for each tile in a region, 0 (black) to 1 (full). Sky light fades with depth below the
 * first opaque tile of the column and scales with `daylight`; torches and the player add a glow.
 */
export function computeLight(
  world: World,
  region: LightRegion,
  daylight: number,
  glow: { x: number; y: number } | null,
  out?: Float32Array,
): Float32Array {
  const { x0, y0, w, h } = region;
  const light = out && out.length >= w * h ? out : new Float32Array(w * h);

  for (let j = 0; j < h; j++) {
    const y = y0 + j;
    for (let i = 0; i < w; i++) {
      const x = x0 + i;
      let sky = 0;
      if (x >= 0 && x < world.width) {
        const top = world.skyTop[x];
        sky = y < top ? 1 : Math.max(0, 1 - (y - top + 1) * 0.14);
      } else {
        sky = 1;
      }
      light[j * w + i] = Math.max(AMBIENT, sky * daylight);
    }
  }

  const r = Math.ceil(TORCH_RADIUS);
  const sx0 = Math.max(0, x0 - r);
  const sx1 = Math.min(world.width - 1, x0 + w + r);
  const sy0 = Math.max(0, y0 - r);
  const sy1 = Math.min(world.height - 1, y0 + h + r);
  for (let ty = sy0; ty <= sy1; ty++) {
    for (let tx = sx0; tx <= sx1; tx++) {
      const id = world.fg[ty * world.width + tx];
      if (id === Block.Air) continue;
      const radius = blockInfo(id).light;
      if (radius > 0) addGlow(light, region, tx + 0.5, ty + 0.5, radius === 7 ? TORCH_RADIUS : radius, 1);
    }
  }

  if (glow) addGlow(light, region, glow.x, glow.y, PLAYER_GLOW, 0.55);
  return light;
}

function addGlow(light: Float32Array, region: LightRegion, cx: number, cy: number, radius: number, strength: number) {
  const { x0, y0, w, h } = region;
  const ia = Math.max(0, Math.floor(cx - radius) - x0);
  const ib = Math.min(w - 1, Math.ceil(cx + radius) - x0);
  const ja = Math.max(0, Math.floor(cy - radius) - y0);
  const jb = Math.min(h - 1, Math.ceil(cy + radius) - y0);
  for (let j = ja; j <= jb; j++) {
    for (let i = ia; i <= ib; i++) {
      const dx = x0 + i + 0.5 - cx;
      const dy = y0 + j + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= radius) continue;
      const v = strength * (1 - d / radius);
      const k = j * w + i;
      if (v > light[k]) light[k] = v;
    }
  }
}

/** Darkness bucket for the overlay: 0 is fully lit, LIGHT_LEVELS - 1 is darkest. */
export function darknessLevel(light: number): number {
  const dark = 1 - Math.min(1, Math.max(0, light));
  return Math.min(LIGHT_LEVELS - 1, Math.floor(dark * LIGHT_LEVELS));
}
