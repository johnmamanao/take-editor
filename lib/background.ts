export type Texture = "smooth" | "dither" | "grain" | "ascii";
export const asciiCharacterSets = {
  classic: { label: "Classic · . : + # @", glyphs: " .:-=+*#%@" },
  letters: { label: "Letters · a c e m W", glyphs: " aceosmnW" },
  binary: { label: "Binary · 0 1", glyphs: " 01" },
  blocks: { label: "Blocks · ░ ▒ ▓ █", glyphs: " ░▒▓█" },
};
export type AsciiCharacters = keyof typeof asciiCharacterSets;
let imageRevision = 0;
let asciiCache: { key: string; canvas: HTMLCanvasElement } | undefined;
const presetImages = new Map<string, HTMLImageElement>();
let customImage: ImageBitmap | null = null;
export async function setBackgroundImage(file: Blob | null) {
  const next = file ? await createImageBitmap(file) : null;
  customImage?.close();
  customImage = next;
  imageRevision++;
}
export function paintImage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ascii = false,
  strength = 75,
  pixelSize = 3,
  characters: AsciiCharacters = "classic",
) {
  if (!customImage) return false;
  if (ascii) {
    paintAscii(ctx, w, h, [], strength, pixelSize, characters, customImage);
    return true;
  }
  const scale = Math.max(w / customImage.width, h / customImage.height);
  const dw = customImage.width * scale,
    dh = customImage.height * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(customImage, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
  return true;
}

export function paintPresetImage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  src: string,
  ascii = false,
  strength = 75,
  pixelSize = 3,
  characters: AsciiCharacters = "classic",
) {
  let image = presetImages.get(src);
  if (!image) {
    image = new Image();
    image.src = src;
    presetImages.set(src, image);
  }
  if (!image.complete || !image.naturalWidth) return false;
  if (ascii) {
    paintAscii(ctx, w, h, [], strength, pixelSize, characters, image);
    return true;
  }
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale,
    dh = image.naturalHeight * scale;
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return true;
}
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function paintAscii(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  strength: number,
  pixelSize: number,
  characters: AsciiCharacters,
  source?: ImageBitmap | HTMLImageElement,
) {
  const sourceKey =
    source instanceof HTMLImageElement
      ? source.src
      : source
        ? imageRevision
        : "gradient";
  const key = [
    w,
    h,
    ...colors,
    strength,
    pixelSize,
    characters,
    sourceKey,
  ].join("|");
  if (asciiCache?.key !== key) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const out = canvas.getContext("2d")!;
    const cell = Math.max(4, (pixelSize * 4 * w) / 1080);
    const cols = Math.ceil(w / cell),
      rows = Math.ceil(h / (cell * 1.3));
    const sampler = document.createElement("canvas");
    sampler.width = cols;
    sampler.height = rows;
    const sample = sampler.getContext("2d")!;
    if (source) {
      const sourceWidth =
        source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      const sourceHeight =
        source instanceof HTMLImageElement
          ? source.naturalHeight
          : source.height;
      const scale = Math.max(cols / sourceWidth, rows / sourceHeight);
      sample.drawImage(
        source,
        (cols - sourceWidth * scale) / 2,
        (rows - sourceHeight * scale) / 2,
        sourceWidth * scale,
        sourceHeight * scale,
      );
    } else {
      sample.putImageData(
        new ImageData(
          texturePixels(cols, rows, colors, "smooth", 0),
          cols,
          rows,
        ),
        0,
        0,
      );
    }
    const pixels = sample.getImageData(0, 0, cols, rows).data;
    out.fillStyle = "#111411";
    out.fillRect(0, 0, w, h);
    out.globalAlpha = 1 - strength / 100;
    out.drawImage(sampler, 0, 0, w, h);
    out.globalAlpha = strength / 100;
    out.font = `${cell * 1.1}px Consolas, monospace`;
    out.textAlign = "center";
    out.textBaseline = "middle";
    const glyphs = asciiCharacterSets[characters].glyphs;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = pixels[i],
          g = pixels[i + 1],
          b = pixels[i + 2];
        const light = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 256;
        out.fillStyle = `rgb(${r},${g},${b})`;
        out.fillText(
          glyphs[Math.floor(light * glyphs.length)],
          ((x + 0.5) * w) / cols,
          ((y + 0.5) * h) / rows,
        );
      }
    asciiCache = { key, canvas };
  }
  ctx.drawImage(asciiCache.canvas, 0, 0, w, h);
}
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
        mode === "dither"
          ? field + ((quantized - field) * strength) / 100
          : field;
      const n = mode === "grain" ? noise * strength * 0.5 : 0,
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
  characters: AsciiCharacters = "classic",
) {
  if (mode === "ascii") {
    paintAscii(ctx, w, h, colors, strength, pixelSize, characters);
    return;
  }
  if (mode === "smooth") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const key = [w, h, ...colors, mode, strength, pixelSize].join("|");
  if (cache?.key !== key) {
    const c = document.createElement("canvas");
    const cell =
      mode === "grain"
        ? Math.max(1, w / 1080)
        : Math.max(1, (pixelSize * w) / 1080);
    c.width = Math.ceil(w / cell);
    c.height = Math.ceil(h / cell);
    c.getContext("2d")!.putImageData(
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
