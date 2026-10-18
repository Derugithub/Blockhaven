#!/usr/bin/env node
/**
 * Writes every Blockhaven sound effect and ambient loop to assets/sounds as small mono WAV files.
 * Everything is synthesised here from noise and tones with a seeded PRNG, so the output is
 * deterministic and owned by the project (no third-party audio). Run: node scripts/generate-sounds.mjs
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
const SFX_RATE = 16000;
const AMBIENT_RATE = 11025;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wav(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Builds a buffer of `seconds` by summing layer functions f(t, i) -> sample. */
function render(seconds, rate, layers) {
  const n = Math.floor(seconds * rate);
  const out = new Float32Array(n);
  for (const layer of layers) layer(out, rate);
  return out;
}

function normalize(buf, peak) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max === 0) return buf;
  const k = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  // Short fades so nothing clicks.
  const fade = Math.min(64, buf.length >> 2);
  for (let i = 0; i < fade; i++) {
    buf[i] *= i / fade;
    buf[buf.length - 1 - i] *= i / fade;
  }
  return buf;
}

const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** Filtered noise burst. lp/hp are one-pole cutoffs in Hz (0 = off). */
function noise({ seed = 1, start = 0, dur, attack = 0.002, decay = 0.05, lp = 0, hp = 0, gain = 1 }) {
  return (out, rate) => {
    const r = rng(seed);
    const a = lp ? 1 - Math.exp((-2 * Math.PI * lp) / rate) : 1;
    const b = hp ? Math.exp((-2 * Math.PI * hp) / rate) : 0;
    let low = 0;
    let prevIn = 0;
    let high = 0;
    const s0 = Math.floor(start * rate);
    const n = Math.floor(dur * rate);
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / rate;
      let v = r() * 2 - 1;
      low += a * (v - low);
      v = low;
      if (hp) {
        high = b * (high + v - prevIn);
        prevIn = v;
        v = high;
      }
      out[s0 + i] += v * env(t, attack, decay) * gain;
    }
  };
}

/** Tone with a linear frequency sweep. */
function tone({ f0, f1 = f0, start = 0, dur, attack = 0.004, decay = 0.08, gain = 1, shape = 'sine', vibrato = 0, vibratoRate = 0 }) {
  return (out, rate) => {
    let phase = 0;
    const s0 = Math.floor(start * rate);
    const n = Math.floor(dur * rate);
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / rate;
      const f = f0 + (f1 - f0) * (t / dur) + (vibrato ? Math.sin(2 * Math.PI * vibratoRate * t) * vibrato : 0);
      phase += (2 * Math.PI * f) / rate;
      let v = Math.sin(phase);
      if (shape === 'square') v = v >= 0 ? 0.6 : -0.6;
      else if (shape === 'triangle') v = (2 / Math.PI) * Math.asin(Math.sin(phase));
      out[s0 + i] += v * env(t, attack, decay) * gain;
    }
  };
}

const sfx = {};
const variant = (name, seed, make) => (sfx[name] = make(seed));

// Footsteps, two variants per surface.
for (const v of [1, 2]) {
  variant(`step_soft_${v}`, 10 + v, (s) => [render(0.09, SFX_RATE, [noise({ seed: s, dur: 0.09, decay: 0.025, lp: 900 }), noise({ seed: s + 5, dur: 0.05, decay: 0.012, lp: 2500, hp: 600, gain: 0.3 })]), 0.5]);
  variant(`step_stone_${v}`, 20 + v, (s) => [render(0.07, SFX_RATE, [noise({ seed: s, dur: 0.07, decay: 0.012, lp: 4000, hp: 800 }), tone({ f0: 700 + v * 90, dur: 0.05, decay: 0.012, gain: 0.25 })]), 0.45]);
  variant(`step_sand_${v}`, 30 + v, (s) => [render(0.13, SFX_RATE, [noise({ seed: s, dur: 0.13, attack: 0.015, decay: 0.04, lp: 5000, hp: 1500 })]), 0.35]);
  variant(`step_wood_${v}`, 40 + v, (s) => [render(0.1, SFX_RATE, [tone({ f0: 190 + v * 25, f1: 150, dur: 0.1, decay: 0.03 }), noise({ seed: s, dur: 0.04, decay: 0.01, lp: 2000, gain: 0.4 })]), 0.5]);
}

