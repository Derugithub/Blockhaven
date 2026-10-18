/** Deterministic random helpers. Everything the terrain uses comes from a 32-bit seed. */

/** FNV-1a hash of a string, as an unsigned 32-bit integer. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Turns the seed a player typed into a 32-bit number. Whole numbers are used as-is so "42" and 42
 * give the same world; any other text is hashed.
 */
export function seedFromText(text: string): number {
  const trimmed = text.trim();
  if (/^-?\d{1,15}$/.test(trimmed)) return Number(trimmed) >>> 0;
  return hashString(trimmed);
}

/** Mulberry32: a small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer lattice hash in [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 1D value noise in [0, 1). */
export function noise1(x: number, seed: number): number {
  const ix = Math.floor(x);
  const t = smooth(x - ix);
  const a = hash2(ix, 0, seed);
  const b = hash2(ix + 1, 0, seed);
  return a + (b - a) * t;
}

/** 2D value noise in [0, 1). */
export function noise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const tx = smooth(x - ix);
  const ty = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

/** Fractal 1D noise normalised to [0, 1). */
export function fbm1(x: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise1(x * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Fractal 2D noise normalised to [0, 1). */
export function fbm2(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq, seed + i * 7919) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
