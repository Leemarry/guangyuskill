import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CFG} from '../config';
import {Airship, Figure, Kite} from '../components/Figure';
import {Particles} from '../components/Particles';
import {Ridges, type RidgeLayer} from '../components/Ridges';
import {heroFootAt, heroXAt} from '../lib/clock';
import {clamp01} from '../lib/util';

/* 沙丘 · 少年
   少年是"冲"的：步频高、前倾大、跳着跑。
   3.2 秒处摔一次 —— 手掌撑地、立刻起身，不喊不停。这一跤就是长大的动作。

   主角和镜头都不在这里了。这里只剩：沙脊、同行者、滑沙的孩子、断线风筝、飞艇。
   连"摔倒"这个动作也不在这里 —— 它在 lib/clock.ts 里，因为那是主角自己的事。 */

const W = CFG.width;
const H = CFG.height;

const FAR: RidgeLayer[] = [
  {
    base: 0.548,
    amp: 20,
    k: 0.0026,
    amp2: 9,
    k2: 0.0061,
    speed: 40,
    top: '#7C4C46',
    bot: '#3A1E28',
    rim: '#FFC98E',
    rimW: 1.7,
    rimA: 0.4,
    alpha: 0.92,
  },
  {
    base: 0.602,
    amp: 34,
    k: 0.002,
    amp2: 14,
    k2: 0.0049,
    speed: 96,
    top: '#8E5546',
    bot: '#2C161E',
    rim: '#FFCE96',
    rimW: 1.8,
    rimA: 0.42,
  },
];

const NEAR: RidgeLayer[] = [
  {
    base: 0.678,
    amp: 52,
    k: 0.0016,
    amp2: 20,
    k2: 0.0037,
    speed: 172,
    top: '#AA6A4E',
    bot: '#241018',
    rim: '#FFD6A2',
    rimW: 1.9,
    rimA: 0.44,
    grain: 300,
    grainColor: '#FFDCAE',
  },
  {
    base: 0.79,
    amp: 84,
    k: 0.0012,
    amp2: 30,
    k2: 0.0029,
    speed: 292,
    top: '#8A4E3C',
    bot: '#170A10',
    rim: '#FFD9A8',
    rimW: 2.1,
    rimA: 0.4,
    grain: 420,
    grainColor: '#FFD2A0',
  },
];

export const Dunes: React.FC<{frame: number; sec: number}> = ({frame, sec}) => {
  const t = frame / CFG.fps;
  // 镜头抖动属于"少年冲劲儿"，留在这一段内；全局镜头在上面一层
  const shake = Math.sin(t * 31) * 1.5 + Math.sin(t * 17.3) * 1.0;

  // 摔倒扬尘：主角现在是全局的，但他的位置从同一个时钟取，所以尘还落在他脚下
  const stumble = Math.exp(-Math.pow((sec - 8.3) / 0.22, 2));
  const hx = heroXAt(sec);
  const hf = heroFootAt(sec);

  // 滑沙的孩子：从沙脊上冲下来，越近越大；滑到底后化开，不留一个僵住的人
  const slideP = clamp01((t - 0.8) / 3.6);
  const sliderX = 0.36 - slideP * 0.17;
  const sliderFoot = 0.706 + slideP * 0.088;
  const sliderH = 74 + slideP * 44;
  const sliderA = 1 - clamp01((t - 4.6) / 1.2);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translate(${shake}px, 0)`}}>
        <Ridges t={t} layers={FAR} W={W} H={H} />

        {/* 远处沙脊上的同行者：渐渐被拉开，下半个身子被近处沙脊挡住 */}
        <Figure
          uid="duneA"
          x={0.735 - t * 0.012}
          foot={0.664}
          W={W}
          H={H}
          h={94}
          t={t}
          mode="run"
          cadence={1.7}
          tilt={7}
          glow={0.75}
          opacity={0.72}
          blur={1.6}
        />
        <Figure
          uid="duneB"
          x={0.797 - t * 0.014}
          foot={0.671}
          W={W}
          H={H}
          h={84}
          t={t}
          mode="run"
          cadence={1.6}
          tilt={7}
          glow={0.7}
          opacity={0.64}
          blur={2.1}
        />

        <Ridges t={t} layers={NEAR} W={W} H={H} />

        {/* 滑沙的孩子：坐在沙脊上张着双臂冲下来 */}
        {sliderA > 0.02 && (
          <>
            <Figure
              uid="slider"
              x={sliderX}
              foot={sliderFoot}
              W={W}
              H={H}
              h={sliderH}
              t={t}
              mode="sit"
              tilt={-13}
              cadence={0.4}
              glow={0.65}
              opacity={0.9 * sliderA}
            />
            {/* 滑沙带起的沙尾 */}
            <div
              style={{
                position: 'absolute',
                left: `${(sliderX + 0.055) * 100}%`,
                top: `${(sliderFoot - 0.012) * 100}%`,
                width: 300,
                height: 62,
                transform: 'translate(-50%,-50%)',
                background:
                  'radial-gradient(ellipse 60% 50% at 62% 50%, rgba(255,224,180,0.34) 0%, rgba(240,190,140,0.16) 44%, rgba(232,180,130,0) 76%)',
                filter: 'blur(10px)',
                opacity: 0.85 * sliderA,
              }}
            />
          </>
        )}

        {/* 断线风筝：卡在近处沙脊上，尾布被风吹直 */}
        <Kite x={0.775 * W - t * 26} y={0.788 * H} size={66} t={t} rot={26} color="#2a1a20" tail={2.2} opacity={0.9} />

        {/* 飞艇：从上方缓慢横移 */}
        <Airship x={0.63 * W - t * 12} y={0.225 * H} scale={0.6} t={t} flip={1} opacity={0.94} uid="as-dune" />

        {/* 摔倒扬起的沙 */}
        {stumble > 0.05 && (
          <div
            style={{
              position: 'absolute',
              left: `${(hx - 0.04) * 100}%`,
              top: `${(hf - 0.02) * 100}%`,
              width: 280 * stumble,
              height: 80 * stumble,
              transform: 'translate(-50%,-50%)',
              background:
                'radial-gradient(ellipse at center, rgba(255,214,168,0.42) 0%, rgba(232,178,124,0.16) 46%, rgba(220,160,110,0) 76%)',
              filter: 'blur(12px)',
              opacity: stumble * 0.75,
            }}
          />
        )}

        {/* 风里的沙粒：暖色、细、别太亮，否则像下雪 */}
        <Particles
          t={t}
          W={W}
          H={H}
          seed={CFG.seed + 21}
          spec={{
            count: 190,
            rMin: 0.6,
            rMax: 1.9,
            speedMin: 420,
            speedMax: 1050,
            mode: 'side',
            colors: ['#F0CB9E', '#E0AE7E', '#FFE2BC'],
            alphaMin: 0.06,
            alphaMax: 0.3,
            streak: 3,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
