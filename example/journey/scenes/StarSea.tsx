import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CFG} from '../config';
import {CloudField, buildClouds, type CloudBand} from '../components/CloudField';
import {Figure, Kite} from '../components/Figure';
import {Particles} from '../components/Particles';
import {heroXAt} from '../lib/clock';
import {clamp01, type CloudTone} from '../lib/util';

/* 星海 · 老年
   全片唯一一段：主角向左走（前四段都是向右跑）。26 秒那次转身发生在雾里，
   由 Hero 的 scaleX 演出，不是这里的事。
   0:29.5 一群孩子从他身边跑过 —— 一生的闭环在这里合上，不用一句台词。

   银河、星点、夜空都已经在 components/World.tsx。
   这里只剩"发光的云海"这一层地面。 */

const W = CFG.width;
const H = CFG.height;

const BANDS: CloudBand[] = [
  {y: 0.694, h: 78, speed: 40, n: 24, dn: 4, wMin: 190, wMax: 300, aMin: 0.24, aMax: 0.44, tone: 0, jitter: 5},
  {y: 0.746, h: 106, speed: 74, n: 24, dn: 5, wMin: 240, wMax: 380, aMin: 0.3, aMax: 0.52, tone: 0, jitter: 8},
  {y: 0.802, h: 142, speed: 120, n: 22, dn: 6, wMin: 310, wMax: 460, aMin: 0.38, aMax: 0.6, tone: 1, jitter: 14},
  {y: 0.868, h: 190, speed: 184, n: 20, dn: 8, wMin: 400, wMax: 570, aMin: 0.46, aMax: 0.7, tone: 2, jitter: 20},
  {y: 0.944, h: 240, speed: 258, n: 16, dn: 10, wMin: 520, wMax: 720, aMin: 0.58, aMax: 0.82, tone: 3, jitter: 24},
  {y: 1.038, h: 320, speed: 336, n: 8, dn: 8, wMin: 860, wMax: 1240, aMin: 0.5, aMax: 0.76, tone: 3, jitter: 18},
];

// 夜里的云只剩轮廓：本体压暗，顶缘被星光擦亮一条边。
// 但别压到纯黑 —— 一压黑，下半幅就成了一口洞，读作"夜空"而不是"星海"。
// 关键是让云顶比天更亮：星光从上方落在云面上，海才是发光的。
const TONES: CloudTone[] = [
  {top: '#3f4d78', bot: '#1a2138', topLight: 0.34},
  {top: '#36446c', bot: '#151b30', topLight: 0.28},
  {top: '#2b3759', bot: '#11162b', topLight: 0.22},
  {top: '#202a45', bot: '#0c1020', topLight: 0.15},
];

const CLOUDS = buildClouds(BANDS, CFG.seed + 71, W, 1000);

const KID_H = [82, 96, 74, 90, 104];

