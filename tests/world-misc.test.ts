import assert from 'node:assert/strict';
import test from 'node:test';

import { Block } from '../src/game/blocks.ts';
import { clockLabel, DAY_SECONDS, daylight, isNight, skyColor } from '../src/game/daycycle.ts';
import { computeLight, darknessLevel, LIGHT_LEVELS } from '../src/game/lighting.ts';
import { atlasPixels, ICON_ITEMS, TEX, texturePixels } from '../src/game/textures.ts';
import { createEmptyWorld, refreshSky, setFg } from '../src/game/world.ts';

test('day and night cycle', () => {
  const noon = DAY_SECONDS * 0.25;
  const midnight = DAY_SECONDS * 0.75;
  assert.ok(daylight(noon) > 0.95);
  assert.ok(daylight(midnight) < 0.2);
  assert.equal(isNight(midnight), true);
  assert.equal(isNight(noon), false);
  assert.equal(clockLabel(noon), '12:00');
  assert.equal(clockLabel(0), '06:00');
  assert.notDeepEqual(skyColor(noon), skyColor(midnight));
});

test('torches light up a dark cave', () => {
  const world = createEmptyWorld(32, 32);
  world.fg.fill(Block.Stone);
  for (let x = 5; x < 20; x++) for (let y = 15; y < 18; y++) world.fg[y * 32 + x] = Block.Air;
  refreshSky(world);
  const region = { x0: 0, y0: 0, w: 32, h: 32 };
  const dark = computeLight(world, region, 1, null);
  assert.equal(darknessLevel(dark[16 * 32 + 10]), LIGHT_LEVELS - 1);
  setFg(world, 10, 16, Block.Torch);
  const lit = computeLight(world, region, 1, null);
  assert.ok(lit[16 * 32 + 10] > 0.9);
  assert.ok(lit[16 * 32 + 13] > dark[16 * 32 + 13]);
});

test('sky light reaches the surface and fades underground', () => {
  const world = createEmptyWorld(8, 40);
  for (let x = 0; x < 8; x++) for (let y = 10; y < 40; y++) world.fg[y * 8 + x] = Block.Dirt;
  refreshSky(world);
  const light = computeLight(world, { x0: 0, y0: 0, w: 8, h: 40 }, 1, null);
  assert.equal(light[5 * 8 + 2], 1);
  assert.ok(light[11 * 8 + 2] < 1);
  assert.ok(light[30 * 8 + 2] < 0.1);
});

test('every icon and the atlas are fully drawn from code', () => {
  for (const id of ICON_ITEMS) {
    const px = texturePixels(id);
    assert.equal(px.length, TEX * TEX * 4);
    let opaque = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 0) opaque++;
    assert.ok(opaque > 8, `icon ${id} is empty`);
  }
  const atlas = atlasPixels();
  assert.equal(atlas.pixels.length, atlas.width * atlas.height * 4);
});
