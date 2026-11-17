/**
 * 全局天色的时间轴
 *
 * 为什么要有这个文件：
 *   原来每个场景各画一遍天空。云海是黎明，沙丘是烈日，海边是日落，雪原是暮色，
 *   星海是夜。段落之间用闪白遮罩硬切，读作"闪一下换了张图"。
 *
 *   现在天空只有一片，从第 0 秒到第 35 秒连续变化：黎明 → 白昼 → 落日 → 暮色 → 星夜。
 *   这是"一天"，也是"一生"。天空连续之后，地貌怎么换都不会觉得是在切——
 *   因为占画面一半面积的那层从没断过。
 *
 * 实现：把五套调色板当成五个关键帧，重采样到统一网格后按时间插值。
 *   原始调色板每个只有 11 个 stop，且各套的 offset 不一致，不能按下标直接混；
 *   必须先"按位置取色"，再在位置网格上混色。
 */

import {
  SKY_CLOUD,
  SKY_CLOUD_END,
  SKY_DUNE,
  SKY_DUNE_END,
  SKY_SEA,
  SKY_SEA_END,
  SKY_SNOW,
  SKY_SNOW_END,
  SKY_STAR,
  type Stop,
} from '../config';
import {clamp01, hexToRgb} from './util';

/** 天色关键帧。时间点取在每段"主场"的中点之后，让天色先于地貌半步变化 */
const KEYS: {at: number; stops: Stop[]}[] = [
  {at: 0, stops: SKY_CLOUD}, // 黎明
  {at: 6.6, stops: SKY_CLOUD_END}, // 晨光起
  {at: 9.4, stops: SKY_DUNE}, // 日头偏西
  {at: 13.0, stops: SKY_DUNE_END}, // 烈日
  {at: 15.6, stops: SKY_SEA}, // 转金
  {at: 19.6, stops: SKY_SEA_END}, // 日落
  {at: 21.8, stops: SKY_SNOW}, // 暮色
  {at: 25.6, stops: SKY_SNOW_END}, // 余晖散尽
  {at: 28.4, stops: SKY_STAR}, // 星夜
  {at: 35, stops: SKY_STAR},
];

const GRID = 25;

type RGB = [number, number, number];

/** 在一套调色板的任意位置取色（原始 stop 间距不均，必须按 offset 找区间） */
const sample = (stops: Stop[], u: number): RGB => {
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
  for (const v of c) {
    s += Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  }
  return s;
};

/** 取某一秒的天空调色板。纯函数，同一秒永远同色 */
export const skyAt = (sec: number): Stop[] => {
  const n = KEYS.length;
  let i = 0;
  if (sec > KEYS[0].at) {
    while (i < n - 2 && sec > KEYS[i + 1].at) i++;
  }
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const raw = b.at === a.at ? 0 : clamp01((sec - a.at) / (b.at - a.at));
  // smoothstep：关键帧处的一阶导为零，天色不会在段落交界"拐一下"
  const w = raw * raw * (3 - 2 * raw);

  const out: Stop[] = [];
  for (let g = 0; g < GRID; g++) {
    const u = g / (GRID - 1);
    const c0 = sample(a.stops, u);
    const c1 = sample(b.stops, u);
    out.push([u, toHex([c0[0] + (c1[0] - c0[0]) * w, c0[1] + (c1[1] - c0[1]) * w, c0[2] + (c1[2] - c0[2]) * w])]);
  }
  return out;
};

/** 地平线附近的色，用来给雾带、地平线光、底部压暗取色 —— 它们必须跟着天色走 */
export const skyTintAt = (sec: number) => {
  const s = skyAt(sec);
  const low = sample(s, 0.665); // 地平线
  const mid = sample(s, 0.5); // 中天
  const high = sample(s, 0.12); // 天顶
  const rgbStr = (c: RGB, scale = 1) =>
    `${Math.min(255, Math.round(c[0] * scale))},${Math.min(255, Math.round(c[1] * scale))},${Math.min(255, Math.round(c[2] * scale))}`;
  return {
    /** 地平线本色 */
    low: rgbStr(low),
    /** 雾带颜色：取地平线色往白里提，雾永远是"被照亮的空气"，不能是灰的 */
    mist: rgbStr([low[0] + (255 - low[0]) * 0.42, low[1] + (255 - low[1]) * 0.4, low[2] + (255 - low[2]) * 0.34]),
    /** 底部压暗：取中天色压暗，各段同源，叠化时不会跳色 */
    floor: rgbStr(mid, 0.34),
    /** 天顶，给暗角用 */
    top: rgbStr(high),
  };
};
