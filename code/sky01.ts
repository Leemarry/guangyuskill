/**
 * 天色时间轴 —— 一片天管全片
 *
 * 为什么这是"过渡自然"的第一根支柱：
 *   分段做片子时，最常见的写法是每段各画一遍天空（黎明/正午/日落/暮色/夜）。
 *   段落之间哪怕用 0.5 秒叠化，天空也会从一种配色"融"成另一种 ——
 *   天空占画面一半面积，它一变，观众的判断就是"换了一张图"。
 *
 *   这里反过来：天空只有一个，从第 0 帧到最后一帧连续变化。
 *   地貌怎么换都行，因为脚底那层换了、头上那层没换。
 *
 * 实现要点：
 *   1. 每套调色板只有 11 个 stop，且各套的 offset 不一致 —— 不能按下标直接混。
 *      必须先"按位置取色"，把每套重采样到统一网格（默认 25 点），再在网格上混色。
 *   2. 关键帧之间用 smoothstep 而不是线性：关键帧处一阶导为零，
 *      天色不会在段落交界"拐一下"。
 *   3. 地平线色要单独暴露出来。雾带、地平线受光带、画面底部压暗都必须
 *      从同一个地方取色，否则叠化时它们的色温会各走各的。
 */

import {clamp01, hexToRgb, type Stop} from './util';

export type SkyKey = {at: number; stops: Stop[]};
export type RGB = [number, number, number];

export type SkyTint = {
  /** 地平线本色 */
  low: string;
  /** 雾色：地平线色往白里提，格式 "r,g,b"。雾永远是被照亮的空气，不能是灰的 */
  mist: string;
  /** 画面底部压暗，取中天色压暗 */
  floor: string;
  /** 天顶，给暗角用 */
  top: string;
};

const GRID = 25;

/** 在一套调色板的任意位置取色。原始 stop 间距不均，必须按 offset 找区间 */
export const sampleStops = (stops: Stop[], u: number): RGB => {
  if (!stops.length) return [0, 0, 0];
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (u <= first[0]) return hexToRgb(first[1]);
  if (u >= last[0]) return hexToRgb(last[1]);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (u >= a[0] && u <= b[0]) {
      const k = b[0] === a[0] ? 0 : (u - a[0]) / (b[0] - a[0]);
      const ca = hexToRgb(a[1]);
      const cb = hexToRgb(b[1]);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return hexToRgb(last[1]);
};

const toHex = (c: RGB) => {
  let s = '#';
  for (const v of c) s += Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return s;
};

const rgbStr = (c: RGB, scale = 1) =>
  `${Math.min(255, Math.round(c[0] * scale))},${Math.min(255, Math.round(c[1] * scale))},${Math.min(
    255,
    Math.round(c[2] * scale)
  )}`;

/**
 * 造一条天色曲线。
 *
 * @param keys 关键帧，形如 [{at: 0, stops: 黎明}, {at: 12, stops: 正午}, ...]
 *             至少两个关键帧；at 是秒，必须递增（内部会排序）
 * @param grid 重采样网格点数。25 足够：11 个原始 stop 混到 25 点已经看不出台阶
 */
export const makeSky = (keys: SkyKey[], grid = GRID) => {
  if (keys.length < 2) throw new Error('makeSky 至少需要两个关键帧');
  const ks = [...keys].sort((a, b) => a.at - b.at);

  /** 取某一秒的天空调色板。纯函数：同一秒永远同色，可以随便抽帧复现 */
  const skyAt = (sec: number): Stop[] => {
    const n = ks.length;
    let i = 0;
    if (sec > ks[0].at) {
      while (i < n - 2 && sec > ks[i + 1].at) i++;
    }
    const a = ks[i];
    const b = ks[i + 1];
    const raw = b.at === a.at ? 0 : clamp01((sec - a.at) / (b.at - a.at));
    const w = raw * raw * (3 - 2 * raw);

    const out: Stop[] = [];
    for (let g = 0; g < grid; g++) {
      const u = g / (grid - 1);
      const c0 = sampleStops(a.stops, u);
      const c1 = sampleStops(b.stops, u);
      out.push([
        u,
        toHex([c0[0] + (c1[0] - c0[0]) * w, c0[1] + (c1[1] - c0[1]) * w, c0[2] + (c1[2] - c0[2]) * w]),
      ]);
    }
    return out;
  };

  /** 派生色：雾、地平光、底部压暗、天顶。全部同源，叠化时不跳色温 */
  const skyTintAt = (sec: number): SkyTint => {
    const s = skyAt(sec);
    const low = sampleStops(s, 0.665);
    const mid = sampleStops(s, 0.5);
    const high = sampleStops(s, 0.12);
    return {
      low: rgbStr(low),
      mist: rgbStr([
        low[0] + (255 - low[0]) * 0.42,
        low[1] + (255 - low[1]) * 0.4,
        low[2] + (255 - low[2]) * 0.34,
      ]),
      floor: rgbStr(mid, 0.34),
      top: rgbStr(high),
    };
  };

  return {skyAt, skyTintAt, keys: ks};
};

export type Sky = ReturnType<typeof makeSky>;
