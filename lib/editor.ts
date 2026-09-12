import {
  paintBackground,
  paintImage,
  paintPresetImage,
  asciiCharacterSets,
  type AsciiCharacters,
  type Texture,
} from './background';
import { frameLayout, drawFrameChrome, type FrameSettings } from './frames';
export type Zoom = {
  id: string;
  start: number;
  duration: number;
  scale: number;
  x: number;
  y: number;
};
export type Caption = {
  id: string;
  start: number;
  duration: number;
  text: string;
};
export type Clip = { id: string; start: number; end: number };
export type Project = FrameSettings & {
  name: string;
  ratio: string;
  theme: number;
  backgroundMode?: 'preset' | 'color' | 'image';
  backgroundColor?: string;
  texture: Texture;
  textureStrength: number;
  pixelSize: number;
  backgroundCharacters?: AsciiCharacters;
  mediaStyle?: 'original' | 'ascii';
  asciiSize?: number;
  padding: number;
  radius: number;
  shadow: number;
  backgroundBlur?: number;
  speed: number;
  muted: boolean;
  cursor: boolean;
  cursorSize: number;
  zooms: Zoom[];
  captions: Caption[];
  clips: Clip[];
};
export const themes: {
  name: string;
  colors: string[];
  image?: string;
}[] = [
  {
    name: 'Violet Silk',
    colors: ['#2a0b50', '#a76df0'],
    image: '/backgrounds/violet-silk.png',
  },
  {
    name: 'Cobalt Glass',
    colors: ['#09295f', '#7ac5ff'],
    image: '/backgrounds/cobalt-glass.png',
  },
  {
    name: 'Amber Dunes',
    colors: ['#7d3e20', '#efb574'],
    image: '/backgrounds/amber-dunes.png',
  },
  {
    name: 'Carbon Mesh',
    colors: ['#101412', '#9dbb3f'],
    image: '/backgrounds/carbon-mesh.png',
  },
  {
    name: 'Ivory Paper',
    colors: ['#c9bca7', '#f4efe4'],
    image: '/backgrounds/ivory-paper.png',
  },
];
export const initialProject: Project = {
  name: 'Untitled demo',
  ratio: '16:9',
  theme: 0,
  backgroundMode: 'preset',
  backgroundColor: '#22352b',
  texture: 'smooth',
  textureStrength: 75,
  pixelSize: 3,
  mediaStyle: 'original',
  asciiSize: 10,
  padding: 64,
  radius: 12,
  shadow: 40,
  backgroundBlur: 0,
  speed: 1,
  muted: false,
  cursor: true,
  cursorSize: 25,
  zooms: [
    { id: 'z1', start: 3, duration: 4, scale: 1.28, x: 0.53, y: 0.56 },
    { id: 'z2', start: 14, duration: 4, scale: 1.35, x: 0.79, y: 0.63 },
  ],
  captions: [],
  clips: [{ id: 'c1', start: 0, end: 24 }],
};
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const duration = (p: Project) =>
  p.clips.reduce((n, c) => n + c.end - c.start, 0) / p.speed;
