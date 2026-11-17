/**
 * 一台摄像机 + 一个人：把"变"收敛到地貌和天色上
 *
 * 这是"过渡自然"的第二根支柱。分段做片子时，最常见的第二类错误是每段各有一套镜头
 * 和一个人：段尾 x=0.52，下一段开头 x=0.26；身高 214 跳到 208；foot 从 0.845 跳到 0.836。
 * 哪怕只有 0.5 秒叠化，观众看到的也是"一个人分成两个，还忽然矮了一截"。
 *
 * 所以：
 *   1. 镜头只有一台。全片共用一条 scale / x / y 曲线，最多一次缓推 + 一次后拉。
 *   2. 主角只有一个。同一个人从第 0 帧走到最后一帧，只靠下面这些曲线变化。
 *   3. 步态相位必须"累积"，不能拿 t×cadence 算 —— 见 makePhase 的注释。
 *
 * 这里的曲线是**示例**（一个人从童年走到老年），不是唯一写法。
 * 换成"一颗种子长成树"或"一辆车穿过城市"只要改曲线表。
 */

import {clamp01} from './util';

export type K = [number, number];

/**
 * 分段 smoothstep 关键帧插值。
 * 每个关键帧处一阶导为零，所以曲线不会在节点上"拐一下"——
 * 线性插值在相邻两段斜率不同的节点会留下一道折角，人眼在慢动作里能看见。
 */
export const kf = (keys: K[], sec: number) => {
  const n = keys.length;
  if (n === 0) return 0;
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

export type CamKey = {at: number; scale: number; x: number; y: number};

/**
 * 镜头基准必须 > 1。这条不是审美，是硬约束：
 *
 *   scale 一旦跌破 1，整块画面就缩进画框里，四周露出底色，成了一圈硬边；
 *   更难看的是 —— 地貌通常是"铺满整幅"画的，缩进去之后地面会在画面内侧断开、
 *   露出天，那道断口比暗边明显得多，加模糊也救不了（糊的是边界，不是断口）。
 *
 * 所以基准整体抬到 1.05 以上（示例片用的是 1.09～1.16），
 * 内容永远大于画框，边缘永远不出缝。代价是构图比原来推近一成。
 */
export const CAM_SCALE_FLOOR = 1.05;

export const makeCamera = (keys: CamKey[], floor = CAM_SCALE_FLOOR) => {
  const ks = [...keys].sort((a, b) => a.at - b.at);
  return (sec: number) => {
    const n = ks.length;
    let i = 0;
    if (sec > ks[0].at) {
      while (i < n - 2 && sec > ks[i + 1].at) i++;
    }
    const a = ks[i];
    const b = ks[i + 1];
    const w = b.at === a.at ? 0 : clamp01((sec - a.at) / (b.at - a.at));
    const e = w * w * (3 - 2 * w);
    return {
      scale: Math.max(floor, a.scale + (b.scale - a.scale) * e),
      x: a.x + (b.x - a.x) * e,
      y: a.y + (b.y - a.y) * e,
    };
  };
};

/* ------------------------------------------------------------------ */
/* 步态相位                                                            */
/* ------------------------------------------------------------------ */

/**
 * 步态相位必须"累积"，不能拿 t×cadence 算。
 *
 * 人物内部是 sp = t·2π·cadence。如果 cadence 从 2.05 一路降到 0.30，
 * 直接传真实秒的话 t·cadence 会在减速段**倒退**（26s 时 23.9，27s 时 21.6），
 * 腿会倒着抽 —— 这是最容易被误判成"渲染出错"的一个坑。
 *
 * 正确做法：把 ∫cadence dt 预先积出来当"时间"传给人物，人物的 cadence 固定为 1。
 * 于是减速自然变成"步子越来越慢"，而不是抽搐。
 */
export const makePhase = (cadence: K[], duration: number) => {
  const dt = 1 / 240;
  const steps = Math.ceil((duration + 2) / dt);
  const acc = new Float64Array(steps + 1);
  for (let i = 1; i <= steps; i++) acc[i] = acc[i - 1] + kf(cadence, (i - 0.5) * dt) * dt;
  return (sec: number) => {
    const idx = Math.min(steps - 1, Math.max(0, sec / dt));
    const i = Math.floor(idx);
    const f = idx - i;
    return acc[i] + (acc[i + 1] - acc[i]) * f;
  };
};

/* ------------------------------------------------------------------ */
/* 主角                                                                */
/* ------------------------------------------------------------------ */

export type HeroCurves = {
  /** 屏幕横向位置 0–1 */
  x: K[];
  /** 脚底 0–1（坡地在变，人一路走上去再走下来） */
  foot: K[];
  /** 身高 px。全片最重的一条曲线 */
  height: K[];
  /** 步频（步/秒）。2.05 是小孩的小跑，0.3 是拄杖挪步 */
  cadence: K[];
  /** 步幅系数 0–1.2 */
  stride: K[];
  /** 驼背 0–1 */
  hunch: K[];
  /** 上身前倾角度（度） */
  tilt: K[];
  /** 自发光强度（头顶烛光、脚下光斑） */
  glow: K[];
  /** 转身：1 → 0 → −1。0 那一帧是侧面 */
  turn: K[];
};

export type HeroEvent =
  /** 绊一下：高斯脉冲，短暂下沉 + 前倾 */
  | {kind: 'stumble'; at: number; width?: number; sink?: number; tilt?: number}
  /** 转头：梯形窗 */
  | {kind: 'look'; from: number; to: number; ramp?: number}
  /** 临时放慢：梯形窗，按 amount 扣步频 */
  | {kind: 'slow'; from: number; to: number; ramp?: number; amount?: number};

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
  mode: 'run' | 'walk' | 'idle' | 'sit';
};

