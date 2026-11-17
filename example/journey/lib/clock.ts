/**
 * 全局时钟：一台摄像机 + 一个人
 *
 * 这是"没有切换"的第二层保证。第一层是连续的天空（lib/sky.ts），第二层是这里：
 *
 *   1. 摄像机只有一台。原来每段各有一个 camScale/camX/camY，段尾还各自缓推，
 *      叠化时两张图的缩放不同，会露成"重影"。现在 35 秒共用一条镜头曲线，
 *      只有一次缓慢推近（0–26s）和一次后拉（26–35s，人走远了）。
 *
 *   2. 主角只有一个。原来五段各画一个主角，每段开头 x 回到 0.2~0.6、foot 从
 *      0.757 跳到 0.845、身高从 150 跳到 214。任何叠化都会读成"一个人分成两个"。
 *      现在同一个人从第 0 帧跑到第 1050 帧：身高 150→215→185，步频 2.05→0.60，
 *      驼背 0→0.88，道具 空手→提灯→杖。
 *
 * 于是"变"的只有地貌和天色，"不变"的是他和这台镜头。走着走着，路就换了。
 */

import {clamp01} from './util';

/* ------------------------------------------------------------------ */
/* 关键帧插值                                                           */
/* ------------------------------------------------------------------ */

export type K = [number, number];

/** 分段 smoothstep：每个关键帧处一阶导为零，曲线不会在节点上"拐一下" */
export const kf = (keys: K[], sec: number) => {
  const n = keys.length;
  if (sec <= keys[0][0]) return keys[0][1];
  if (sec >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && sec > keys[i + 1][0]) i++;
  const [t0, v0] = keys[i];
  const [t1, v1] = keys[i + 1];
  const w = t1 === t0 ? 0 : clamp01((sec - t0) / (t1 - t0));
  const e = w * w * (3 - 2 * w);
  return v0 + (v1 - v0) * e;
};

/* ------------------------------------------------------------------ */
/* 摄像机                                                              */
/* ------------------------------------------------------------------ */

/**
 * 镜头基准必须 > 1。
 *
 * 上一版是 scale 1.02 → 0.895：一旦跌破 1，整块画面就缩进画框里，
 * 四周露出 AbsoluteFill 的底色，成了一圈硬边（片尾星海那 7 秒最明显）。
 * 而且地貌是"铺满整幅"画的，缩进去之后地面会在画面内侧断开、露天生，
 * 那道断口比暗边更难看 —— 这不是加个模糊能救的。
 *
 * 所以把基准整体抬起来：全程 1.09 ~ 1.15，内容永远大于画框，边缘永远不出缝。
 * 代价是画面比原来推近约一成，构图跟着收一点。
 *
 * 后拉也一并改了：
 *   原来 26s 就开始（那时人刚转身、雾还没散尽），9 秒缩 13.5%，最快处 1.45%/秒，
 *   而且终点掉到 0.895。
 *   现在 29s 才起步（雾散尽、星海已经稳了），6 秒缩 4.9%，平均 0.82%/秒，
 *   终点 1.094，仍是"拉开"，但已经不是"被拽走"。
 */
const CAM: {at: number; scale: number; x: number; y: number}[] = [
  {at: 0, scale: 1.132, x: 34, y: 14},
  {at: 3, scale: 1.146, x: 22, y: 9},
  {at: 6, scale: 1.157, x: 10, y: 4},
  {at: 9, scale: 1.161, x: 2, y: 0},
  {at: 12, scale: 1.162, x: -4, y: -2},
  {at: 15, scale: 1.16, x: -7, y: -4},
  {at: 19, scale: 1.157, x: -10, y: -6},
  {at: 22, scale: 1.153, x: -11, y: -7},
  {at: 26, scale: 1.147, x: -12, y: -8},
  {at: 29, scale: 1.144, x: -12, y: -8},
  {at: 32, scale: 1.121, x: -8, y: -6},
  {at: 35, scale: 1.094, x: -4, y: -4},
];

export const cameraAt = (sec: number) => {
  const n = CAM.length;
  let i = 0;
  while (i < n - 2 && sec > CAM[i + 1].at) i++;
  const a = CAM[i];
  const b = CAM[i + 1];
  const w = clamp01((sec - a.at) / (b.at - a.at));
  const e = w * w * (3 - 2 * w);
  return {
    scale: a.scale + (b.scale - a.scale) * e,
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e,
  };
};

/* ------------------------------------------------------------------ */
/* 主角的一生                                                          */
/* ------------------------------------------------------------------ */

/** 屏幕横向位置（0–1）。25.1→26.0 是折返点：他在雾里停下、转身 */
const HX: K[] = [
  [0, 0.2],
  [3, 0.382],
  [6, 0.436],
  [9, 0.47],
  [12, 0.5],
  [14.2, 0.455],
  [16.6, 0.548],
  [19, 0.505],
  [22, 0.512],
  [25.1, 0.524],
  [26, 0.56],
  [28.6, 0.47],
  [30.5, 0.443],
  [35, 0.44],
];

/** 脚底（0–1）。坡地在变，人一路走上去再走下来 —— 不是跳变，是路有起伏 */
const HFOOT: K[] = [
  [0, 0.76],
  [4, 0.772],
  [6, 0.78],
  [9, 0.8],
  [12, 0.818],
  [15, 0.842],
  [19, 0.845],
  [22, 0.838],
  [25, 0.832],
  [28, 0.816],
  [32, 0.81],
  [35, 0.808],
];

