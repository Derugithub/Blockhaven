/** One full day and night, in seconds of play. */
export const DAY_SECONDS = 480;

/** New worlds start mid-morning. */
export const START_TIME = DAY_SECONDS * 0.08;

/** Phase in [0, 1): 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight. */
export function dayPhase(time: number): number {
  const p = (time % DAY_SECONDS) / DAY_SECONDS;
  return p < 0 ? p + 1 : p;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Sky light strength in [0.12, 1]. */
export function daylight(time: number): number {
  const sun = Math.sin(dayPhase(time) * Math.PI * 2);
  const t = clamp01((sun + 0.2) / 0.5);
  return 0.12 + 0.88 * t * t * (3 - 2 * t);
}

export function isNight(time: number): boolean {
  return daylight(time) < 0.4;
}

type Rgb = [number, number, number];
const NIGHT: Rgb = [12, 18, 42];
const DAY: Rgb = [122, 186, 240];
const DUSK: Rgb = [236, 150, 104];

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Sky colour as [r, g, b] in 0-255. Warm near sunrise and sunset. */
export function skyColor(time: number): Rgb {
  const light = (daylight(time) - 0.12) / 0.88;
  const sun = Math.sin(dayPhase(time) * Math.PI * 2);
  const base = mix(NIGHT, DAY, light);
  const warmth = Math.max(0, 1 - Math.abs(sun) / 0.3) * 0.55;
  return mix(base, DUSK, warmth).map(Math.round) as Rgb;
}

/** Clock label like "07:30" where 06:00 is sunrise. */
export function clockLabel(time: number): string {
  const minutes = Math.floor(((dayPhase(time) * 24 + 6) % 24) * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m - (m % 10)).padStart(2, '0')}`;
}
