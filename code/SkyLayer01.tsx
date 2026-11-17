import React from 'react';
import {AbsoluteFill} from 'remotion';
import {kf, type K} from './pose01';
import {clamp01} from './util';
import type {Sky} from './sky01';
import {Particles01} from './Particles01';
import {HorizonGlow, SkyGradient, Sun} from './SkyParts01';

/**
 * 全局世界层：一片天，从第一秒到最后一秒连续变化。
 *
 * 它永远在最底下，任何地貌都在它上面。所以地貌接力的时候，
 * 占画面一半面积的那层连一帧都没变 —— 这就是"没有切换感"的根本。
 *
 * 这里还统一了四样原本各段私有、且互相矛盾的东西：
 *   太阳（一条升落弧）、地平线暖光（一条 y 曲线）、
 *   极光与银河（一个渐隐一个渐显，交接处共存）、
 *   底部压暗（取中天色，各段同源，接力时不跳色）。
 *
 * 只要这四样各段各写一遍，地貌再怎么接力都会露馅 —— 因为天上会同时出现两个太阳。
 */

export type SunKey = {
  at: number;
  x: number;
  y: number;
  scale: number;
  intensity: number;
  halo: number;
  core: number;
  /** "r,g,b"，逐通道插值，否则太阳色温会在段间跳 */
  tint: string;
};

/** 太阳位置与强度。导出给"海面光池"之类需要跟太阳对齐的东西用 */
export const makeSun = (keys: SunKey[]) => {
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
    const mix = (p: number, q: number) => p + (q - p) * e;
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
};

const ramp = ([a, b]: [number, number], sec: number) => {
  const w = clamp01((sec - a) / (b - a));
  return w * w * (3 - 2 * w);
};

export const SkyLayer01: React.FC<{
  sec: number;
  sky: Sky;
  /** 太阳曲线。不给就不画太阳（纯夜色片子） */
  sun?: SunKey[];
  /** 地平线 y 曲线（0–1） */
  horizon?: K[];
  /** 极光出现窗口 [起, 满]。null 表示全片不要 */
  aurora?: [number, number] | null;
  /** 银河窗口 */
  galaxy?: [number, number] | null;
  /** 星点窗口 */
  stars?: [number, number] | null;
  width?: number;
  height?: number;
  seed?: number;
  /** 底部压暗带的高度（占画面比例） */
  floorHeight?: number;
}> = ({
  sec,
  sky,
  sun,
  horizon = [[0, 0.66], [1e9, 0.66]],
  aurora = [20.6, 26.4],
  galaxy = [24.6, 29.4],
  stars = [23.4, 27.6],
  width = 1920,
  height = 1080,
  seed = 20260101,
  floorHeight = 0.15,
}) => {
  const stops = sky.skyAt(sec);
  const tint = sky.skyTintAt(sec);
  const sunNow = sun ? makeSun(sun)(sec) : null;
  const horizonY = kf(horizon, sec);

  const auroraA = aurora ? ramp(aurora, sec) * (1 - ramp([25.4, 26.9], sec) * 0.85) : 0;
  const galaxyA = galaxy ? ramp(galaxy, sec) : 0;
  const starsA = stars ? ramp(stars, sec) : 0;

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

      {/* 星点两层：大量细碎铺底 + 少量带光晕的亮星。
          全是光斑会像雪，不是星空 —— 必须有大小与亮度两层 */}
      {starsA > 0.01 && (
        <AbsoluteFill style={{opacity: starsA}}>
          <Particles01
            t={sec}
            W={width}
            H={height}
            seed={seed + 81}
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
          <Particles01
            t={sec}
            W={width}
            H={height}
            seed={seed + 82}
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

      {sunNow && (
        <Sun
          x={sunNow.x}
          y={sunNow.y}
          t={sec}
          scale={sunNow.scale}
          halo={sunNow.halo}
          core={sunNow.core}
          intensity={sunNow.intensity}
          tint={sunNow.tint}
        />
      )}

      <HorizonGlow y={horizonY} opacity={0.9} tint={tint.mist} />

      {/* 底部压暗：颜色跟着天色走，各段同一个来源，接力时不会忽然换个色温 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${floorHeight * 100}%`,
          background: `linear-gradient(180deg, rgba(${tint.floor},0) 0%, rgba(${tint.floor},0.42) 58%, rgba(${tint.floor},0.78) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** 示例：黎明低 → 日头偏西 → 落到海面 → 只剩冷辉 → 熄灭 */
export const EXAMPLE_SUN: SunKey[] = [
  {at: 0, x: 0.5, y: 0.615, scale: 1.0, intensity: 1.0, halo: 1500, core: 330, tint: '255,244,214'},
  {at: 6, x: 0.456, y: 0.568, scale: 1.1, intensity: 1.08, halo: 1640, core: 378, tint: '255,238,196'},
  {at: 12, x: 0.603, y: 0.652, scale: 1.34, intensity: 1.15, halo: 1500, core: 300, tint: '255,232,186'},
  {at: 19, x: 0.53, y: 0.646, scale: 0.82, intensity: 0.5, halo: 1300, core: 220, tint: '214,232,255'},
  {at: 25.5, x: 0.52, y: 0.644, scale: 0.72, intensity: 0.12, halo: 1240, core: 210, tint: '206,226,255'},
  {at: 30, x: 0.51, y: 0.642, scale: 0.66, intensity: 0.0, halo: 1200, core: 200, tint: '200,222,255'},
  {at: 35, x: 0.5, y: 0.64, scale: 0.62, intensity: 0.0, halo: 1200, core: 200, tint: '200,222,255'},
];
