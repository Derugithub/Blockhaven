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

import { Block, blockInfo } from '@/game/blocks';
import { dayPhase, daylight, skyColor } from '@/game/daycycle';
import type { GameState } from '@/game/game';
import { computeLight, darknessLevel, LIGHT_LEVELS } from '@/game/lighting';
import { BURN_SECONDS, MONSTER_HEIGHT, MONSTER_WIDTH, type Monster } from '@/game/monsters';
import { PLAYER_HEIGHT, PLAYER_WIDTH, SWING_SECONDS } from '@/game/player';
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

/** Extra things drawn on top of the world. */
export type Overlay = {
  /** Tile to outline with a pulsing frame (tutorial). */
  highlight?: { x: number; y: number } | null;
};

const PLAYER_COLORS = {
  hair: '#3B2A1E',
  skin: '#E2AE82',
  eye: '#1A1A22',
  shirt: '#2F9AA8',
  shirtShade: '#26808C',
  armBack: '#1F6C77',
  legFront: '#2E3A62',
  legBack: '#232C4E',
  shoe: '#3B2A1E',
};

const MONSTER_COLORS = {
  body: '#3E3552',
  shade: '#2E2740',
  limb: '#2A2338',
  mouth: '#1A1524',
};

type Palette = Record<string, Float32Array>;

function palette(colors: Record<string, string>, tint?: [number, number, number, number]): Palette {
  const out: Palette = {};
  for (const [key, value] of Object.entries(colors)) {
    const c = Skia.Color(value);
    if (tint) {
      const k = tint[3];
      c[0] = c[0] * (1 - k) + tint[0] * k;
      c[1] = c[1] * (1 - k) + tint[1] * k;
      c[2] = c[2] * (1 - k) + tint[2] * k;
    }
    out[key] = c;
  }
  return out;
}

