import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CFG} from '../config';
import {kf, type K} from '../lib/clock';
import {clamp01} from '../lib/util';
import {skyAt, skyTintAt} from '../lib/sky';
import {Particles} from './Particles';
import {HorizonGlow, SkyGradient, Sun} from './Sky';

/**
 * 全局世界层：一片天，从第 0 秒亮到第 35 秒暗。
 *
 * 它永远在最底下，任何地貌都在它上面。所以地貌叠化的时候，
 * 占画面一半面积的那层连一帧都没变 —— 这就是"没有切换感"的根本。
 *
 * 顺带把四样原本各段私有、且互相矛盾的东西也统一了：
 *   太阳（一条升落弧）、地平线暖光（一条 y 曲线）、
 *   极光与银河（雪原段渐隐、星海段渐显，交接处两者共存）、
 *   底部压暗（取中天色，各段同源，叠化不跳色）。
 */

const W = CFG.width;
const H = CFG.height;

/* 太阳：黎明低 → 沙丘偏高 → 海边落到海面 → 雪原只剩一点冷辉 → 夜，熄灭 */
const SUN_K = [
  {at: 0, x: 0.5, y: 0.615, scale: 1.0, intensity: 1.0, halo: 1500, core: 330, tint: '255,244,214'},
  {at: 6, x: 0.456, y: 0.568, scale: 1.1, intensity: 1.08, halo: 1640, core: 378, tint: '255,238,196'},
  {at: 12, x: 0.603, y: 0.652, scale: 1.34, intensity: 1.15, halo: 1500, core: 300, tint: '255,232,186'},
  {at: 19, x: 0.53, y: 0.646, scale: 0.82, intensity: 0.5, halo: 1300, core: 220, tint: '214,232,255'},
  {at: 25.5, x: 0.52, y: 0.644, scale: 0.72, intensity: 0.12, halo: 1240, core: 210, tint: '206,226,255'},
  {at: 30, x: 0.51, y: 0.642, scale: 0.66, intensity: 0.0, halo: 1200, core: 200, tint: '200,222,255'},
  {at: 35, x: 0.5, y: 0.64, scale: 0.62, intensity: 0.0, halo: 1200, core: 200, tint: '200,222,255'},
];

const K_HORIZON: K[] = [
  [0, 0.671],
  [6, 0.667],
  [12, 0.664],
  [19, 0.664],
  [26, 0.661],
  [35, 0.66],
];

/** 导出给海面用：落日光池必须和天上那颗太阳对齐 */
export const sunAt = (sec: number) => {
  const n = SUN_K.length;
  let i = 0;
  while (i < n - 2 && sec > SUN_K[i + 1].at) i++;
  const a = SUN_K[i];
  const b = SUN_K[i + 1];
  const w = clamp01((sec - a.at) / (b.at - a.at));
  const e = w * w * (3 - 2 * w);
  const mix = (p: number, q: number) => p + (q - p) * e;
  // tint 是 "r,g,b"，逐通道插值，否则太阳色温会在段间跳
  const ta = a.tint.split(',').map(Number);
  const tb = b.tint.split(',').map(Number);
  return {
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    scale: mix(a.scale, b.scale),
    intensity: mix(a.intensity, b.intensity),
    halo: mix(a.halo, b.halo),
    core: mix(a.core, b.core),
    tint: ta.map((v, k) => Math.round(v + (tb[k] - v) * e)).join(','),
  };
};

/** 极光：雪原段进来，星海段让位给银河 */
const AURORA: [number, number] = [20.6, 26.4];
/** 银河：暮色末尾开始显，一直到最后 */
const GALAXY: [number, number] = [24.6, 29.4];
/** 星点：暮色里星星先出来，不用等到全黑 */
const STARS: [number, number] = [23.4, 27.6];

const ramp = ([a, b]: [number, number], sec: number) => {
  const w = clamp01((sec - a) / (b - a));
  return w * w * (3 - 2 * w);
};

