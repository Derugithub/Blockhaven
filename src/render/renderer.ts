import {
  BlendMode,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  type SkCanvas,
  type SkPaint,
  type SkPathBuilder,
  type SkPicture,
  type SkRSXform,
  type SkRect,
} from '@shopify/react-native-skia';

import { Block } from '@/game/blocks';
import { dayPhase, daylight, skyColor } from '@/game/daycycle';
import type { GameState } from '@/game/game';
import { computeLight, darknessLevel, LIGHT_LEVELS } from '@/game/lighting';
import { PLAYER_HEIGHT, PLAYER_WIDTH } from '@/game/player';
import { TEX } from '@/game/textures';

import { getRenderAssets } from './assets';

export type View = {
  width: number;
  height: number;
  tilePx: number;
  /** Camera top-left in tiles. */
  camX: number;
  camY: number;
};

const SAMPLING = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

/**
 * Draws a frame into an SkPicture. Only tiles inside the view are visited, and all tiles go out in
 * one drawAtlas call, so the cost stays flat however large the world is.
 */
export class WorldRenderer {
  private paint: SkPaint = Skia.Paint();
  private fill: SkPaint = Skia.Paint();
  private stroke: SkPaint = Skia.Paint();
  private darkPaints: SkPaint[] = [];
  private darkPaths: SkPathBuilder[] = [];
  private light: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private sprites: SkRect[] = [];
  private xforms: SkRSXform[] = [];

  constructor() {
    this.stroke.setStyle(PaintStyle.Stroke);
    this.stroke.setStrokeWidth(2);
    this.stroke.setColor(Skia.Color('rgba(255,255,255,0.85)'));
    for (let level = 0; level < LIGHT_LEVELS; level++) {
      const paint = Skia.Paint();
      const alpha = (level / (LIGHT_LEVELS - 1)) * 0.92;
      paint.setColor(Skia.Color(`rgba(4,6,14,${alpha.toFixed(3)})`));
      this.darkPaints.push(paint);
      this.darkPaths.push(Skia.PathBuilder.Make());
    }
  }

