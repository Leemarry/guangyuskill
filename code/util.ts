import {Easing} from 'remotion';

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const wrap = (v: number, m: number) => ((v % m) + m) % m;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const clampAbs = (v: number, m: number) => (v < -m ? -m : v > m ? m : v);

/** 平滑窗：a 之前为 0、b 之后为 1，中间是三次平滑（一阶导在两端为 0）。
 *  用途：一切"开关"都要写成它，写成 if 就是跳变。 */
export const smoothStep = (a: number, b: number, x: number) => {
  const v = clamp01((x - a) / (b - a));
  return v * v * (3 - 2 * v);
};
/** 先亮后灭的窗：rise 里淡入、fall 里淡出，中间为 1。 */
export const window2 = (riseA: number, riseB: number, fallA: number, fallB: number, x: number) =>
  smoothStep(riseA, riseB, x) * (1 - smoothStep(fallA, fallB, x));

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

export const mixHex = (a: string, b: string, p: number) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * p)},${Math.round(x[1] + (y[1] - x[1]) * p)},${Math.round(
    x[2] + (y[2] - x[2]) * p
  )})`;
};

export const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export type Stop = [number, string];

/** 线性渐变字符串；p 用于在两套调色板之间插值（天色在段落内也在变） */
export function skyGradient(stops: Stop[], p = 0, stopsEnd?: Stop[]) {
  return `linear-gradient(180deg, ${stops
    .map(([pos, c], i) => `${stopsEnd ? mixHex(c, stopsEnd[i][1], p) : c} ${(pos * 100).toFixed(1)}%`)
    .join(', ')})`;
}

/* ------------------------------------------------------------------ */
/* 离屏精灵                                                             */
/* ------------------------------------------------------------------ */

const cloudCache = new Map<string, HTMLCanvasElement>();

export type CloudTone = {top: string; bot: string; topLight: number; edge?: string};

/**
 * 云团精灵。关键：alpha 走「平台 + 陡降」，堆起来才是有轮廓的实体云，不是雾；
 * 再用 source-atop 烘焙顶光与底影，只改颜色不改 alpha —— 受光关系才有体积。
 */
export function cloudSprite(tone: CloudTone, variant: number) {
  const key = `${tone.top}|${tone.bot}|${tone.topLight}|${tone.edge ?? ''}|${variant}`;
  const hit = cloudCache.get(key);
  if (hit) return hit;

  const side = 256;
  const c = document.createElement('canvas');
  c.width = side;
  c.height = side;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(7000 + variant * 977 + Math.round(tone.topLight * 100));
  const top = hexToRgb(tone.top);
  const bot = hexToRgb(tone.bot);

  for (let i = 0; i < 20; i++) {
    const cx = side * 0.5 + (rnd() - 0.5) * side * 0.56;
    const cy = side * 0.5 + (rnd() - 0.5) * side * 0.4;
    const r = side * 0.09 + rnd() * side * 0.17;
    const k = clamp01((cy - side * 0.16) / (side * 0.66));
    const cr = Math.round(top[0] + (bot[0] - top[0]) * k);
    const cg = Math.round(top[1] + (bot[1] - top[1]) * k);
    const cb = Math.round(top[2] + (bot[2] - top[2]) * k);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    g.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.93)`);
    g.addColorStop(0.82, `rgba(${cr},${cg},${cb},0.34)`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-atop';
  const lg = ctx.createLinearGradient(0, side * 0.1, 0, side * 0.94);
  lg.addColorStop(0, `rgba(255,238,206,${tone.topLight})`);
  lg.addColorStop(0.32, `rgba(255,226,188,${tone.topLight * 0.2})`);
  lg.addColorStop(0.62, 'rgba(80,54,84,0.2)');
  lg.addColorStop(1, 'rgba(20,12,32,0.7)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, side, side);
  ctx.globalCompositeOperation = 'source-over';

  cloudCache.set(key, c);
  return c;
}

const glowCache = new Map<string, HTMLCanvasElement>();

/** 通用光点精灵：粒子、星、烛光都用它 */
export function glowSprite(color: string) {
  const hit = glowCache.get(color);
  if (hit) return hit;
  const side = 128;
  const c = document.createElement('canvas');
  c.width = side;
  c.height = side;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(side / 2, side / 2, 0, side / 2, side / 2, side / 2);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.22, rgba(color, 0.58));
  g.addColorStop(0.55, rgba(color, 0.14));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, side, side);
  glowCache.set(color, c);
  return c;
}
