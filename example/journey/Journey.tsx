import React from 'react';
import {AbsoluteFill, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {CFG, toF} from './config';
import {Caption} from './components/Caption';
import {Hero} from './components/Hero';
import {MistBand} from './components/Mist';
import {SkyLayer} from './components/World';
import {cameraAt} from './lib/clock';
import {clamp01} from './lib/util';
import {CloudSea} from './scenes/CloudSea';
import {Dunes} from './scenes/Dunes';
import {Seaside} from './scenes/Seaside';
import {Snowfield} from './scenes/Snowfield';
import {StarSea} from './scenes/StarSea';

/* 全片编排
 *
 * 三层，从下往上：
 *   1. SkyLayer  —— 一片天，35 秒连续。它永远实心、永远在最底。
 *   2. 五个地貌  —— 后段先画（在下），前段后画（在上）。旧地貌在自己最后 1.8 秒里
 *                   一边淡出、一边下沉 70px；新地貌一直实心待在底下，被露出来。
 *                   注意新地貌不是"淡入" —— 淡入会露黑，两张半透明叠在一起会发暗。
 *   3. Hero      —— 一个人，35 秒连续。
 *
 * 外面再套一台镜头（全局 cameraAt）、一层雾带（在每个重叠区扫过）、暗角、颗粒、字幕。
 *
 * 为什么这样就没有"闪动切换"了：
 *   原来每段各有一个闪白遮罩，中心是硬切点，读作"闪一下换了张图"。
 *   现在没有任何一帧是硬切 —— 相邻两段在 1.8 秒里同时存在，
 *   天色是连续的、镜头是连续的、人是连续的，只有脚下的地貌在雾里换了。
 */

type SceneComp = React.FC<{frame: number; sec: number}>;

const SCENE_OF: Record<string, SceneComp> = {
  cloud: CloudSea,
  dune: Dunes,
  sea: Seaside,
  snow: Snowfield,
  star: StarSea,
};

const Runner: React.FC<{C: SceneComp; offset: number}> = ({C, offset}) => {
  const f = useCurrentFrame();
  return <C frame={f} sec={(f + offset) / CFG.fps} />;
};

const smooth = (v: number) => v * v * (3 - 2 * v);

/**
 * 地貌进场：重叠期的前 62% 就显影完毕，之后保持满。
 *
 * 为什么要"先满"：新地貌在旧地貌下面，如果两张同时半透明，中间会透出天空、
 * 画面发暗一下 —— 那就又成了"闪"。
 *
 * 而且这个顺序在物理上正好是对的：旧地貌的上半幅（天空、远脊之外）本来就是透明的，
 * 所以新地貌会先在"远处"显出来；近处被旧的云/地面挡着，要等旧的退开才露出。
 * 远处先变、近处后变 —— 这就是大气透视，也就是人走路时看见地貌更替的真实次序。
 */
const enterOf = (sec: number, start: number, fade: number) => {
  const u = clamp01((sec - start) / fade);
  return smooth(clamp01(u / 0.62));
};

/**
 * 地貌出场：重叠期的 36%–96% 之间退完。
 *
 * 起点不能太早 —— 早了会和"新地貌显影"抢时间，两张都半透明，中间透出天空。
 * 也不能太晚 —— 晚了旧地貌在重叠后段还留着 40% 以上，它的人物会和新的叠成重影。
 * 36%/60% 这组值实测下，两段同时"半可见"的只有约 0.5 秒，且正好在雾最浓处。
 */
const exitOf = (sec: number, end: number, fade: number) => {
  const u = clamp01((sec - (end - fade)) / fade);
  return 1 - smooth(clamp01((u - 0.36) / 0.6));
};

const OVERLAP = 1.8;

export const Journey: React.FC = () => {
  const frame = useCurrentFrame();
  const sec = frame / CFG.fps;
  const DUR = CFG.fps * CFG.durationSec;
  const cam = cameraAt(sec);

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fadeOut = interpolate(frame, [DUR - 34, DUR - 5], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const black = Math.min(fadeIn, fadeOut);

  const camStyle: React.CSSProperties = {
    transform: `translate(${cam.x.toFixed(2)}px, ${cam.y.toFixed(2)}px) scale(${cam.scale.toFixed(4)})`,
    transformOrigin: '50% 61%',
  };

  return (
    <AbsoluteFill style={{backgroundColor: '#05070f', overflow: 'hidden'}}>
      <AbsoluteFill style={camStyle}>
        <SkyLayer sec={sec} />

        {/* 地貌：倒序渲染，最后一段在最底 */}
        {[...CFG.scenes].reverse().map((s) => {
          const from = toF(s.from);
          const len = toF(s.to) - toF(s.from);
          const C = SCENE_OF[s.key];
          // 第一段不用进场（前面只有黑场淡入）；最后一段不用出场（要留到片尾黑场）
          const aIn = s.from <= 0 ? 1 : enterOf(sec, s.from, OVERLAP);
          const aOut = s.to >= CFG.durationSec ? 1 : exitOf(sec, s.to, OVERLAP);
          const a = Math.min(aIn, aOut);
          // 只有"被走过"的旧地貌才下沉：地面从脚下退走，天空不动
          const dy = (1 - aOut) * 70;
          return (
            <Sequence key={s.key} from={from} durationInFrames={len} layout="none" name={`${s.name}·${s.age}`}>
              <AbsoluteFill style={{opacity: a, transform: `translateY(${dy.toFixed(1)}px)`}}>
                <Runner C={C} offset={from} />
              </AbsoluteFill>
            </Sequence>
          );
        })}

        {/* 主角压在所有地貌之上 —— 他跑在这一层地面上 */}
        <Hero sec={sec} />
      </AbsoluteFill>

      {/* 雾带：转场真正发生的地方。每个重叠区一条，从地平线漫到脚下 */}
      {CFG.cuts.map((c, i) => (
        <MistBand key={`mist${i}`} kind={c.kind} sec={sec} from={c.from} to={c.to} />
      ))}

      {/* 暗角：整片统一，不各段单独加，避免切换时暗角跳变 */}
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

      <Caption frame={frame} />

      <AbsoluteFill style={{backgroundColor: '#02030a', opacity: 1 - black}} />
    </AbsoluteFill>
  );
};
