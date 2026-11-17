import React from 'react';
import {FigSvg, figWidth} from './Figure01';
import type {HeroPose} from './pose01';
import {makeHero} from './pose01';

/**
 * 人物 01：斗篷小人。
 *
 * ---------------------------- 编号约定 ----------------------------
 * 一个文件一个人物：Hero01 / Hero02 / Hero03 …
 * 每个文件自带**造型选择**与**默认曲线**，互不覆盖。
 * 共用的是机制（pose.ts 的曲线与相位、Figure.tsx 的绘制基座），不是外观。
 *
 * 新增角色：复制本文件改名为 Hero02，改造型参数与默认曲线，不要改动 Hero01 ——
 * 已经在用 Hero01 的片子不应该因为别人加了角色而变样。
 *
 * ---------------------------- 为什么是他 ---------------------------- *
 * 全片只有这一个实例，从不重建、从不渲染成两个。
 * 它本身是纯展示组件：给一个 pose 就画一个人，变化全在 pose 里（见 pose.ts）。
 *
 * 转身用外层 scaleX 做（1 → 0 → −1），不是硬翻 dir：
 *   0 那一帧是侧面，正好落在雾最浓的地方，所以"回头"是看得见动作的，
 *   而不是一个 scaleX(-1) 的瞬间开关。
 *   注意 dir 不能用来转身 —— 它参与逐点几何计算，只能取 ±1，中间态会让腿折向错乱。
 */
export const Hero01: React.FC<{
  pose: HeroPose;
  /** ∫cadence dt，不是秒。见 pose.ts 的 makePhase */
  phase: number;
  tint?: string;
  rim?: string;
  uid?: string;
}> = ({pose: p, phase, tint, rim, uid = 'hero01'}) => {
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
        uid={uid}
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
        tint={tint}
        rim={rim}
      />
    </div>
  );
};

export type Hero01Rig = ReturnType<typeof makeHero>;

/**
 * 便捷包装：传秒数就出人。
 *
 *   const rig = makeHero(EXAMPLE_CURVES, {duration: 35, events: EXAMPLE_EVENTS});
 *   <Hero01Walk sec={sec} rig={rig} />
 */
export const Hero01Walk: React.FC<{
  sec: number;
  rig: Hero01Rig;
  tint?: string;
  rim?: string;
  uid?: string;
}> = ({sec, rig, ...rest}) => <Hero01 pose={rig.poseAt(sec)} phase={rig.phaseAt(sec)} {...rest} />;