const window01 = (sec: number, from: number, to: number, ramp: number) => {
  if (sec <= from || sec >= to) return 0;
  return clamp01(Math.min((sec - from) / ramp, (to - sec) / ramp));
};

export const makeHero = (
  curves: HeroCurves,
  opts: {
    duration: number;
    events?: HeroEvent[];
    propAt?: (sec: number) => HeroPose['prop'];
    modeAt?: (sec: number) => HeroPose['mode'];
  }
) => {
  const {duration, events = [], propAt = () => null, modeAt = () => 'run' as const} = opts;
  const phaseAt = makePhase(curves.cadence, duration);

  const poseAt = (sec: number): HeroPose => {
    let sink = 0;
    let tiltAdd = 0;
    let cadenceSub = 0;
    let look = 0;

    for (const e of events) {
      if (e.kind === 'stumble') {
        const w = e.width ?? 0.22;
        const pulse = Math.exp(-Math.pow((sec - e.at) / w, 2));
        sink += pulse * (e.sink ?? 0.014);
        tiltAdd += pulse * (e.tilt ?? 24);
      } else if (e.kind === 'look') {
        look -= window01(sec, e.from, e.to, e.ramp ?? 0.3);
      } else if (e.kind === 'slow') {
        cadenceSub += window01(sec, e.from, e.to, e.ramp ?? 0.35) * (e.amount ?? 0.18);
      }
    }

    return {
      x: kf(curves.x, sec),
      foot: kf(curves.foot, sec) + sink,
      h: kf(curves.height, sec),
      cadence: Math.max(0.05, kf(curves.cadence, sec) - cadenceSub),
      stride: kf(curves.stride, sec),
      hunch: kf(curves.hunch, sec),
      tilt: kf(curves.tilt, sec) + tiltAdd,
      look,
      prop: propAt(sec),
      glow: kf(curves.glow, sec),
      turn: kf(curves.turn, sec),
      mode: modeAt(sec),
    };
  };

  return {poseAt, phaseAt};
};

/* ------------------------------------------------------------------ */
/* 示例：一个人从童年走到老年（35 秒）                                  */
/* ------------------------------------------------------------------ */

export const EXAMPLE_CAM: CamKey[] = [
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

export const EXAMPLE_CURVES: HeroCurves = {
  x: [
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
  ],
  foot: [
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
  ],
  height: [
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
  ],
  cadence: [
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
  ],
  stride: [
    [0, 1.15],
    [6, 1.06],
    [12, 1.0],
    [19, 0.8],
    [25, 0.66],
    [28.8, 0.5],
    [31, 0.2],
    [35, 0.16],
  ],
  hunch: [
    [0, 0],
    [10, 0],
    [14, 0.06],
    [19, 0.34],
    [25, 0.55],
    [28.8, 0.86],
    [35, 0.88],
  ],
  tilt: [
    [0, 6],
    [6, 9],
    [12, 7],
    [19, 4],
    [25, 5],
    [28.8, 11],
    [35, 9],
  ],
  glow: [
    [0, 1],
    [24, 1],
    [27, 0.85],
    [31, 0.72],
    [35, 0.7],
  ],
  turn: [
    [0, 1],
    [25.5, 1],
    [26, 0],
    [26.5, -1],
    [35, -1],
  ],
};

export const EXAMPLE_EVENTS: HeroEvent[] = [
  {kind: 'stumble', at: 8.3},
  {kind: 'look', from: 13.75, to: 14.8},
  {kind: 'slow', from: 20.2, to: 21.3},
];

/** 道具切换：空手 → 提灯 → 杖。26.4s 之后从跑改走，切换藏在转身后的雾里 */
export const examplePropAt = (sec: number): HeroPose['prop'] => (sec < 19 ? null : sec < 26 ? 'lamp' : 'staff');
export const exampleModeAt = (sec: number): HeroPose['mode'] => (sec < 26.4 ? 'run' : 'walk');
