import { AlphaType, ColorType, Skia, type SkImage, type SkRect } from '@shopify/react-native-skia';

import { atlasPixels, ICON_ITEMS, TEX, texturePixels } from '@/game/textures';

export type RenderAssets = {
  atlas: SkImage;
  /** Source rect per block id (row 0). */
  front: SkRect[];
  /** Source rect per block id for back walls (row 1). */
  back: SkRect[];
  /** Crack stages 0-3 (row 2). */
  cracks: SkRect[];
};

let cached: RenderAssets | null = null;

function makeImage(width: number, height: number, pixels: Uint8Array): SkImage {
  const data = Skia.Data.fromBytes(pixels);
  const image = Skia.Image.MakeImage(
    { width, height, alphaType: AlphaType.Unpremul, colorType: ColorType.RGBA_8888 },
    data,
    width * 4,
  );
  if (!image) throw new Error('Could not create the block atlas');
  return image;
}

/** Builds the block atlas once from code-drawn pixels. */
export function getRenderAssets(): RenderAssets {
  if (cached) return cached;
  const { width, height, pixels } = atlasPixels();
  const atlas = makeImage(width, height, pixels);
  const rect = (col: number, row: number) => Skia.XYWHRect(col * TEX, row * TEX, TEX, TEX);
  const front: SkRect[] = [];
  const back: SkRect[] = [];
  for (let id = 0; id < 12; id++) {
    front.push(rect(id, 0));
    back.push(rect(id, 1));
  }
  cached = { atlas, front, back, cracks: [0, 1, 2, 3].map((s) => rect(s, 2)) };
  return cached;
}

const ICON_SCALE = 4;
const iconUris = new Map<number, string>();

/** Item icon as a PNG data URI, upscaled with hard pixels so it stays crisp in an <Image>. */
export function itemIconUri(item: number): string | null {
  const hit = iconUris.get(item);
  if (hit) return hit;
  if (!(ICON_ITEMS as readonly number[]).includes(item)) return null;
  const src = texturePixels(item);
  const size = TEX * ICON_SCALE;
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = ((Math.floor(y / ICON_SCALE) * TEX + Math.floor(x / ICON_SCALE)) * 4) | 0;
      const d = (y * size + x) * 4;
      out[d] = src[s];
      out[d + 1] = src[s + 1];
      out[d + 2] = src[s + 2];
      out[d + 3] = src[s + 3];
    }
  }
  try {
    const image = makeImage(size, size, out);
    const uri = `data:image/png;base64,${image.encodeToBase64()}`;
    iconUris.set(item, uri);
    return uri;
  } catch {
    return null;
  }
}