export function sourceTime(p: Project, t: number) {
  let left = t * p.speed;
  for (const c of p.clips) {
    if (left < c.end - c.start) return c.start + left;
    left -= c.end - c.start;
  }
  return p.clips.at(-1)?.end || 0;
}
export function size(ratio: string, quality = 1080) {
  const [w, h] = ratio.split(':').map(Number);
  return w >= h
    ? [Math.round((quality * w) / h / 2) * 2, quality]
    : [quality, Math.round((quality * h) / w / 2) * 2];
}
export const formatTime = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export function camera(p: Project, t: number) {
  let scale = 1,
    x = 0.5,
    y = 0.5;
  const z = p.zooms.find((z) => t >= z.start && t <= z.start + z.duration);
  if (z) {
    const edge = Math.min(1.15, z.duration / 2.4);
    const u = clamp(
      Math.min((t - z.start) / edge, (z.start + z.duration - t) / edge),
      0,
      1,
    );
    // Quintic smootherstep has zero velocity and acceleration at both ends.
    // That keeps camera motion fluid on high-refresh displays instead of
    // snapping into the old ease-out curve on its first frame.
    const ease = u * u * u * (u * (u * 6 - 15) + 10);
    scale = 1 + (z.scale - 1) * ease;
    x = 0.5 + (z.x - 0.5) * ease;
    y = 0.5 + (z.y - 0.5) * ease;
  }
  return { scale, x, y };
}
function round(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font = 14,
  color = '#7b8575',
  weight = 400,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${font}px Arial, sans-serif`;
  ctx.fillText(text, x, y);
}
export function drawSample(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#fafbf8';
  ctx.fillRect(0, 0, 1280, 800);
  round(ctx, 0, 0, 1280, 42, 0, '#f0f3ed');
  ['#d8aca2', '#d9cc9e', '#b8c7a9'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(22 + i * 18, 21, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  label(ctx, 'orbit.app', 600, 26, 12, '#89917f');
  ctx.fillStyle = '#f0f3eb';
  ctx.fillRect(0, 42, 233, 758);
  label(ctx, '◒ orbit', 27, 101, 30, '#344631', 650);
  label(ctx, 'Workspace', 27, 162, 13, '#939d89');
  ['Overview', 'Projects', 'My tasks', 'Documents'].forEach((s, i) => {
    if (i === 1) round(ctx, 17, 213, 199, 41, 6, '#dfe8d4');
    label(ctx, ['◈', '▦', '◎', '▤'][i], 29, 197 + i * 44, 17);
    label(
      ctx,
      s,
      60,
      197 + i * 44,
      15,
      i === 1 ? '#3e5b35' : '#77826e',
      i === 1 ? 600 : 400,
    );
  });
  label(ctx, 'YOUR TEAMS', 27, 423, 11);
  label(ctx, '●  Design studio', 29, 466, 14);
  label(ctx, '●  Engineering', 29, 506, 14);
  label(ctx, 'Workspace   /   Projects', 273, 92, 12, '#929b89');
  label(ctx, 'Make space for great work', 273, 165, 34, '#30392b', 550);
  label(
    ctx,
    'Big ideas. Small steps. All in one place.',
    273,
    197,
    16,
    '#8c9682',
  );
  label(ctx, '✳', 1186, 172, 44, '#99b67e');
  label(ctx, 'All projects', 273, 256, 14, '#435b35', 600);
  label(ctx, 'In progress', 387, 256, 14);
  label(ctx, 'Completed', 513, 256, 14);
  round(ctx, 273, 274, 960, 1, 0, '#e4e9dd');
  round(ctx, 273, 273, 79, 2, 0, '#83a465');
  ['Website refresh', 'Mobile experience', 'Brand exploration'].forEach(
    (s, i) => {
      const x = 273 + i * 327;
      round(ctx, x, 302, 310, 330, 9, '#e2e8dc');
      round(ctx, x + 1, 303, 308, 328, 8, '#fff');
      round(
        ctx,
        x + 12,
        314,
        286,
        146,
        5,
        ['#dce8cf', '#e2dded', '#f0e4d4'][i],
      );
      label(
        ctx,
        ['↗', '◎', '✳'][i],
        x + 120,
        415,
        84,
        ['#809b60', '#9585b6', '#b49a77'][i],
      );
      label(ctx, '● In progress', x + 15, 493, 11, '#8d9e79');
      label(ctx, s, x + 15, 523, 17, '#435139', 600);
      label(
        ctx,
        [
          'A fresh start for our digital home.',
          'Thoughtfully designed for on the go.',
          'Finding a new point of view.',
        ][i],
        x + 15,
        550,
        12,
        '#9ba58f',
      );
      round(ctx, x + 14, 574, 282, 1, 0, '#edf0e7');
      label(ctx, '◉  ◉  ◉', x + 15, 604, 16, '#a6b993');
      label(ctx, `${[12, 8, 6][i]} tasks`, x + 243, 602, 11);
    },
  );
  if (t > 9 && t < 13) {
    round(ctx, 804, 676, 401, 62, 10, '#e1ead7');
    label(
      ctx,
      '✓  Project saved. Keep the ideas coming.',
      824,
      713,
      15,
      '#4c663b',
    );
  }
}
// Source-space waypoints include dwell time. The opening and closing holds
// match both the full sample and the landing page's 3–21 second trimmed loop.
const cursorStops = [
  { arrive: 0, leave: 3.4, x: 315, y: 254 },
  { arrive: 4.05, leave: 6.5, x: 408, y: 520 },
  { arrive: 7.15, leave: 10.8, x: 730, y: 521 },
  { arrive: 11.45, leave: 15.2, x: 1060, y: 522 },
  { arrive: 16.05, leave: 18.8, x: 550, y: 255 },
  { arrive: 19.4, leave: 24, x: 315, y: 254 },
];
export function sampleCursor(t: number) {
  const time = ((t % 24) + 24) % 24;
  for (let i = 0; i < cursorStops.length - 1; i++) {
    const from = cursorStops[i],
      to = cursorStops[i + 1];
    if (time <= from.leave) return { x: from.x / 1280, y: from.y / 800 };
    if (time < to.arrive) {
      const u = (time - from.leave) / (to.arrive - from.leave);
      // Cubic ease-out: decisive travel, then a small settling movement.
      const p = 1 - Math.pow(1 - u, 3);
      const dx = to.x - from.x,
        dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      const bend = Math.min(18, length * 0.04) * (i % 2 ? -1 : 1);
      const arc = 4 * p * (1 - p) * bend;
      return {
        x: (from.x + dx * p - (dy / length) * arc) / 1280,
        y: (from.y + dy * p + (dx / length) * arc) / 800,
      };
    }
  }
  return { x: cursorStops[0].x / 1280, y: cursorStops[0].y / 800 };
}
let sample: HTMLCanvasElement | undefined;
let asciiSampler: HTMLCanvasElement | undefined;
let backgroundLayer: HTMLCanvasElement | undefined;
let cachedBackground: { key: string; canvas: HTMLCanvasElement } | undefined;
let heldVideoFrame: HTMLCanvasElement | undefined;
let heldVideoSource = '';

function layer(width: number, height: number) {
  if (!backgroundLayer) backgroundLayer = document.createElement('canvas');
  if (backgroundLayer.width !== width || backgroundLayer.height !== height) {
    backgroundLayer.width = width;
    backgroundLayer.height = height;
  }
  return backgroundLayer;
}

function paintProjectBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  p: Project,
  theme: (typeof themes)[number],
) {
  const presetReady =
    p.backgroundMode === 'preset' &&
    !!theme.image &&
    paintPresetImage(
      context,
      width,
      height,
      theme.image,
      p.texture === 'ascii',
      p.textureStrength,
      p.pixelSize,
      p.backgroundCharacters,
    );
  if (presetReady) return true;
  if (p.backgroundMode === 'color') {
    context.fillStyle = p.backgroundColor || '#22352b';
    context.fillRect(0, 0, width, height);
    return true;
  }
  if (
    p.backgroundMode === 'image' &&
    paintImage(
      context,
      width,
      height,
      p.texture === 'ascii',
      p.textureStrength,
      p.pixelSize,
      p.backgroundCharacters,
    )
  )
    return true;
  paintBackground(
    context,
    width,
    height,
    theme.colors,
    p.texture ?? 'dither',
    p.textureStrength ?? 75,
    p.pixelSize ?? 3,
    p.backgroundCharacters,
  );
  return p.backgroundMode !== 'preset' || !theme.image;
}

function drawAsciiMedia(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  outputWidth: number,
  size: number,
) {
  const cell = Math.max(7, (size / 1080) * outputWidth);
  const columns = Math.max(24, Math.ceil(w / cell));
  const rows = Math.max(14, Math.ceil(h / (cell * 1.35)));
  if (!asciiSampler) asciiSampler = document.createElement('canvas');
  asciiSampler.width = columns;
  asciiSampler.height = rows;
  const sampler = asciiSampler.getContext('2d', { willReadFrequently: true })!;
  sampler.imageSmoothingEnabled = true;
  sampler.drawImage(source, 0, 0, columns, rows);
  const pixels = sampler.getImageData(0, 0, columns, rows).data;
  const cellW = w / columns;
  const cellH = h / rows;
  const glyphs = ' .:-=+*#%@';

  ctx.fillStyle = '#121411';
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${Math.ceil(cellH * 0.9)}px ui-monospace, SFMono-Regular, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = (row * columns + column) * 4;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const light = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const glyph =
        glyphs[
          Math.min(glyphs.length - 1, Math.floor((light / 256) * glyphs.length))
        ];
      if (glyph === ' ') continue;
      ctx.fillStyle = `rgb(${Math.min(255, red + 24)},${Math.min(255, green + 24)},${Math.min(255, blue + 24)})`;
      ctx.fillText(glyph, (column + 0.5) * cellW, (row + 0.52) * cellH);
    }
  }
}

export function renderFrame(
  canvas: HTMLCanvasElement,
  p: Project,
  t: number,
  video?: CanvasImageSource | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width,
    H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const theme = themes[p.theme] || themes[0];
  const backgroundBlur = p.backgroundBlur ?? 0;
  const backgroundKey =
    p.backgroundMode === 'image'
      ? ''
      : JSON.stringify([
          W,
          H,
          p.backgroundMode,
          p.backgroundColor,
          p.theme,
          p.texture,
          p.textureStrength,
          p.pixelSize,
          p.backgroundCharacters,
          backgroundBlur,
        ]);
  if (backgroundKey && cachedBackground?.key === backgroundKey) {
    ctx.drawImage(cachedBackground.canvas, 0, 0);
  } else {
    if (!cachedBackground)
      cachedBackground = {
        key: '',
        canvas: document.createElement('canvas'),
      };
    const backgroundCanvas = backgroundKey ? cachedBackground.canvas : canvas;
    if (backgroundCanvas.width !== W || backgroundCanvas.height !== H) {
      backgroundCanvas.width = W;
      backgroundCanvas.height = H;
    }
    const backgroundContext = backgroundCanvas.getContext('2d')!;
    backgroundContext.clearRect(0, 0, W, H);
    let backgroundReady = true;
    if (backgroundBlur > 0) {
      const unblurred = layer(W, H);
      const unblurredContext = unblurred.getContext('2d')!;
      unblurredContext.clearRect(0, 0, W, H);
      backgroundReady = paintProjectBackground(
        unblurredContext,
        W,
        H,
        p,
        theme,
      );
      const blur = (backgroundBlur / 1080) * W;
      const overscan = Math.ceil(blur * 2.5);
      backgroundContext.save();
      backgroundContext.filter = `blur(${blur}px)`;
      backgroundContext.drawImage(
        unblurred,
        -overscan,
        -overscan,
        W + overscan * 2,
        H + overscan * 2,
      );
      backgroundContext.restore();
    } else {
      backgroundReady = paintProjectBackground(
        backgroundContext,
        W,
        H,
        p,
        theme,
      );
    }
    if (backgroundKey) {
      cachedBackground.key = backgroundReady ? backgroundKey : '';
      ctx.drawImage(backgroundCanvas, 0, 0);
    }
  }
  if (!sample) {
    sample = document.createElement('canvas');
    sample.width = 1280;
    sample.height = 800;
  }
  const videoElement = video instanceof HTMLVideoElement ? video : null;
  const sw =
      videoElement?.videoWidth ||
      (video && 'width' in video ? Number(video.width) : 1280),
    sh =
      videoElement?.videoHeight ||
      (video && 'height' in video ? Number(video.height) : 800);
  const {
    w,
    h,
    x,
    y,
    contentX,
    contentY,
    header,
    side,
    bottom,
    outerWidth,
    outerHeight,
  } = frameLayout(W, H, sw, sh, p.padding, p.frameStyle);
  const cam = camera(p, t);
  const r = (p.radius / 1080) * Math.min(W, H);
  ctx.save();
  ctx.shadowColor = '#12241c66';
  ctx.shadowBlur = (p.shadow / 1080) * W;
  ctx.shadowOffsetY = (p.shadow / 2160) * W;
  round(ctx, x, y, outerWidth, outerHeight, r, '#fafbf8');
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, outerWidth, outerHeight, r);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(contentX, contentY, w, h);
  ctx.clip();
  ctx.translate(contentX, contentY);
  const tx = clamp(w / 2 - cam.x * w * cam.scale, w - w * cam.scale, 0),
    ty = clamp(h / 2 - cam.y * h * cam.scale, h - h * cam.scale, 0);
  ctx.translate(tx, ty);
  ctx.scale(cam.scale, cam.scale);
  const hasImportedVideo = !!video;
  let source: CanvasImageSource | null = null;
  if (videoElement) {
    const sourceKey = videoElement.currentSrc || videoElement.src;
    if (sourceKey !== heldVideoSource) {
      heldVideoFrame = undefined;
      heldVideoSource = sourceKey;
    }
    if (videoElement.readyState >= 2) {
      if (!heldVideoFrame) heldVideoFrame = document.createElement('canvas');
      if (heldVideoFrame.width !== Math.ceil(w))
        heldVideoFrame.width = Math.ceil(w);
      if (heldVideoFrame.height !== Math.ceil(h))
        heldVideoFrame.height = Math.ceil(h);
      const held = heldVideoFrame.getContext('2d')!;
      held.imageSmoothingEnabled = true;
      held.imageSmoothingQuality = 'high';
      try {
        held.drawImage(
          videoElement,
          0,
          0,
          heldVideoFrame.width,
          heldVideoFrame.height,
        );
      } catch {
        // Some browsers report a ready frame just before a seek invalidates it.
        // Keep the last successfully decoded frame instead of flashing the demo.
      }
    }
    if (heldVideoFrame?.width && heldVideoFrame.height) source = heldVideoFrame;
  } else if (video) {
    source = video;
  } else {
    drawSample(sample.getContext('2d')!, t);
    source = sample;
  }
  if (!source) {
    ctx.fillStyle = '#151815';
    ctx.fillRect(0, 0, w, h);
  } else if ((p.mediaStyle ?? 'original') === 'ascii') {
    drawAsciiMedia(ctx, source, w, h, W, p.asciiSize ?? 10);
  } else {
    ctx.drawImage(source, 0, 0, w, h);
  }
  if (!hasImportedVideo) {
    if (p.cursor) {
      const cursor = sampleCursor(t);
      const px = cursor.x * w,
        py = cursor.y * h;
      const s = (p.cursorSize / 1080) * W;
      ctx.save();
      ctx.translate(px, py);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.25, s);
      ctx.lineTo(s * 0.49, s * 0.68);
      ctx.lineTo(s * 0.89, s * 0.61);
      ctx.closePath();
      ctx.fillStyle = '#1b2420';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
  drawFrameChrome(ctx, p, x, y, w, h, header, side, bottom, r);
  const caption = p.captions.find(
    (c) => t >= c.start && t < c.start + c.duration,
  );
  if (caption) {
    const font = Math.min(W * 0.03, 42);
    ctx.font = `600 ${font}px Arial`;
    const words = caption.text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > W * 0.8 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    const show = lines.slice(0, 3),
      ch = show.length * font * 1.35 + font;
    round(
      ctx,
      W * 0.075,
      H - ch - H * 0.055,
      W * 0.85,
      ch,
      font * 0.35,
      '#141a17e8',
    );
    ctx.textAlign = 'center';
    show.forEach((l, i) =>
      label(
        ctx,
        l,
        W / 2,
        H - ch - H * 0.055 + font * 1.45 + i * font * 1.35,
        font,
        '#fff',
        600,
      ),
    );
    ctx.textAlign = 'left';
  }
}
export function validateProject(input: unknown): Project {
  const p = input as Project;
  if (
    !p ||
    typeof p.name !== 'string' ||
    !['16:9', '1:1', '9:16'].includes(p.ratio) ||
    !Array.isArray(p.clips) ||
    !p.clips.length ||
    !Array.isArray(p.zooms) ||
    !Array.isArray(p.captions)
  )
    throw new Error('This is not a valid Take project.');
  for (const key of [
    'theme',
    'padding',
    'radius',
    'shadow',
    'backgroundBlur',
    'speed',
    'cursorSize',
  ] as const)
    if (p[key] !== undefined && !Number.isFinite(p[key]))
      throw new Error('Invalid project settings.');
  const theme = Math.min(p.theme, themes.length - 1);
  if (
    p.theme < 0 ||
    !Number.isInteger(p.theme) ||
    p.padding < 0 ||
    p.padding > 200 ||
    p.radius < 0 ||
    p.radius > 60 ||
    p.shadow < 0 ||
    p.shadow > 100 ||
    (p.backgroundBlur !== undefined &&
      (p.backgroundBlur < 0 || p.backgroundBlur > 30)) ||
    p.speed < 0.25 ||
    p.speed > 4
  )
    throw new Error('Project settings are out of range.');
  for (const c of p.clips)
    if (
      typeof c.id !== 'string' ||
      !Number.isFinite(c.start) ||
      !Number.isFinite(c.end) ||
      c.start < 0 ||
      c.end <= c.start
    )
      throw new Error('Invalid clip.');
  for (const z of p.zooms)
    if (
      typeof z.id !== 'string' ||
      ![z.start, z.duration, z.scale, z.x, z.y].every(Number.isFinite) ||
      z.start < 0 ||
      z.duration <= 0 ||
      z.scale < 1 ||
      z.scale > 3 ||
      z.x < 0 ||
      z.x > 1 ||
      z.y < 0 ||
      z.y > 1
    )
      throw new Error('Invalid zoom.');
  for (const c of p.captions)
    if (
      typeof c.id !== 'string' ||
      typeof c.text !== 'string' ||
      c.text.length > 240 ||
      !Number.isFinite(c.start) ||
      !Number.isFinite(c.duration) ||
      c.start < 0 ||
      c.duration <= 0
    )
      throw new Error('Invalid caption.');
  if (
    p.backgroundMode !== undefined &&
    !['preset', 'color', 'image'].includes(p.backgroundMode)
  )
    throw new Error('Invalid background mode.');
  if (
    p.backgroundColor !== undefined &&
    !/^#[0-9a-f]{6}$/i.test(p.backgroundColor)
  )
    throw new Error('Invalid background color.');
  const frameStyle =
    (p.frameStyle as string) === 'phone' ? 'clean' : p.frameStyle;
  if (
    (frameStyle !== undefined &&
      !['clean', 'browser', 'desktop'].includes(frameStyle)) ||
    (p.frameTone !== undefined && !['light', 'dark'].includes(p.frameTone)) ||
    (p.windowControls !== undefined &&
      !['mac', 'windows'].includes(p.windowControls)) ||
    (p.frameTitle !== undefined &&
      (typeof p.frameTitle !== 'string' || p.frameTitle.length > 120))
  )
    throw new Error('Invalid frame settings.');
  if (
    p.backgroundCharacters !== undefined &&
    !Object.hasOwn(asciiCharacterSets, p.backgroundCharacters)
  )
    throw new Error('Invalid ASCII character style.');
  const texture = p.texture ?? 'dither',
    textureStrength = p.textureStrength ?? 75,
    pixelSize = p.pixelSize ?? 3,
    mediaStyle = p.mediaStyle ?? 'original',
    asciiSize = p.asciiSize ?? 10;
  if (
    !['smooth', 'dither', 'grain', 'ascii'].includes(texture) ||
    !Number.isFinite(textureStrength) ||
    textureStrength < 0 ||
    textureStrength > 100 ||
    !Number.isFinite(pixelSize) ||
    pixelSize < 1 ||
    pixelSize > 8 ||
    !['original', 'ascii'].includes(mediaStyle) ||
    !Number.isFinite(asciiSize) ||
    asciiSize < 6 ||
    asciiSize > 18
  )
    throw new Error('Invalid texture settings.');
  const {
    frameEffect: _legacyFrameEffect,
    effectStrength: _legacyEffectStrength,
    ...project
  } = p as Project & {
    frameEffect?: unknown;
    effectStrength?: unknown;
  };
  return {
    ...project,
    theme,
    frameStyle,
    backgroundBlur: p.backgroundBlur ?? 0,
    texture,
    textureStrength,
    pixelSize,
    mediaStyle,
    asciiSize,
    muted: !!p.muted,
    cursor: !!p.cursor,
  };
}