// Digging hits and breaks per material.
sfx.dig_soft = [render(0.1, SFX_RATE, [noise({ seed: 51, dur: 0.1, decay: 0.03, lp: 1200 })]), 0.55];
sfx.dig_stone = [render(0.09, SFX_RATE, [noise({ seed: 52, dur: 0.09, decay: 0.015, lp: 6000, hp: 900 }), tone({ f0: 1250, f1: 1100, dur: 0.07, decay: 0.02, gain: 0.35 })]), 0.55];
sfx.dig_wood = [render(0.1, SFX_RATE, [tone({ f0: 230, f1: 170, dur: 0.1, decay: 0.035 }), noise({ seed: 53, dur: 0.05, decay: 0.012, lp: 2500, gain: 0.5 })]), 0.55];
sfx.dig_leaves = [render(0.12, SFX_RATE, [noise({ seed: 54, dur: 0.12, attack: 0.01, decay: 0.04, lp: 7000, hp: 2000 })]), 0.4];
sfx.break_soft = [render(0.22, SFX_RATE, [noise({ seed: 61, dur: 0.22, decay: 0.07, lp: 900 }), noise({ seed: 62, start: 0.03, dur: 0.12, decay: 0.04, lp: 3000, hp: 800, gain: 0.3 })]), 0.65];
sfx.break_stone = [render(0.25, SFX_RATE, [noise({ seed: 63, dur: 0.25, decay: 0.06, lp: 5000, hp: 500 }), tone({ f0: 420, f1: 260, dur: 0.18, decay: 0.05, gain: 0.4, shape: 'triangle' }), noise({ seed: 64, start: 0.06, dur: 0.1, decay: 0.03, lp: 7000, hp: 2000, gain: 0.3 })]), 0.65];
sfx.break_wood = [render(0.25, SFX_RATE, [tone({ f0: 160, f1: 90, dur: 0.22, decay: 0.07 }), noise({ seed: 65, dur: 0.12, decay: 0.03, lp: 2500, gain: 0.6 }), noise({ seed: 66, start: 0.07, dur: 0.08, decay: 0.02, lp: 3000, gain: 0.35 })]), 0.65];
sfx.break_leaves = [render(0.2, SFX_RATE, [noise({ seed: 67, dur: 0.2, attack: 0.01, decay: 0.06, lp: 8000, hp: 2500 })]), 0.45];

sfx.place = [render(0.12, SFX_RATE, [tone({ f0: 140, f1: 90, dur: 0.12, decay: 0.035 }), noise({ seed: 71, dur: 0.05, decay: 0.012, lp: 1500, gain: 0.6 })]), 0.6];
sfx.jump = [render(0.1, SFX_RATE, [tone({ f0: 260, f1: 430, dur: 0.1, decay: 0.05, gain: 0.5, shape: 'triangle' }), noise({ seed: 72, dur: 0.05, decay: 0.015, lp: 1500, gain: 0.3 })]), 0.3];
sfx.land = [render(0.12, SFX_RATE, [tone({ f0: 110, f1: 60, dur: 0.12, decay: 0.03 }), noise({ seed: 73, dur: 0.08, decay: 0.02, lp: 800, gain: 0.7 })]), 0.5];
sfx.torch_place = [render(0.35, SFX_RATE, [noise({ seed: 74, dur: 0.3, attack: 0.04, decay: 0.12, lp: 1800, hp: 200 }), noise({ seed: 75, start: 0.12, dur: 0.02, decay: 0.004, lp: 6000, hp: 1500, gain: 0.5 }), noise({ seed: 76, start: 0.2, dur: 0.02, decay: 0.004, lp: 6000, hp: 1500, gain: 0.4 })]), 0.45];
sfx.crackle = [
  render(0.8, SFX_RATE, [
    noise({ seed: 77, dur: 0.8, attack: 0.2, decay: 0.4, lp: 600, gain: 0.2 }),
    ...[0.05, 0.19, 0.27, 0.44, 0.58, 0.7].map((start, i) =>
      noise({ seed: 80 + i, start, dur: 0.02, decay: 0.004, lp: 7000, hp: 1800, gain: 0.5 + (i % 3) * 0.2 }),
    ),
  ]),
  0.35,
];
sfx.craft = [render(0.32, SFX_RATE, [tone({ f0: 210, f1: 160, dur: 0.08, decay: 0.03 }), noise({ seed: 91, dur: 0.04, decay: 0.01, lp: 2500, gain: 0.4 }), tone({ f0: 210, f1: 160, start: 0.11, dur: 0.08, decay: 0.03 }), tone({ f0: 660, start: 0.2, dur: 0.12, decay: 0.05, gain: 0.35, shape: 'triangle' }), tone({ f0: 880, start: 0.24, dur: 0.08, decay: 0.04, gain: 0.25, shape: 'triangle' })]), 0.55];
sfx.pickup = [render(0.09, SFX_RATE, [tone({ f0: 620, f1: 1240, dur: 0.09, decay: 0.04, shape: 'triangle' })]), 0.35];
sfx.quest = [render(0.75, SFX_RATE, [523, 659, 784, 1047].map((f, i) => tone({ f0: f, start: i * 0.11, dur: 0.4, decay: 0.16, shape: 'triangle', gain: i === 3 ? 0.9 : 0.7 }))), 0.6];
sfx.hurt = [render(0.18, SFX_RATE, [tone({ f0: 380, f1: 180, dur: 0.18, decay: 0.07, shape: 'square', gain: 0.5 }), noise({ seed: 92, dur: 0.06, decay: 0.02, lp: 1200, gain: 0.5 })]), 0.5];
sfx.monster_growl = [render(0.6, SFX_RATE, [tone({ f0: 95, f1: 70, dur: 0.6, attack: 0.08, decay: 0.25, shape: 'square', vibrato: 14, vibratoRate: 9, gain: 0.6 }), noise({ seed: 93, dur: 0.55, attack: 0.08, decay: 0.2, lp: 500, gain: 0.5 })]), 0.45];
sfx.monster_hit = [render(0.16, SFX_RATE, [noise({ seed: 94, dur: 0.1, decay: 0.025, lp: 1500, gain: 0.8 }), tone({ f0: 520, f1: 300, start: 0.02, dur: 0.12, decay: 0.04, shape: 'square', gain: 0.4 })]), 0.55];
sfx.monster_die = [render(0.45, SFX_RATE, [noise({ seed: 95, dur: 0.45, attack: 0.01, decay: 0.15, lp: 2500, hp: 200 }), tone({ f0: 300, f1: 60, dur: 0.4, decay: 0.15, shape: 'triangle', gain: 0.5 })]), 0.5];
sfx.eat = [render(0.42, SFX_RATE, [0, 0.14, 0.28].map((start, i) => noise({ seed: 96 + i, start, dur: 0.09, decay: 0.025, lp: 3000, hp: 400 }))), 0.5];
sfx.swing = [render(0.13, SFX_RATE, [noise({ seed: 99, dur: 0.13, attack: 0.04, decay: 0.04, lp: 3000, hp: 700 })]), 0.3];
sfx.win = [
  render(1.6, SFX_RATE, [
    ...[523, 659, 784].map((f, i) => tone({ f0: f, start: i * 0.14, dur: 0.3, decay: 0.12, shape: 'triangle' })),
    ...[1047, 1319, 1568].map((f) => tone({ f0: f, start: 0.45, dur: 1.1, attack: 0.02, decay: 0.45, shape: 'triangle', gain: 0.55, vibrato: 4, vibratoRate: 6 })),
    noise({ seed: 100, start: 0.45, dur: 0.9, attack: 0.05, decay: 0.3, lp: 9000, hp: 5000, gain: 0.12 }),
  ]),
  0.6,
];

