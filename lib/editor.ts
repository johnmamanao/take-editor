import { paintBackground, paintImage, type Texture } from './background';
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
export type Project = {
  name: string;
  ratio: string;
  theme: number;
  backgroundMode?: 'preset'|'color'|'image';
  backgroundColor?: string;
  texture: Texture;
  textureStrength: number;
  pixelSize: number;
  padding: number;
  radius: number;
  shadow: number;
  speed: number;
  muted: boolean;
  cursor: boolean;
  cursorSize: number;
  zooms: Zoom[];
  captions: Caption[];
  clips: Clip[];
};
export const themes = [
  { name: 'Meadow', colors: ['#89b69f', '#e4e9c0'] },
  { name: 'Iris', colors: ['#958bd4', '#e3cbee'] },
  { name: 'Sand', colors: ['#d7b69c', '#f3e6cf'] },
  { name: 'Glacier', colors: ['#688cab', '#cddfe8'] },
  { name: 'Sunset', colors: ['#ca7c85', '#f8bb87'] },
  { name: 'Midnight', colors: ['#343a43', '#11151b'] },
];
export const initialProject: Project = {
  name: 'My first demo',
  ratio: '16:9',
  theme: 0,
  backgroundMode:'preset',
  backgroundColor:'#22352b',
  texture: 'dither',
  textureStrength: 75,
  pixelSize: 3,
  padding: 64,
  radius: 12,
  shadow: 40,
  speed: 1,
  muted: false,
  cursor: true,
  cursorSize: 25,
  zooms: [
    { id: 'z1', start: 3, duration: 5, scale: 1.55, x: 0.53, y: 0.56 },
    { id: 'z2', start: 14, duration: 5, scale: 1.8, x: 0.79, y: 0.63 },
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
    const edge = Math.min(0.65, z.duration / 3);
    const u = clamp(
      Math.min((t - z.start) / edge, (z.start + z.duration - t) / edge),
      0,
      1,
    );
    const ease = u * u * (3 - 2 * u);
    scale = 1 + (z.scale - 1) * ease;
    x = z.x;
    y = z.y;
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
let sample: HTMLCanvasElement | undefined;
export function renderFrame(
  canvas: HTMLCanvasElement,
  p: Project,
  t: number,
  video?: HTMLVideoElement | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width,
    H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const theme = themes[p.theme] || themes[0];
  if(p.backgroundMode==='color') {ctx.fillStyle=p.backgroundColor||'#22352b';ctx.fillRect(0,0,W,H);}
  else if(p.backgroundMode!=='image'||!paintImage(ctx,W,H))paintBackground(
    ctx,
    W,
    H,
    theme.colors,
    p.texture ?? 'dither',
    p.textureStrength ?? 75,
    p.pixelSize ?? 3,
  );
  if (!sample) {
    sample = document.createElement('canvas');
    sample.width = 1280;
    sample.height = 800;
  }
  const sw = video?.videoWidth || 1280,
    sh = video?.videoHeight || 800;
  const pad = (p.padding / 1080) * Math.min(W, H);
  const fit = Math.min((W - 2 * pad) / sw, (H - 2 * pad) / sh);
  const w = sw * fit,
    h = sh * fit,
    x = (W - w) / 2,
    y = (H - h) / 2;
  const cam = camera(p, t);
  const r = (p.radius / 1080) * Math.min(W, H);
  ctx.save();
  ctx.shadowColor = '#12241c66';
  ctx.shadowBlur = (p.shadow / 1080) * W;
  ctx.shadowOffsetY = (p.shadow / 2160) * W;
  round(ctx, x, y, w, h, r, '#fafbf8');
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.translate(x, y);
  const tx = clamp(w / 2 - cam.x * w * cam.scale, w - w * cam.scale, 0),
    ty = clamp(h / 2 - cam.y * h * cam.scale, h - h * cam.scale, 0);
  ctx.translate(tx, ty);
  ctx.scale(cam.scale, cam.scale);
  if (video && video.readyState >= 2) {
    ctx.drawImage(video, 0, 0, w, h);
  } else {
    drawSample(sample.getContext('2d')!, t);
    ctx.drawImage(sample, 0, 0, w, h);
    if (p.cursor) {
      const px = (0.39 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.38))) * w,
        py = (0.45 + 0.19 * (0.5 + 0.5 * Math.cos(t * 0.52))) * h;
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
    'speed',
    'cursorSize',
  ] as const)
    if (!Number.isFinite(p[key])) throw new Error('Invalid project settings.');
  if (
    p.theme < 0 ||
    p.theme >= themes.length ||
    !Number.isInteger(p.theme) ||
    p.padding < 0 ||
    p.padding > 200 ||
    p.radius < 0 ||
    p.radius > 60 ||
    p.shadow < 0 ||
    p.shadow > 100 ||
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
  if(p.backgroundMode!==undefined&&!['preset','color','image'].includes(p.backgroundMode))throw new Error('Invalid background mode.');
  if(p.backgroundColor!==undefined&&!/^#[0-9a-f]{6}$/i.test(p.backgroundColor))throw new Error('Invalid background color.');
  const texture = p.texture ?? 'dither',
    textureStrength = p.textureStrength ?? 75,
    pixelSize = p.pixelSize ?? 3;
  if (
    !['smooth', 'dither', 'grain'].includes(texture) ||
    !Number.isFinite(textureStrength) ||
    textureStrength < 0 ||
    textureStrength > 100 ||
    !Number.isFinite(pixelSize) ||
    pixelSize < 1 ||
    pixelSize > 8
  )
    throw new Error('Invalid texture settings.');
  return {
    ...p,
    texture,
    textureStrength,
    pixelSize,
    muted: !!p.muted,
    cursor: !!p.cursor,
  };
}
