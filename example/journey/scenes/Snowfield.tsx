import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CFG} from '../config';
import {Airship, Bird, Figure} from '../components/Figure';
import {Particles} from '../components/Particles';
import {Ridges, type RidgeLayer} from '../components/Ridges';
import {clamp01} from '../lib/util';

/* 雪原 · 中年
   步幅收窄、背微驼、手里提着灯。
   路旁坐着一个佝偻老人 —— 主角放慢了一下，没有停。这是全片的伏笔。

   极光和"地平线上残留的冷光"已经交给 components/World.tsx，
   因为它们是天空的一部分，和星海的银河在同一层交接。 */

const W = CFG.width;
const H = CFG.height;

const LAYERS: RidgeLayer[] = [
  {
    base: 0.602,
    amp: 30,
    k: 0.0024,
    amp2: 12,
    k2: 0.0059,
    speed: 34,
    top: '#6E80A4',
    bot: '#2A3350',
    rim: '#BBD4F0',
    rimW: 1.8,
    rimA: 0.55,
    alpha: 0.9,
  },
  {
    base: 0.664,
    amp: 48,
    k: 0.0019,
    amp2: 18,
    k2: 0.0047,
    speed: 78,
    top: '#8A9CBC',
    bot: '#232C46',
    rim: '#CFE4FA',
    rimW: 2,
    rimA: 0.62,
  },
  {
    base: 0.744,
    amp: 86,
    k: 0.0015,
    amp2: 28,
    k2: 0.0035,
    speed: 138,
    top: '#A6B6CE',
    bot: '#1B2338',
    rim: '#E2F0FF',
    rimW: 2.4,
    rimA: 0.7,
    grain: 340,
    grainColor: '#EAF4FF',
  },
  {
    base: 0.868,
    amp: 120,
    k: 0.0011,
    amp2: 36,
    k2: 0.0028,
    speed: 214,
    top: '#7886A6',
    bot: '#0D1220',
    rim: '#C8DDF4',
    rimW: 2.6,
    rimA: 0.55,
    grain: 300,
    grainColor: '#DCEBFF',
  },
];