/** A loop whose last half second is crossfaded into its start so it repeats seamlessly. */
function loop(seconds, rate, layers) {
  const xf = 0.5;
  const raw = render(seconds + xf, rate, layers);
  const n = Math.floor(seconds * rate);
  const m = Math.floor(xf * rate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = raw[i];
  for (let i = 0; i < m; i++) {
    const k = i / m;
    out[i] = raw[n + i] * (1 - k) + raw[i] * k;
  }
  return out;
}

function wind(seed, gain, period) {
  return (out, rate) => {
    const r = rng(seed);
    let low = 0;
    let low2 = 0;
    const a = 1 - Math.exp((-2 * Math.PI * 350) / rate);
    for (let i = 0; i < out.length; i++) {
      const t = i / rate;
      low += a * (r() * 2 - 1 - low);
      low2 += a * (low - low2);
      const swell = 0.55 + 0.45 * Math.sin((2 * Math.PI * t) / period) * Math.sin((2 * Math.PI * t * 2) / period + 1);
      out[i] += low2 * swell * gain;
    }
  };
}

const ambientDay = loop(6, AMBIENT_RATE, [
  wind(201, 1.6, 6),
  ...[0.7, 0.85, 2.9, 3.02, 4.6].map((start, i) => tone({ f0: 2600 + i * 180, f1: 3300 - i * 120, start, dur: 0.09, attack: 0.01, decay: 0.03, gain: 0.08 })),
]);
const ambientNight = loop(6, AMBIENT_RATE, [
  wind(202, 1.1, 6),
  (out, rate) => {
    // Crickets: short 4.1 kHz pulse trains.
    const chirps = [0.3, 1.1, 1.9, 2.6, 3.5, 4.2, 5.0, 5.6];
    for (const c of chirps) {
      for (let p = 0; p < 4; p++) {
        const s0 = Math.floor((c + p * 0.028) * rate);
        const n = Math.floor(0.014 * rate);
        for (let i = 0; i < n && s0 + i < out.length; i++) {
          const t = i / rate;
          out[s0 + i] += Math.sin(2 * Math.PI * 4100 * t) * Math.sin((Math.PI * i) / n) * 0.05;
        }
      }
    }
  },
]);

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, [buf, peak]] of Object.entries(sfx)) {
  const file = wav(normalize(buf, peak), SFX_RATE);
  writeFileSync(join(OUT, `${name}.wav`), file);
  total += file.length;
}
for (const [name, buf] of [
  ['ambient_day', ambientDay],
  ['ambient_night', ambientNight],
]) {
  const file = wav(normalize(buf, 0.35), AMBIENT_RATE);
  writeFileSync(join(OUT, `${name}.wav`), file);
  total += file.length;
}
console.log(`Wrote ${Object.keys(sfx).length + 2} sounds, ${(total / 1024).toFixed(0)} KB, to ${OUT}`);