export const SkyLayer: React.FC<{sec: number}> = ({sec}) => {
  const stops = skyAt(sec);
  const tint = skyTintAt(sec);
  const sun = sunAt(sec);
  const horizonY = kf(K_HORIZON, sec);

  const auroraA = ramp(AURORA, sec) * (1 - ramp([25.4, 26.9], sec) * 0.85);
  const galaxyA = ramp(GALAXY, sec);
  const starsA = ramp(STARS, sec);

  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#05070f'}}>
      <SkyGradient stops={stops} />

      {/* 银河：一条斜贯的暗光带。它和极光在这一层交替，不是"换背景" */}
      {galaxyA > 0.01 && (
        <div
          style={{
            position: 'absolute',
            left: '-14%',
            top: '4%',
            width: '128%',
            height: '46%',
            transform: 'rotate(-17deg)',
            background:
              'linear-gradient(180deg, rgba(150,178,255,0) 0%, rgba(160,186,255,0.16) 24%, rgba(214,226,255,0.3) 46%, rgba(180,196,255,0.13) 66%, rgba(150,178,255,0) 100%)',
            filter: 'blur(30px)',
            mixBlendMode: 'screen',
            opacity: galaxyA,
          }}
        />
      )}

      {/* 极光：三层斜向带，缓慢反向漂移 */}
      {auroraA > 0.01 &&
        [0, 1, 2].map((i) => (
          <div
            key={`au${i}`}
            style={{
              position: 'absolute',
              left: `${-30 + Math.sin(sec * 0.13 + i * 1.6) * 9 + i * 26}%`,
              top: `${6 + i * 10}%`,
              width: '96%',
              height: `${14 + i * 4}%`,
              transform: 'rotate(-13deg)',
              background:
                'linear-gradient(180deg, rgba(120,220,210,0) 0%, rgba(126,226,206,0.22) 42%, rgba(150,206,244,0.16) 68%, rgba(140,190,240,0) 100%)',
              filter: 'blur(26px)',
              opacity: auroraA * (0.95 - i * 0.16),
              mixBlendMode: 'screen',
            }}
          />
        ))}

      {/* 星点两层：720 颗细碎的铺底 + 26 颗带光晕的亮星。
          全是光斑会像雪，不是星空 */}
      {starsA > 0.01 && (
        <AbsoluteFill style={{opacity: starsA}}>
          <Particles
            t={sec}
            W={W}
            H={H}
            seed={CFG.seed + 81}
            spec={{
              count: 720,
              rMin: 0.35,
              rMax: 1.15,
              speedMin: 0,
              speedMax: 0,
              mode: 'static',
              colors: ['#FFFFFF', '#D6E4FF', '#FFEAC8'],
              alphaMin: 0.22,
              alphaMax: 0.86,
              twinkle: 0.5,
              sway: 0,
            }}
            offsetY={-40}
          />
          <Particles
            t={sec}
            W={W}
            H={H}
            seed={CFG.seed + 82}
            spec={{
              count: 26,
              rMin: 1,
              rMax: 1.6,
              speedMin: 0,
              speedMax: 0,
              mode: 'static',
              colors: ['#FFFFFF', '#CFE0FF', '#FFE3B8'],
              alphaMin: 0.5,
              alphaMax: 1,
              twinkle: 0.45,
              sway: 0,
              glow: true,
            }}
            offsetY={-60}
          />
        </AbsoluteFill>
      )}

      {/* 太阳：一条升落弧。y 只走 0.615→0.545→0.652，低角度的一整天 */}
      <Sun
        x={sun.x}
        y={sun.y}
        t={sec}
        scale={sun.scale}
        halo={sun.halo}
        core={sun.core}
        intensity={sun.intensity}
        tint={sun.tint}
      />

      <HorizonGlow y={horizonY} opacity={0.9} tint={tint.mist} />

      {/* 底部压暗：颜色跟着天色走，五段同一个来源，叠化时不会忽然换个色温 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '15%',
          background: `linear-gradient(180deg, rgba(${tint.floor},0) 0%, rgba(${tint.floor},0.42) 58%, rgba(${tint.floor},0.78) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
