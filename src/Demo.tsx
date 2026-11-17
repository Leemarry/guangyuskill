import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Hero01Walk} from '../code/Hero01';
import {MistBand01} from '../code/Mist01';
import {Relay01, type RelayScene} from '../code/Relay01';
import {SkyLayer01, type SunKey} from '../code/SkyLayer01';
import {
  EXAMPLE_CAM,
  EXAMPLE_CURVES,
  EXAMPLE_EVENTS,
  exampleModeAt,
  examplePropAt,
  makeCamera,
  makeHero,
} from '../code/pose01';
import {makeSky} from '../code/sky01';
import {SKY_CLOUD, SKY_SNOW} from '../code/config01.example';
import {Frost} from './scenes/Frost';
import {Meadow} from './scenes/Meadow';

/**
 * 最小可运行示例：两段地貌接力，一个人从童年走到老年。
 *
 * 这个文件就是"怎么用"的答案。整条片子的结构只有四层，从下往上：
 *
 *   1. SkyLayer  —— 一片天，35 秒连续。永远实心、永远在最底。
 *   2. Relay     —— 地貌。后段在下、前段在上，重叠期里旧的退、新的露。
 *   3. Hero01Walk —— 一个人，35 秒连续，只靠曲线变化。
 *   4. 雾 / 暗角 / 颗粒 / 黑场 —— 统一的收尾层，全片只有一套。
 *
 * 外面套一台镜头（makeCamera），全片共用。
 *
 * 把这段读完之后，改自己的片子只需要动三样：
 *   SCENES（几段、多长、什么内容）、SKY_KEYS（天色）、EXAMPLE_CURVES（人物）。
 */

const FPS = 30;
const DURATION = 35;
const OVERLAP = 1.8;

/** 天色：前 16 秒暖，16–22 秒过渡到冷，之后保持。
 *  真实片子这里通常有 8–10 个关键帧；示例只留两个状态，方便一眼看出"天色是连续的" */
const SKY = makeSky([
  {at: 0, stops: SKY_CLOUD},
  {at: 16, stops: SKY_CLOUD},
  {at: 22, stops: SKY_SNOW},
  {at: 35, stops: SKY_SNOW},
]);

const SUN: SunKey[] = [
  {at: 0, x: 0.5, y: 0.615, scale: 1.0, intensity: 1.0, halo: 1500, core: 330, tint: '255,244,214'},
  {at: 18, x: 0.52, y: 0.6, scale: 1.12, intensity: 0.92, halo: 1500, core: 320, tint: '255,232,196'},
  {at: 35, x: 0.5, y: 0.63, scale: 0.8, intensity: 0.34, halo: 1300, core: 240, tint: '214,232,255'},
];

const CAM = makeCamera(EXAMPLE_CAM);

const HERO = makeHero(EXAMPLE_CURVES, {
  duration: DURATION,
  events: EXAMPLE_EVENTS,
  propAt: examplePropAt,
  modeAt: exampleModeAt,
});

/** 两段。to(上一段) − from(下一段) 必须等于 OVERLAP，否则中间会露底 */
const SCENES: RelayScene[] = [
  {key: 'meadow', name: '草甸·前半生', from: 0, to: 18.0, Comp: Meadow},
  {key: 'frost', name: '雪原·后半生', from: 16.2, to: 35.0, Comp: Frost},
];

/** 雾带窗口 = 重叠区。雾在的地方，正是地貌交接的地方 */
const CUTS = [{kind: 'cloud' as const, from: 16.2, to: 18.0}];

export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const cam = CAM(sec);
  const tint = SKY.skyTintAt(sec);

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fadeOut = interpolate(frame, [DURATION * FPS - 34, DURATION * FPS - 5], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const black = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{backgroundColor: '#05070f', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `translate(${cam.x.toFixed(2)}px, ${cam.y.toFixed(2)}px) scale(${cam.scale.toFixed(4)})`,
          transformOrigin: '50% 61%',
        }}
      >
        <SkyLayer01
          sec={sec}
          sky={SKY}
          sun={SUN}
          horizon={[
            [0, 0.671],
            [35, 0.662],
          ]}
          aurora={[22, 30]}
          galaxy={null}
          stars={[26, 33]}
          width={1920}
          height={1080}
          seed={20261116}
        />

        <Relay01 scenes={SCENES} fps={FPS} durationSec={DURATION} overlap={OVERLAP} />

        <Hero01Walk sec={sec} rig={HERO} />
      </AbsoluteFill>

      {/* 雾带：转场真正发生的地方 */}
      {CUTS.map((c) => (
        <MistBand01 key={c.kind} kind={c.kind} sec={sec} from={c.from} to={c.to} tint={tint.mist} />
      ))}

      {/* 暗角：整片统一，不各段单独加，避免接力时暗角跳变 */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 56%, rgba(4,6,16,0) 36%, rgba(4,6,16,0.3) 72%, rgba(2,3,10,0.6) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 极轻的胶片颗粒，消掉渐变色带 */}
      <AbsoluteFill
        style={{
          opacity: 0.06,
          mixBlendMode: 'overlay',
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\'/></filter><rect width=\'160\' height=\'160\' filter=\'url(%23n)\' opacity=\'0.5\'/></svg>")',
          pointerEvents: 'none',
        }}
      />

      <AbsoluteFill style={{backgroundColor: '#02030a', opacity: 1 - black}} />
    </AbsoluteFill>
  );
};
