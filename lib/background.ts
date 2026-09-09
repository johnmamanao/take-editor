export type Texture = 'smooth' | 'dither' | 'grain';
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export function texturePixels(
  width: number,
  height: number,
  colors: string[],
  mode: Texture,
  strength: number,
) {
  const a = rgb(colors[0]),
    b = rgb(colors[1]),
    out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x / Math.max(1, width - 1),
        v = y / Math.max(1, height - 1);
      const field = Math.max(
        0,
        Math.min(
          1,
          0.12 + 0.64 * (u * 0.55 + v * 0.45) + 0.17 * Math.sin(u * 5 + v * 3),
        ),
      );
      const threshold = (bayer[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
      const quantized = Math.floor(field * 4 + threshold) / 4;
      const noise =
        ((((x * 374761393 + y * 668265263) ^ (x * y * 1274126177)) >>> 0) %
          101) /
          100 -
        0.5;
      const mix =
        mode === 'dither'
          ? field + ((quantized - field) * strength) / 100
          : field;
      const n = mode === 'grain' ? noise * strength * 0.5 : 0,
        i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) out[i + c] = a[c] + (b[c] - a[c]) * mix + n;
      out[i + 3] = 255;
    }
  return out;
}
let cache: { key: string; canvas: HTMLCanvasElement } | undefined;
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  mode: Texture,
  strength: number,
  pixelSize: number,
) {
  if (mode === 'smooth') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const key = [w, h, ...colors, mode, strength, pixelSize].join('|');
  if (cache?.key !== key) {
    const c = document.createElement('canvas');
    const cell =
      mode === 'grain'
        ? Math.max(1, w / 1080)
        : Math.max(1, (pixelSize * w) / 1080);
    c.width = Math.ceil(w / cell);
    c.height = Math.ceil(h / cell);
    c.getContext('2d')!.putImageData(
      new ImageData(
        texturePixels(c.width, c.height, colors, mode, strength),
        c.width,
        c.height,
      ),
      0,
      0,
    );
    cache = { key, canvas: c };
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cache.canvas, 0, 0, w, h);
  ctx.restore();
}
