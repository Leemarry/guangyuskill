import React from 'react';
import {FigSvg, figWidth} from './Figure';
import {heroPhaseAt, heroPoseAt} from '../lib/clock';

/**
 * 主角。全片只有这一个，从第 0 帧跑到第 1050 帧，从不重建。
 *
 * 他的一生全部由 lib/clock.ts 里的六条曲线决定：
 *   身高 150→215→185 ／ 步频 2.05→0.30 ／ 驼背 0→0.88 ／ 道具 空手→提灯→杖
 *
 * 为什么必须提到全局：原来五段各画一个主角，段与段之间 x 会从 0.52 跳回 0.26、
 * foot 从 0.845 跳到 0.836、身高从 214 跳到 208。哪怕只有 0.5 秒的叠化，
 * 也会读成"一个人分成两个、还忽然矮了一截"。现在这个人一直在，感不到他换过。
 *
 * 转身用外层 scaleX 做（1 → 0 → −1），不是硬翻 dir：
 *   0 那一帧是侧面，正好落在雾最浓的地方。所以 26 秒那次"回头"是看得见动作的，
 *   而不是一个 scaleX(-1) 的瞬间开关。
 */
export const Hero: React.FC<{sec: number}> = ({sec}) => {
  const p = heroPoseAt(sec);
  const phase = heroPhaseAt(sec);
  const w = figWidth(p.h);
  // scaleX 过 0 时元素宽度塌成一条线，不值得再画
  const shown = Math.abs(p.turn) > 0.03;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${p.x * 100}%`,
        top: `${p.foot * 100}%`,
        width: w,
        height: p.h,
        transform: `translate(-50%,-100%) scaleX(${p.turn.toFixed(4)})`,
        transformOrigin: '50% 100%',
        opacity: shown ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      <FigSvg
        uid="hero"
        h={p.h}
        t={phase}
        mode={p.mode}
        dir={1}
        cadence={1}
        stride={p.stride}
        hunch={p.hunch}
        tilt={p.tilt}
        look={p.look}
        prop={p.prop}
        glow={p.glow}
      />
    </div>
  );
};