/** 身高：长起来，再缩回去。全片最重的一条曲线，也是"一生"两个字唯一需要的解释 */
const HH: K[] = [
  [0, 150],
  [4, 154],
  [6, 160],
  [8, 172],
  [10, 188],
  [12, 203],
  [14, 212],
  [19, 215],
  [22, 210],
  [25, 206],
  [28, 196],
  [32, 188],
  [35, 185],
];

const HCAD: K[] = [
  [0, 2.05],
  [6, 1.92],
  [9, 1.82],
  [12, 1.68],
  [16, 1.55],
  [19, 1.34],
  [22, 1.22],
  [25, 1.1],
  [26.4, 0.92],
  [28.8, 0.62],
  [31, 0.36],
  [35, 0.3],
];

const HSTR: K[] = [
  [0, 1.15],
  [6, 1.06],
  [12, 1.0],
  [19, 0.8],
  [25, 0.66],
  [28.8, 0.5],
  [31, 0.2],
  [35, 0.16],
];

const HHUNCH: K[] = [
  [0, 0],
  [10, 0],
  [14, 0.06],
  [19, 0.34],
  [25, 0.55],
  [28.8, 0.86],
  [35, 0.88],
];

const HTILT: K[] = [
  [0, 6],
  [6, 9],
  [12, 7],
  [19, 4],
  [25, 5],
  [28.8, 11],
  [35, 9],
];

const HGLOW: K[] = [
  [0, 1],
  [24, 1],
  [27, 0.85],
  [31, 0.72],
  [35, 0.7],
];

/** 转身：scaleX 从 1 连续到 −1，中间经过 0 —— 那正是侧面，也是雾最浓的一帧 */
const HTURN: K[] = [
  [0, 1],
  [25.5, 1],
  [26, 0],
  [26.5, -1],
  [35, -1],
];

/**
 * 步态相位必须"累积"，不能拿 t×cadence 算。
 *
 * FigSvg 内部是 sp = t·2π·cadence。cadence 从 2.05 一路降到 0.30，
 * 如果直接传真实秒，t·cadence 会在减速段倒退（26s 时 23.9，27s 时 21.6），
 * 腿会倒着抽。所以这里把 ∫cadence dt 预先积出来，当"时间"传给人物，
 * 人物的 cadence 固定为 1。减速就自然变成"步子越来越慢"，而不是抽搐。
 */
const PHASE_DT = 1 / 240;
const PHASE: number[] = (() => {
  const out: number[] = [0];
  const steps = Math.ceil(37 / PHASE_DT);
  for (let i = 1; i <= steps; i++) {
    const mid = (i - 0.5) * PHASE_DT;
    out.push(out[i - 1] + kf(HCAD, mid) * PHASE_DT);
  }
  return out;
})();

export const heroPhaseAt = (sec: number) => {
  const idx = sec / PHASE_DT;
  const i = Math.max(0, Math.min(PHASE.length - 2, Math.floor(idx)));
  const f = idx - i;
  return PHASE[i] + (PHASE[i + 1] - PHASE[i]) * f;
};

export const heroXAt = (sec: number) => kf(HX, sec);
export const heroFootAt = (sec: number) => kf(HFOOT, sec);

export type HeroPose = {
  x: number;
  foot: number;
  h: number;
  cadence: number;
  stride: number;
  hunch: number;
  tilt: number;
  look: number;
  prop: 'lamp' | 'staff' | null;
  glow: number;
  turn: number;
  mode: 'run' | 'walk';
};

export const heroPoseAt = (sec: number): HeroPose => {
  // 摔倒：沙丘段本地 3.2s → 全局 8.3s
  const stumble = Math.exp(-Math.pow((sec - 8.3) / 0.22, 2));
  // 转头：海边段本地 2.65–3.7s → 全局 13.75–14.8s
  const lookRaw = sec > 13.75 && sec < 14.8 ? clamp01(Math.min((sec - 13.75) / 0.3, (14.8 - sec) / 0.3)) : 0;
  // 放慢：雪原段本地 2.1–3.2s → 全局 20.2–21.3s
  const slow =
    sec > 20.2 && sec < 21.3 ? clamp01(Math.min((sec - 20.2) / 0.35, (21.3 - sec) / 0.35)) : 0;

  const prop: HeroPose['prop'] = sec < 19 ? null : sec < 26 ? 'lamp' : 'staff';

  return {
    x: heroXAt(sec),
    foot: heroFootAt(sec) + stumble * 0.014,
    h: kf(HH, sec),
    cadence: Math.max(0.05, kf(HCAD, sec) - slow * 0.18),
    stride: kf(HSTR, sec),
    hunch: kf(HHUNCH, sec),
    tilt: kf(HTILT, sec) + stumble * 24 + slow * 3,
    look: -lookRaw,
    prop,
    glow: kf(HGLOW, sec),
    turn: kf(HTURN, sec),
    // 26.4s 之后从"跑"改"走"。切换发生在转身后、雾还没散尽时，看不见接缝
    mode: sec < 26.4 ? 'run' : 'walk',
  };
};
