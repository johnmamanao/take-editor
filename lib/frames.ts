export type FrameSettings = {
  frameStyle?: "clean" | "browser" | "desktop";
  frameTone?: "light" | "dark";
  windowControls?: "mac" | "windows";
  frameTitle?: string;
};

export function frameLayout(
  W: number,
  H: number,
  sw: number,
  sh: number,
  padding: number,
  style = "clean",
) {
  const pad = (padding / 1080) * Math.min(W, H);
  const sideSource = 0;
  const headerSource =
    style === "clean" ? 0 : sw * (style === "browser" ? 0.046 : 0.034);
  const bottomSource = 0;
  const fit = Math.min(
    (W - 2 * pad) / (sw + sideSource * 2),
    (H - 2 * pad) / (sh + headerSource + bottomSource),
  );
  const w = sw * fit,
    h = sh * fit,
    header = headerSource * fit;
  const side = sideSource * fit,
    bottom = bottomSource * fit;
  const outerWidth = w + side * 2,
    outerHeight = h + header + bottom;
  const x = (W - outerWidth) / 2,
    y = (H - outerHeight) / 2;
  return {
    w,
    h,
    header,
    side,
    bottom,
    x,
    y,
    contentX: x + side,
    contentY: y + header,
    outerWidth,
    outerHeight,
  };
}

export function drawFrameChrome(
  ctx: CanvasRenderingContext2D,
  p: FrameSettings,
  x: number,
  y: number,
  w: number,
  h: number,
  header: number,
  side: number,
  bottom: number,
  radius: number,
) {
  if (!header) return;
  const dark = p.frameTone === "dark";
  const unit = w / 1080;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, header + radius, radius);
  ctx.clip();
  ctx.fillStyle = dark ? "#282b2d" : "#f2f3f4";
  ctx.fillRect(x, y, w, header);
  ctx.strokeStyle = dark ? "#414548" : "#d9dcdf";
  ctx.lineWidth = unit;
  ctx.beginPath();
  ctx.moveTo(x, y + header - unit / 2);
  ctx.lineTo(x + w, y + header - unit / 2);
  ctx.stroke();
  const windows = p.frameStyle === "desktop" && p.windowControls === "windows";
  if (windows) {
    ctx.strokeStyle = dark ? "#c2c7ca" : "#51585d";
    for (let i = 0; i < 3; i++) {
      const cx = x + w - (22 + i * 34) * unit,
        cy = y + header / 2;
      ctx.beginPath();
      if (i === 0) {
        ctx.moveTo(cx - 4 * unit, cy - 4 * unit);
        ctx.lineTo(cx + 4 * unit, cy + 4 * unit);
        ctx.moveTo(cx + 4 * unit, cy - 4 * unit);
        ctx.lineTo(cx - 4 * unit, cy + 4 * unit);
      } else if (i === 1)
        ctx.rect(cx - 4 * unit, cy - 4 * unit, 8 * unit, 8 * unit);
      else {
        ctx.moveTo(cx - 4 * unit, cy);
        ctx.lineTo(cx + 4 * unit, cy);
      }
      ctx.stroke();
    }
  } else {
    ["#ed6a60", "#f4bf50", "#61c454"].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(
        x + (20 + i * 17) * unit,
        y + header / 2,
        4.7 * unit,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
  }
  const browser = p.frameStyle === "browser";
  const left = x + w * (browser ? 0.22 : 0.18),
    width = w * 0.56;
  if (browser) {
    ctx.fillStyle = dark ? "#1c1f21" : "#e5e7e9";
    ctx.beginPath();
    ctx.roundRect(left, y + header * 0.22, width, header * 0.56, 5 * unit);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.rect(left + 10 * unit, y, width - 20 * unit, header);
  ctx.clip();
  ctx.fillStyle = dark ? "#c2c7ca" : "#626a70";
  ctx.font = `${12 * unit}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    p.frameTitle ?? (browser ? "yourapp.com" : "Your app"),
    left + width / 2,
    y + header / 2,
  );
  ctx.restore();
}