const RAD_TO_DEG = 180 / Math.PI;

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
  private playerColors = palette(PLAYER_COLORS);
  private playerHurt = palette(PLAYER_COLORS, [1, 0.25, 0.2, 0.55]);
  private monsterColors = palette(MONSTER_COLORS);
  private monsterHurt = palette(MONSTER_COLORS, [1, 1, 1, 0.6]);
  private monsterBurn = palette(MONSTER_COLORS, [1, 0.45, 0.1, 0.5]);
  private eyePaint: SkPaint = Skia.Paint();
  private highlightPaint: SkPaint = Skia.Paint();

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
    this.eyePaint.setColor(Skia.Color('#FF5A4E'));
    this.highlightPaint.setStyle(PaintStyle.Stroke);
    this.highlightPaint.setColor(Skia.Color('#F2C14E'));
  }

  draw(state: GameState, view: View, overlay?: Overlay): SkPicture {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, view.width, view.height));
    this.drawInto(canvas, state, view, overlay);
    return recorder.finishRecordingAsPicture();
  }

  private drawInto(canvas: SkCanvas, state: GameState, view: View, overlay?: Overlay) {
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
          if (!blockInfo(fg).opaque && fg !== Block.Leaves) {
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

    for (const monster of state.monsters) this.drawMonster(canvas, monster, state.time, view);
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

    // Monster eyes glow through the dark so you can see them coming.
    for (const monster of state.monsters) this.drawMonsterEyes(canvas, monster, view);

    const highlight = overlay?.highlight;
    if (highlight) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 6);
      const inset = 1 + pulse * 3;
      this.highlightPaint.setStrokeWidth(2 + pulse * 2);
      this.highlightPaint.setAlphaf(0.55 + pulse * 0.45);
      canvas.drawRect(
        Skia.XYWHRect(
          (highlight.x - camX) * tilePx - inset,
          (highlight.y - camY) * tilePx - inset,
          tilePx + inset * 2,
          tilePx + inset * 2,
        ),
        this.highlightPaint,
      );
    }
  }

  /** Axis-aligned rect in the current (possibly flipped and translated) coordinate space. */
  private box(canvas: SkCanvas, x: number, y: number, w: number, h: number, color: Float32Array) {
    this.fill.setColor(color);
    canvas.drawRect(Skia.XYWHRect(x, y, w, h), this.fill);
  }

  /** A limb hanging down from (x, y), rotated by `angle` radians (positive swings it forward). */
  private limb(
    canvas: SkCanvas,
    x: number,
    y: number,
    w: number,
    len: number,
    angle: number,
    color: Float32Array,
    end?: { len: number; color: Float32Array },
  ) {
    canvas.save();
    canvas.translate(x, y);
    // Rotating by a negative angle in a y-down space moves the bottom of the limb toward +x (forward).
    canvas.rotate(-angle * RAD_TO_DEG, 0, 0);
    this.box(canvas, -w / 2, 0, w, len, color);
    if (end) this.box(canvas, -w / 2, len - end.len, w, end.len, end.color);
    canvas.restore();
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

  /**
   * The player in profile, built from a few rects so it costs almost nothing per frame. Limbs rotate
   * around the shoulder and hip: a walk cycle tied to distance walked, breathing when idle, poses in
   * the air, an arm swing for digging and placing, and a red blink when hurt.
   */
  private drawPlayer(canvas: SkCanvas, state: GameState, view: View) {
    const { player } = state;
    const t = view.tilePx;
    const u = t / 16;
    const cx = (player.x + PLAYER_WIDTH / 2 - view.camX) * t;
    const feet = (player.y + PLAYER_HEIGHT - view.camY) * t;
    const flashing = player.hurtTime > 0 && Math.floor(player.hurtTime * 20) % 2 === 0;
    const c = flashing ? this.playerHurt : this.playerColors;

    const walking = player.onGround && Math.abs(player.vx) > 0.2;
    const airborne = !player.onGround;
    const stride = Math.sin(player.walkPhase);
    let legFront = 0;
    let legBack = 0;
    let armFront = 0;
    let armBack = 0;
    let bob = 0;
    if (airborne) {
      if (player.vy < 0) {
        // Rising: one knee forward, arms up.
        legFront = 0.55;
        legBack = -0.35;
        armFront = 2.5;
        armBack = 2.1;
      } else {
        // Falling: legs apart, arms out for balance.
        legFront = 0.3;
        legBack = -0.3;
        armFront = 1.3;
        armBack = -1.1;
      }
    } else if (walking || Math.abs(stride) > 0.02) {
      legFront = stride * 0.62;
      legBack = -stride * 0.62;
      armFront = -stride * 0.55;
      armBack = stride * 0.55;
      bob = -Math.abs(Math.sin(player.walkPhase)) * u * 1.3;
    }
    // Idle breathing: a slow rise of the chest and head, and the arms drift a little.
    const breathe = !airborne && !walking ? Math.sin(state.time * 2.4) * u * 0.45 : 0;
    if (!airborne && !walking) {
      armFront += Math.sin(state.time * 2.4) * 0.04;
      armBack -= Math.sin(state.time * 2.4) * 0.04;
    }
    if (player.swingTime > 0) {
      // Raise the arm behind the head, then chop down and forward.
      const p = 1 - player.swingTime / SWING_SECONDS;
      const ease = 1 - (1 - p) * (1 - p);
      armFront = p < 0.25 ? 3.4 * (p / 0.25) : 3.4 - 2.5 * ((ease - 0.4375) / 0.5625);
    }

    canvas.save();
    canvas.translate(cx, feet);
    if (player.facing < 0) canvas.scale(-1, 1);

    const hip = -9.6 * u;
    const top = -28.8 * u + bob;
    const legW = 3.4 * u;
    const legLen = 9.6 * u;
    const armW = 2.8 * u;
    const armLen = 9.2 * u;
    const shoulder = -18.6 * u + bob + breathe;

    // Back limbs first, darker.
    this.limb(canvas, -0.4 * u, hip + bob, legW, legLen - bob, legBack, c.legBack, { len: 1.6 * u, color: c.shoe });
    this.limb(canvas, -0.6 * u, shoulder, armW, armLen, armBack, c.armBack, { len: 2 * u, color: c.skin });
    // Torso.
    this.box(canvas, -4.4 * u, -19.8 * u + bob + breathe, 8.8 * u, 10.6 * u - breathe, c.shirt);
    this.box(canvas, -4.4 * u, -10.6 * u + bob, 8.8 * u, 1.4 * u, c.shirtShade);
    this.limb(canvas, 0.4 * u, hip + bob, legW, legLen - bob, legFront, c.legFront, { len: 1.6 * u, color: c.shoe });
    // Head with hair at the back and an eye at the front.
    const headY = top + breathe;
    this.box(canvas, -4.6 * u, headY, 9.2 * u, 9 * u, c.skin);
    this.box(canvas, -4.8 * u, headY, 9.6 * u, 2.6 * u, c.hair);
    this.box(canvas, -4.8 * u, headY, 3.6 * u, 5.2 * u, c.hair);
    this.box(canvas, 1.6 * u, headY + 3.8 * u, 1.8 * u, 1.9 * u, c.eye);
    // Front arm last so it swings over the body.
    this.limb(canvas, 0.6 * u, shoulder, armW, armLen, armFront, c.shirtShade, { len: 2 * u, color: c.skin });
    canvas.restore();
  }

  private drawMonster(canvas: SkCanvas, m: Monster, time: number, view: View) {
    const t = view.tilePx;
    const u = t / 16;
    const cx = (m.x + MONSTER_WIDTH / 2 - view.camX) * t;
    const feet = (m.y + MONSTER_HEIGHT - view.camY) * t;
    if (cx < -t * 2 || cx > view.width + t * 2) return;
    const burning = m.burn > 0;
    const c = m.hurtTime > 0 ? this.monsterHurt : burning && Math.floor(time * 14) % 2 === 0 ? this.monsterBurn : this.monsterColors;
    const stride = Math.sin(m.walkPhase);
    const sway = Math.sin(time * 3 + m.id) * 0.08;

    canvas.save();
    canvas.translate(cx, feet);
    if (m.facing < 0) canvas.scale(-1, 1);
    if (burning) {
      // Shrinks and fades as it burns away.
      const k = Math.max(0.2, 1 - m.burn / BURN_SECONDS);
      canvas.scale(k, k);
    }
    const hip = -8 * u;
    this.limb(canvas, -0.8 * u, hip, 3.4 * u, 8 * u, -stride * 0.6, c.limb);
    // Hunched body, arms reaching forward.
    this.box(canvas, -5 * u, -21 * u, 10 * u, 13.4 * u, c.body);
    this.box(canvas, -5 * u, -21 * u, 2.4 * u, 13.4 * u, c.shade);
    this.box(canvas, -3.8 * u, -27.2 * u, 9.6 * u, 7 * u, c.body);
    this.box(canvas, 2 * u, -22.2 * u, 3.6 * u, 1.2 * u, c.mouth);
    this.limb(canvas, 0.8 * u, hip, 3.4 * u, 8 * u, stride * 0.6, c.limb);
    this.limb(canvas, 2 * u, -19 * u, 3 * u, 9.6 * u, 1.35 + sway + stride * 0.15, c.shade);
    canvas.restore();

    if (burning) {
      // Flames licking up from the body.
      this.fill.setColor(Skia.Color(Math.floor(time * 10) % 2 === 0 ? '#FFB13B' : '#FF7A2A'));
      for (let i = 0; i < 3; i++) {
        const fx = cx + (i - 1) * 4 * u + Math.sin(time * 9 + i * 2) * u;
        const fh = (4 + 3 * Math.abs(Math.sin(time * 7 + i))) * u;
        canvas.drawRect(Skia.XYWHRect(fx - u, feet - 20 * u - fh, 2.4 * u, fh), this.fill);
      }
    }
  }

  private drawMonsterEyes(canvas: SkCanvas, m: Monster, view: View) {
    if (m.burn > 0) return;
    const t = view.tilePx;
    const u = t / 16;
    const cx = (m.x + MONSTER_WIDTH / 2 - view.camX) * t;
    const feet = (m.y + MONSTER_HEIGHT - view.camY) * t;
    if (cx < -t * 2 || cx > view.width + t * 2) return;
    const f = m.facing;
    const y = feet - 25.4 * u;
    canvas.drawRect(Skia.XYWHRect(cx + f * 1.6 * u - u, y, 2 * u, 1.8 * u), this.eyePaint);
    canvas.drawRect(Skia.XYWHRect(cx + f * 4.4 * u - u, y, 2 * u, 1.8 * u), this.eyePaint);
  }
}
