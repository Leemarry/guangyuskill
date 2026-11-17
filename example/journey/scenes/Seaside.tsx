import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CFG} from '../config';
import {Bird, FigSvg, Figure, figWidth} from '../components/Figure';
import {Particles} from '../components/Particles';
import {SeaField} from '../components/Ridges';
import {sunAt} from '../components/World';
import {heroFootAt, heroXAt} from '../lib/clock';
import {clamp01} from '../lib/util';

/* 海边 · 青年
   唯一的"分心"发生在这一段：跑过一对牵手旋转的人时，头转过去了，脚步慢了半拍。
   这一段是全片最亮的地方，也是后面两段要还的债。

   海面那团落日光池留在这里 —— 它虽然属于天空，但只落在水面上，
   所以位置直接读全局的太阳（sunAt），和天上的那颗永远对齐。 */

const W = CFG.width;
const H = CFG.height;

const SEA_COLORS = {
  crest: '#FFECCE',
  glow: '#FFC98A',
  base: '#2C3F4E',
  deep: '#101B2A',
};

const horizon = 0.664;

export const Seaside: React.FC<{frame: number; sec: number}> = ({frame, sec}) => {
  const t = frame / CFG.fps;
  const sun = sunAt(sec);
  const sunX = sun.x;

  // 情侣必须在主角路径的右侧。原来放在 0.535，而主角现在会经过 0.50 ——
  // 两个半透明剪影压在一起就糊成一团黑影。挪到 0.655，主角从他们左边跑过，
  // 转头那一下才看得见"他在看别人"。
  const coupleX = 0.655;
  const coupleFoot = 0.786;
  const dance = Math.sin(t * 1.05) * 19;

  const hx = heroXAt(sec);
  const hf = heroFootAt(sec);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {/* 海面的落日光池：椭圆软光，别用梯形直接切，blur 会被 clip-path 裁掉露出直边 */}
      <div
        style={{
          position: 'absolute',
          left: `${sunX * 100}%`,
          top: `${horizon * 100}%`,
          width: 1500,
          height: (1 - horizon) * H * 1.1,
          transform: 'translate(-50%,-12%)',
          background:
            'radial-gradient(ellipse 34% 62% at 50% 42%, rgba(255,226,176,0.5) 0%, rgba(255,204,150,0.24) 42%, rgba(255,190,140,0.06) 68%, rgba(255,180,130,0) 86%)',
          filter: 'blur(30px)',
          mixBlendMode: 'screen',
          opacity: clamp01(sun.intensity),
        }}
      />

      <SeaField t={t} W={W} H={H} horizon={horizon} sunX={sunX} colors={SEA_COLORS} speed={0.05} />

      {/* 坐在礁石上的人：另一种人生选择。给个石头，否则看不出是坐着 */}
      <div
        style={{
          position: 'absolute',
          left: '21.2%',
          top: '78.4%',
          width: 118,
          height: 46,
          transform: 'translate(-50%,0)',
          borderRadius: '54% 46% 26% 30% / 82% 78% 24% 20%',
          background: 'linear-gradient(180deg, #4A3B44 0%, #1A1520 76%)',
          boxShadow: '0 -2px 0 rgba(255,206,160,0.28)',
        }}
      />
      <Figure
        uid="sitter"
        x={0.212}
        foot={0.786}
        W={W}
        H={H}
        h={124}
        t={t}
        mode="sit"
        hunch={0.3}
        glow={0.4}
        opacity={0.94}
        blur={0.4}
      />

      {/* 情侣：牵手旋转。两个人一起转、一起向对方倾，才读得出"跳舞" */}
      <div
        style={{
          position: 'absolute',
          left: `${coupleX * 100}%`,
          top: `${coupleFoot * 100}%`,
          transform: 'translate(-50%,-100%)',
        }}
      >
        <div
          style={{
            transform: `rotate(${dance}deg)`,
            transformOrigin: '50% 92%',
            display: 'flex',
            alignItems: 'flex-end',
            marginLeft: -figWidth(152) * 0.4,
          }}
        >
          <div style={{marginRight: -figWidth(152) * 0.04}}>
            <FigSvg uid="danceA" h={152} t={t} mode="walk" dir={1} cadence={0.7} stride={0.45} tilt={13} glow={0.9} />
          </div>
          <div>
            {/* 倾角不能大：两人都往里倾到 15° 时，头会撞在一起，
                整对只剩一团黑影加一个亮点。分开站、只微微相向，
                两个头和两条腿都在，才读得出"两个人在转" */}
            <FigSvg
              uid="danceB"
              h={140}
              t={t + 0.4}
              mode="walk"
              dir={-1}
              cadence={0.7}
              stride={0.4}
              tilt={-8}
              glow={0.9}
              rim="rgba(255,208,154,0.42)"
              skirt={7}
            />
          </div>
        </div>
      </div>

      {/* 两人之间的暖光，把"牵手"这件事点出来 */}
      <div
        style={{
          position: 'absolute',
          left: `${coupleX * 100}%`,
          top: `${(coupleFoot - 0.082) * 100}%`,
          width: 62,
          height: 40,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(ellipse at center, rgba(255,226,176,0.55) 0%, rgba(255,196,140,0) 74%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* 溅起的水花：跟着主角的步频走。位置读全局，所以人也换了 46 次位置它也还在脚下 */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const ph = (t * 1.62 + i * 0.29) % 1;
        const a = Math.max(0, 1 - ph * 3.2);
        if (a <= 0.02) return null;
        return (
          <div
            key={`sp${i}`}
            style={{
              position: 'absolute',
              left: `${(hx - 0.028 + i * 0.009) * 100}%`,
              top: `${(hf - 0.004 - ph * 0.014) * 100}%`,
              width: 9 + ph * 24,
              height: 4 + ph * 8,
              borderRadius: '50%',
              background: 'rgba(255,246,230,0.66)',
              filter: 'blur(1.8px)',
              opacity: a * 0.7,
            }}
          />
        );
      })}

      {/* 海鸥：几乎不扇翅，滑翔 */}
      {[0, 1, 2].map((i) => (
        <Bird
          key={`gull${i}`}
          x={0.88 * W - (t * 38 + i * 130)}
          y={(0.45 + i * 0.05 + Math.sin(t * 0.6 + i) * 0.012) * H}
          size={30 - i * 5}
          t={t}
          phase={i * 2.1}
          glide
          color="rgba(255,240,220,0.78)"
          opacity={0.82}
        />
      ))}

      {/* 海面反光里的空气粒子 */}
      <Particles
        t={t}
        W={W}
        H={H}
        seed={CFG.seed + 31}
        spec={{
          count: 110,
          rMin: 0.7,
          rMax: 2.4,
          speedMin: 10,
          speedMax: 36,
          mode: 'up',
          colors: ['#FFEDCE', '#FFD9A6'],
          alphaMin: 0.06,
          alphaMax: 0.28,
          twinkle: 0.5,
          sway: 22,
          glow: true,
          yRange: [0.45, 1.02],
        }}
      />
    </AbsoluteFill>
  );
};