  draw(state: GameState, view: View): SkPicture {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, view.width, view.height));
    this.drawInto(canvas, state, view);
    return recorder.finishRecordingAsPicture();
  }

  private drawInto(canvas: SkCanvas, state: GameState, view: View) {
    const { world } = state;
    const { tilePx, camX, camY } = view;
    const assets = getRenderAssets();
    const day = daylight(state.time);

    // Sky, then sun or moon.
    const [r, g, b] = skyColor(state.time);
    canvas.drawColor(Skia.Color(`rgb(${r},${g},${b})`));
    this.drawSunMoon(canvas, state.time, view);

    const x0 = Math.max(0, Math.floor(camX));
    const y0 = Math.max(0, Math.floor(camY));
    const x1 = Math.min(world.width - 1, Math.ceil(camX + view.width / tilePx));
    const y1 = Math.min(world.height - 1, Math.ceil(camY + view.height / tilePx));
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;

    // Tiles.
    const scale = tilePx / TEX;
    const sprites = this.sprites;
    const xforms = this.xforms;
    sprites.length = 0;
    xforms.length = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * world.width;
      const sy = (y - camY) * tilePx;
      for (let x = x0; x <= x1; x++) {
        const fg = world.fg[row + x];
        const sx = (x - camX) * tilePx;
        if (fg !== Block.Air) {
          if (fg === Block.Torch) {
            const bg = world.bg[row + x];
            if (bg !== Block.Air) {
              sprites.push(assets.back[bg]);
              xforms.push(Skia.RSXform(scale, 0, sx, sy));
            }
          }
          sprites.push(assets.front[fg]);
          xforms.push(Skia.RSXform(scale, 0, sx, sy));
        } else {
          const bg = world.bg[row + x];
          if (bg !== Block.Air) {
            sprites.push(assets.back[bg]);
            xforms.push(Skia.RSXform(scale, 0, sx, sy));
          }
        }
      }
    }
    if (sprites.length > 0) {
      canvas.drawAtlas(assets.atlas, sprites, xforms, this.paint, BlendMode.SrcOver, undefined, SAMPLING);
    }

    this.drawPlayer(canvas, state, view);

    // Mining cracks and target outline.
    const mining = state.mining;
    if (mining) {
      const stage = Math.min(3, Math.floor(mining.progress * 4));
      const mx = (mining.x - camX) * tilePx;
      const my = (mining.y - camY) * tilePx;
      canvas.drawAtlas(
        assets.atlas,
        [assets.cracks[stage]],
        [Skia.RSXform(scale, 0, mx, my)],
        this.paint,
        BlendMode.SrcOver,
        undefined,
        SAMPLING,
      );
      canvas.drawRect(Skia.XYWHRect(mx + 1, my + 1, tilePx - 2, tilePx - 2), this.stroke);
    }

    // Darkness: one path per light bucket. Open sky is left alone; its colour already shows the time.
    const center = { x: state.player.x + PLAYER_WIDTH / 2, y: state.player.y + PLAYER_HEIGHT / 2 };
    this.light = computeLight(world, { x0, y0, w, h }, day, center, this.light);
    for (const path of this.darkPaths) path.reset();
    let any = false;
    for (let j = 0; j < h; j++) {
      const y = y0 + j;
      const row = y * world.width;
      for (let i = 0; i < w; i++) {
        const x = x0 + i;
        if (world.fg[row + x] === Block.Air && world.bg[row + x] === Block.Air && y < world.skyTop[x]) continue;
        const level = darknessLevel(this.light[j * w + i]);
        if (level === 0) continue;
        this.darkPaths[level].addRect(Skia.XYWHRect((x - camX) * tilePx, (y - camY) * tilePx, tilePx + 0.5, tilePx + 0.5));
        any = true;
      }
    }
    if (any) {
      for (let level = 1; level < LIGHT_LEVELS; level++) canvas.drawPath(this.darkPaths[level].detach(), this.darkPaints[level]);
    }
  }

  private drawSunMoon(canvas: SkCanvas, time: number, view: View) {
    const phase = dayPhase(time);
    const isDay = phase < 0.5;
    const t = isDay ? phase / 0.5 : (phase - 0.5) / 0.5;
    const size = Math.max(18, view.tilePx * 1.4);
    const x = view.width * (0.08 + 0.84 * t) - size / 2;
    const y = view.height * 0.5 - Math.sin(t * Math.PI) * view.height * 0.38 - size / 2;
    this.fill.setColor(Skia.Color(isDay ? '#FFE27A' : '#E6E9F2'));
    canvas.drawRect(Skia.XYWHRect(x, y, size, size), this.fill);
    if (!isDay) {
      this.fill.setColor(Skia.Color('rgba(180,186,204,0.9)'));
      canvas.drawRect(Skia.XYWHRect(x + size * 0.2, y + size * 0.25, size * 0.2, size * 0.2), this.fill);
      canvas.drawRect(Skia.XYWHRect(x + size * 0.6, y + size * 0.55, size * 0.16, size * 0.16), this.fill);
    }
  }

  private drawPlayer(canvas: SkCanvas, state: GameState, view: View) {
    const { player } = state;
    const t = view.tilePx;
    const px = (player.x - view.camX) * t;
    const py = (player.y - view.camY) * t;
    const pw = PLAYER_WIDTH * t;
    const f = player.facing;
    const swing = Math.sin(player.walkTime * 12) * 0.12 * t;
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      this.fill.setColor(Skia.Color(color));
      canvas.drawRect(Skia.XYWHRect(px + x, py + y, w, h), this.fill);
    };
    // Legs.
    rect(pw * 0.14, t * 1.2 + Math.max(0, swing) * 0.3, pw * 0.32, t * 0.6, '#2E3A62');
    rect(pw * 0.54, t * 1.2 + Math.max(0, -swing) * 0.3, pw * 0.32, t * 0.6, '#27325A');
    // Body and arm.
    rect(pw * 0.08, t * 0.55, pw * 0.84, t * 0.7, '#2F9AA8');
    rect(f > 0 ? pw * 0.62 + swing * 0.4 : pw * 0.08 - swing * 0.4, t * 0.62, pw * 0.3, t * 0.5, '#26808C');
    // Head, hair and eye.
    rect(pw * 0.12, 0, pw * 0.76, t * 0.56, '#E2AE82');
    rect(pw * 0.1, 0, pw * 0.8, t * 0.16, '#3B2A1E');
    rect(f > 0 ? pw * 0.1 : pw * 0.62, 0, pw * 0.28, t * 0.3, '#3B2A1E');
    rect(f > 0 ? pw * 0.62 : pw * 0.26, t * 0.24, pw * 0.12, t * 0.12, '#1A1A22');
  }
}
