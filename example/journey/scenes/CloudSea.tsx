import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CFG} from '../config';
import {CloudField, buildClouds, type CloudBand} from '../components/CloudField';
import {Bird, Kite, localToScreen} from '../components/Figure';
import {Particles} from '../components/Particles';
import {heroFootAt, heroPoseAt, heroXAt} from '../lib/clock';
import {clamp01, type CloudTone} from '../lib/util';

/* 云海 · 童年
   这一段的任务只有两个字：轻。
   孩子还没学会"有目的"，所以他跑得不快，但步频最高、腿分得最开。

   注意：这里已经不画天空、不画太阳、不画主角了。
   天空与太阳在 components/World.tsx，主角在 components/Hero.tsx —— 全片共用一份。
   这个文件只负责"云"和那只风筝。 */

const W = CFG.width;
const H = CFG.height;

const BANDS: CloudBand[] = [
  {y: 0.2, h: 240, speed: 8, n: 4, dn: 0, wMin: 900, wMax: 1700, aMin: 0.05, aMax: 0.1, tone: 0, jitter: 52},
  {y: 0.42, h: 200, speed: 15, n: 4, dn: 0, wMin: 760, wMax: 1400, aMin: 0.045, aMax: 0.09, tone: 0, jitter: 46},
  {y: 0.702, h: 86, speed: 48, n: 28, dn: 0, wMin: 200, wMax: 330, aMin: 0.3, aMax: 0.56, tone: 0, jitter: 5},
  {y: 0.748, h: 112, speed: 78, n: 28, dn: 0, wMin: 260, wMax: 400, aMin: 0.36, aMax: 0.62, tone: 0, jitter: 8},
  {y: 0.796, h: 144, speed: 122, n: 24, dn: 0, wMin: 320, wMax: 470, aMin: 0.42, aMax: 0.68, tone: 0, jitter: 14},
  {y: 0.85, h: 182, speed: 184, n: 20, dn: 8, wMin: 410, wMax: 580, aMin: 0.48, aMax: 0.74, tone: 1, jitter: 20},
  {y: 0.91, h: 224, speed: 252, n: 18, dn: 10, wMin: 500, wMax: 700, aMin: 0.58, aMax: 0.82, tone: 2, jitter: 22},
  {y: 0.982, h: 272, speed: 314, n: 14, dn: 12, wMin: 620, wMax: 860, aMin: 0.7, aMax: 0.92, tone: 3, jitter: 22},
  {y: 1.07, h: 348, speed: 386, n: 8, dn: 8, wMin: 900, wMax: 1300, aMin: 0.56, aMax: 0.82, tone: 3, jitter: 18},
];

const TONES: CloudTone[] = [
  {top: '#FFEBD4', bot: '#6B4C57', topLight: 0.72},
  {top: '#D8B8DC', bot: '#33223F', topLight: 0.52},
  {top: '#B493AE', bot: '#150E22', topLight: 0.44},
  {top: '#6E5578', bot: '#0C0716', topLight: 0.16},
];

const CLOUDS = buildClouds(BANDS, CFG.seed + 11, W, 1000);

export const CloudSea: React.FC<{frame: number; sec: number}> = ({frame, sec}) => {
  const t = frame / CFG.fps;
  const hero = heroPoseAt(sec);
  const hx = heroXAt(sec);
  const hfoot = heroFootAt(sec);

  // 风筝是孩子牵着的那只。线从主角的手牵过去，风筝在他右上方
  const kiteX = hx + 0.295;
  const kiteY = 0.245 + Math.sin(t * 0.9) * 0.012;
  const hand = localToScreen({x: 79, y: 116}, {x: hx, foot: hfoot, h: hero.h, W, H});
  // 云海段退场时风筝先散：它是这一段的东西，不该跟着飘进沙丘
  const kiteA = 1 - clamp01((sec - 5.0) / 1.2);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <CloudField t={t} clouds={CLOUDS} tones={TONES} W={W} H={H} pad={1000} />

      {/* 风筝的线：从孩子的手牵到风筝，风筝是被他拽着飞的 */}
      {kiteA > 0.02 && (
        <>
          <svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <path
              d={`M${hand.x},${hand.y} Q${(hand.x + kiteX * W) / 2 + 40},${(hand.y + kiteY * H) / 2 - 60} ${
                kiteX * W
              },${kiteY * H + 60}`}
              stroke={`rgba(255,232,196,${0.24 * kiteA})`}
              strokeWidth={1.4}
              fill="none"
            />
          </svg>
          <Kite
            x={kiteX * W}
            y={kiteY * H}
            size={96}
            t={t}
            rot={Math.sin(t * 0.8) * 7}
            color="#2b2030"
            tail={1}
            opacity={kiteA}
          />
        </>
      )}

      {/* 小鸟：从右下往左上掠过 */}
      {[0, 1, 2, 3, 4].map((i) => {
        const bx = 1.1 - (t * 0.088 + i * 0.055);
        const by = 0.34 - t * 0.009 + i * 0.032 + Math.sin(t * 0.9 + i) * 0.008;
        if (bx < -0.08) return null;
        return (
          <Bird key={`b${i}`} x={bx * W} y={by * H} size={17 + (i % 3) * 4} t={t} phase={i * 1.7} opacity={0.72} />
        );
      })}

      <Particles
        t={t}
        W={W}
        H={H}
        seed={CFG.seed + 3}
        spec={{
          count: 110,
          rMin: 0.7,
          rMax: 2.4,
          speedMin: 16,
          speedMax: 54,
          mode: 'up',
          colors: ['#FFF3DC', '#FFD9A6', '#CFE9F5'],
          alphaMin: 0.08,
          alphaMax: 0.34,
          twinkle: 0.45,
          sway: 24,
          glow: true,
          yRange: [0.5, 1.02],
        }}
      />
    </AbsoluteFill>
  );
};