export const StarSea: React.FC<{frame: number; sec: number}> = ({frame, sec}) => {
  const t = frame / CFG.fps;

  // 孩子 3.5 秒后从右边跑过（本地 0 = 全局 25.1，所以正好是 0:28.6）
  const kidT = t - 3.5;
  const walking = sec < 28.6;
  const elderX = heroXAt(sec);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <CloudField t={t} clouds={CLOUDS} tones={TONES} W={W} H={H} pad={1000} />

      {/* 云下透出的星光：把"海面"点亮。
          两道叠加 —— 宽的铺底给整片海一层蓝，窄的把人物脚底那一线压亮，
          人站在亮面上才成剪影；只有一道的话不是发灰就是发白 */}
      <div
        style={{
          position: 'absolute',
          left: '-14%',
          top: '58%',
          width: '128%',
          height: '46%',
          background:
            'radial-gradient(ellipse 62% 46% at 48% 38%, rgba(150,188,255,0.30) 0%, rgba(112,146,232,0.15) 46%, rgba(86,116,205,0) 78%)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '-10%',
          top: '66%',
          width: '120%',
          height: '34%',
          background:
            'radial-gradient(ellipse 46% 30% at 48% 34%, rgba(206,224,255,0.30) 0%, rgba(160,190,255,0.12) 48%, rgba(120,150,235,0) 78%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* 远处的暖色剪影：这一路遇见的人 */}
      {[
        {x: 0.7, h: 48, d: 0},
        {x: 0.755, h: 42, d: 0.25},
        {x: 0.808, h: 52, d: 0.5},
        {x: 0.862, h: 40, d: 0.75},
      ].map((s, i) => {
        const a = clamp01((t - (6.2 + s.d)) / 1.2);
        if (a <= 0.01) return null;
        return (
          <div key={`warm${i}`} style={{opacity: a * 0.85}}>
            <Figure
              uid={`warm${i}`}
              x={s.x}
              foot={0.706}
              W={W}
              H={H}
              h={s.h}
              t={t + i}
              mode="idle"
              tint="#3A2A2E"
              rim="rgba(255,196,140,0.62)"
              glow={0.6}
              blur={1.2}
            />
          </div>
        );
      })}

      {/* 孩子们跑过：一生的闭环。其中一个牵着风筝 */}
      {[0, 1, 2, 3, 4].map((i) => {
        const x = -0.06 + kidT * 0.42 - i * 0.085;
        if (kidT < 0 || x < -0.16 || x > 1.16) return null;
        return (
          <React.Fragment key={`kid${i}`}>
            <Figure
              uid={`kid${i}`}
              x={x}
              foot={0.79 - (i % 2) * 0.012}
              W={W}
              H={H}
              h={KID_H[i]}
              t={t + i * 0.2}
              mode="run"
              cadence={2.2}
              stride={1.2}
              tilt={7}
              glow={i === 2 ? 1 : 0.7}
              opacity={0.96}
            />
            {i === 2 && (
              <>
                {/* 风筝线：从孩子的手牵上去，否则风筝像凭空浮着的菱形。
                    风筝要放得比老人的头再高一截 —— 放 0.638H 时，孩子跑到
                    主角身边，风筝正好压在老人头顶上，读作"他头上顶了个风筝"。 */}
                <svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
                  <path
                    d={`M${(x + 0.012) * W},${0.75 * H} Q${(x + 0.045) * W},${0.68 * H} ${(x + 0.075) * W},${
                      0.6 * H
                    }`}
                    stroke="rgba(200,216,255,0.22)"
                    strokeWidth={1.1}
                    fill="none"
                  />
                </svg>
                <Kite
                  x={(x + 0.075) * W}
                  y={0.585 * H}
                  size={40}
                  t={t}
                  rot={Math.sin(t * 1.4) * 9}
                  color="#3B3048"
                  tail={0.8}
                  opacity={0.88}
                />
              </>
            )}
          </React.Fragment>
        );
      })}

      {/* 杖尖落地时亮起的一圈光 */}
      {walking &&
        [0, 1, 2].map((i) => {
          const ph = (t * 0.62 + i * 0.33) % 1;
          const a = Math.max(0, 1 - ph * 2.2);
          if (a <= 0.02) return null;
          return (
            <div
              key={`rip${i}`}
              style={{
                position: 'absolute',
                left: `${(elderX + 0.012) * 100}%`,
                top: `${0.808 * 100}%`,
                width: 40 + ph * 260,
                height: (40 + ph * 260) * 0.24,
                transform: 'translate(-50%,-50%)',
                borderRadius: '50%',
                border: '1.5px solid rgba(200,220,255,0.4)',
                opacity: a * 0.5,
              }}
            />
          );
        })}

      {/* 上升的光点 */}
      <Particles
        t={t}
        W={W}
        H={H}
        seed={CFG.seed + 91}
        spec={{
          count: 260,
          rMin: 0.8,
          rMax: 3,
          speedMin: 26,
          speedMax: 90,
          mode: 'up',
          colors: ['#DCE9FF', '#FFEBC8', '#FFFFFF'],
          alphaMin: 0.12,
          alphaMax: 0.6,
          twinkle: 0.6,
          sway: 30,
          glow: true,
        }}
      />
    </AbsoluteFill>
  );
};