export const Snowfield: React.FC<{frame: number; sec: number}> = ({frame, sec}) => {
  const t = frame / CFG.fps;

  // 同伴 3.5 秒后从右侧靠上来，并肩
  const join = clamp01((t - 3.5) / 2.1);
  const eased = join * join * (3 - 2 * join);
  const c1 = 1.06 + (0.615 - 1.06) * eased;
  const c2 = 1.14 + (0.678 - 1.14) * eased;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Ridges t={t} layers={LAYERS} W={W} H={H} />

      {/* 路旁的老人：坐在雪堆上。雪堆的顶落在 y=0，才能和脚底严丝合缝。
          这条路上踩过三次：
            1. 直线斜边 + 140px 水平台面 → 截头金字塔，推近后就是一张桌子。
            2. 底部渐变淡出 → 雪堆下半截透明，背景雪脊从它肚子里穿过去，成了幽灵。
            3. 拉到出画的深色雪坡 → 形状对了，但 #242C42 在浅色雪原上读作一块黑石头，
               而且又窄又高，像座塔。
          现在：矮、宽、**雪色系**（顶面 #8CA0C4 受光，底部 #414D6E 接到雪原暗部），
          底边落在雪原面以下，颜色也接得上，所以不需要任何淡出或遮罩。 */}
      <svg
        width={300}
        height={120}
        viewBox="0 0 300 120"
        style={{position: 'absolute', left: '14.5%', top: '74.9%', transform: 'translateX(-50%)', overflow: 'visible'}}
      >
        <defs>
          <linearGradient id="driftBody" x1="0.28" y1="0" x2="0.74" y2="1">
            <stop offset="0%" stopColor="#8CA0C4" />
            <stop offset="26%" stopColor="#6E80A6" />
            <stop offset="66%" stopColor="#5B6B90" />
            <stop offset="100%" stopColor="#4A5878" />
          </linearGradient>
          <linearGradient id="driftRim" x1="0" y1="0.15" x2="0.92" y2="0.85">
            <stop offset="0%" stopColor="rgba(190,212,250,0.04)" />
            <stop offset="52%" stopColor="rgba(228,242,255,0.34)" />
            <stop offset="100%" stopColor="rgba(246,251,255,0.62)" />
          </linearGradient>
        </defs>

        {/* 雪包：左缓右稍陡，顶缘一条微隆的弧 */}
        <path
          d="M20,104 C22,80 40,62 66,48 C96,32 118,4 150,-4
             C182,-9 206,20 232,40 C258,60 276,80 282,106
             C258,124 208,134 150,134 C92,134 46,124 20,104 Z"
          fill="url(#driftBody)"
        />
        {/* 受光边：光从右上来，只描右肩与顶缘 */}
        <path
          d="M140,22 C152,0 170,-7 188,2 C204,10 214,28 228,44"
          fill="none"
          stroke="url(#driftRim)"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        {/* 顶上的薄雪：跟着弧走，两端收薄 */}
        <path
          d="M108,40 C124,14 140,-4 158,-7 C176,-9 190,6 202,22
             C188,30 172,34 156,34 C136,34 118,38 108,40 Z"
          fill="rgba(240,247,255,0.26)"
        />
        <ellipse cx={214} cy={52} rx={18} ry={6} fill="rgba(236,244,255,0.07)" />
      </svg>
      <Figure
        uid="elder"
        x={0.145}
        foot={0.749}
        W={W}
        H={H}
        h={112}
        t={t}
        mode="sit"
        hunch={0.95}
        cadence={0.3}
        prop="staff"
        glow={0.3}
        opacity={0.95}
      />
      <div
        style={{
          position: 'absolute',
          left: '15%',
          top: '74.8%',
          width: 170,
          height: 96,
          transform: 'translate(-50%,-100%)',
          background: 'radial-gradient(ellipse at 50% 80%, rgba(255,214,164,0.2) 0%, rgba(255,196,140,0) 72%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* 积雪的飞艇，比沙丘那段慢，气囊上压着一层雪 */}
      <Airship x={0.755 * W - t * 9} y={0.3 * H} scale={0.54} t={t + 2} snowy flip={1} opacity={0.9} uid="as-snow" />
      <Bird x={0.755 * W - t * 9 + 96} y={0.3 * H + 108} size={9} t={t} phase={1.2} color="rgba(30,34,48,0.8)" opacity={0.8} />

      {/* 同伴：并肩，间距恒定 */}
      <Figure
        uid="compA"
        x={c1}
        foot={0.806}
        W={W}
        H={H}
        h={192}
        t={t}
        mode="run"
        cadence={1.3}
        stride={0.72}
        hunch={0.28}
        tilt={4}
        glow={0.85}
        opacity={join > 0.02 ? 1 : 0}
      />
      <Figure
        uid="compB"
        x={c2}
        foot={0.796}
        W={W}
        H={H}
        h={176}
        t={t + 0.5}
        mode="run"
        cadence={1.26}
        stride={0.7}
        hunch={0.3}
        tilt={4}
        glow={0.8}
        opacity={join > 0.02 ? 0.95 : 0}
      />

      {/* 雪：横向飞 + 下落 */}
      <Particles
        t={t}
        W={W}
        H={H}
        seed={CFG.seed + 41}
        spec={{
          count: 200,
          rMin: 0.6,
          rMax: 1.8,
          speedMin: 80,
          speedMax: 220,
          mode: 'down',
          colors: ['#FFFFFF', '#E8F2FF', '#D6E6FA'],
          alphaMin: 0.1,
          alphaMax: 0.52,
          sway: 20,
          streak: 1.3,
        }}
      />
      <Particles
        t={t}
        W={W}
        H={H}
        seed={CFG.seed + 42}
        spec={{
          count: 60,
          rMin: 0.8,
          rMax: 2.2,
          speedMin: 320,
          speedMax: 640,
          mode: 'side',
          colors: ['#FFFFFF', '#E2EEFF'],
          alphaMin: 0.06,
          alphaMax: 0.26,
          streak: 3.4,
        }}
      />
    </AbsoluteFill>
  );
};
