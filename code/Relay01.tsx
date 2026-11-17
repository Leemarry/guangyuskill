import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {clamp01} from './util';

/**
 * 地貌接力 —— 这个文件是整个技能的核心。
 *
 * ============================ 为什么不是"切换" ============================
 *
 * 分段做片子，默认写法是：场景 A 淡出 + 场景 B 淡入，中点硬切。
 * 这必然是"闪"，原因有三，跟遮罩做得漂不漂亮无关：
 *
 *   1. 两张半透明的图叠在一起，中间会透出底色 —— 画面暗一下，就是一次"闪"。
 *   2. A 和 B 各有一片天：天色不一样，叠化过程中天空在"融色"，读作换背景。
 *   3. A 和 B 各有一个主角：位置、身高对不上，叠化时出现两个重影。
 *
 * ============================ 接力是怎么做的 ============================
 *
 * 前提（本技能其余文件负责）：天空连续、镜头一台、主角一个。这三样提成全局层之后，
 * 地貌就成了唯一会变的东西 —— 于是只要让地貌**交接**，而不是**对切**。
 *
 * 图层顺序：后段先画（在下），前段后画（在上）。
 *   新地貌从一开始就实心待在旧的下面，不是从透明淡入 —— 淡入会露底，两张半透明会发暗。
 *
 * 时间分配（重叠期 = overlap 秒）：
 *   新地貌：重叠期的前 62% 显影完毕，之后保持满（enterDone）
 *   旧地貌：重叠期的 36% 之后才开始退，96% 退完（exitStart / exitSpan）
 *   两者同时"半可见"的窗口只有约 0.5 秒，且正好落在雾最浓的地方。
 *
 * 为什么这个顺序在物理上是对的：
 *   旧地貌的上半幅（天空、远脊之外）本来就是透明的，所以新地貌先在"远处"显出来；
 *   近处被旧的云/地面挡着，要等旧的退开才露出来。
 *   远处先变、近处后变 —— 这就是大气透视，也就是人走路时看见地貌更替的真实次序。
 *
 * 退场为什么还要下沉：
 *   只改 opacity 是"把整幅地貌等比擦掉"，底色会透出来。
 *   加一个向下的位移（默认 70px），读作"地面从脚下退走"，天空不动。
 *   方向必须与运动方向一致 —— 人往前走，地貌往后/往下退，不能左右平移。
 */

export type RelayScene = {
  /** 唯一 key，也是 Sequence 的 name */
  key: string;
  /** 给人看的名字，出现在时间轴上 */
  name?: string;
  /** 在场区间（秒）。相邻两段必须重叠，重叠量 = overlap */
  from: number;
  to: number;
  /** 场景组件。只接收全局秒数，不含自己的时间原点 */
  Comp: React.FC<{sec: number}>;
};

const smooth = (v: number) => v * v * (3 - 2 * v);

const SceneRunner: React.FC<{
  Comp: React.FC<{sec: number}>;
  offset: number;
  fps: number;
}> = ({Comp, offset, fps}) => {
  const f = useCurrentFrame();
  return <Comp sec={(f + offset) / fps} />;
};

export const Relay01: React.FC<{
  scenes: RelayScene[];
  fps: number;
  /** 总时长（秒）。最后一段的 to 应等于它 */
  durationSec: number;
  /** 重叠期长度（秒）。35 秒片子里 1.8s 是实测舒服的值，约占总长 5% */
  overlap?: number;
  /** 新地貌在多长的重叠进度内显影完毕（0–1）。太小会显得急，太大会和旧的重影 */
  enterDone?: number;
  /** 旧地貌从重叠进度的哪个位置开始退 */
  exitStart?: number;
  /** 旧地貌用多长的重叠进度退完 */
  exitSpan?: number;
  /** 退场时下沉多少 px */
  sink?: number;
}> = ({
  scenes,
  fps,
  durationSec,
  overlap = 1.8,
  enterDone = 0.62,
  exitStart = 0.36,
  exitSpan = 0.6,
  sink = 70,
}) => {
  const frame = useCurrentFrame();
  const sec = frame / fps;

  /** 进场：重叠期前 enterDone 段内显影完毕，之后保持满 */
  const enterOf = (start: number) => smooth(clamp01(clamp01((sec - start) / overlap) / enterDone));

  /** 出场：重叠期 exitStart 之后开始退，exitSpan 内退完 */
  const exitOf = (end: number) => {
    const u = clamp01((sec - (end - overlap)) / overlap);
    return 1 - smooth(clamp01((u - exitStart) / exitSpan));
  };

  return (
    <>
      {/* 倒序：最后一段在最底，第一段在最上 */}
      {[...scenes].reverse().map((s) => {
        const from = Math.round(s.from * fps);
        const len = Math.max(1, Math.round(s.to * fps) - from);
        // 第一段不用进场（前面只有黑场淡入），最后一段不用出场（留到片尾黑场）
        const aIn = s.from <= 0 ? 1 : enterOf(s.from);
        const aOut = s.to >= durationSec ? 1 : exitOf(s.to);
        const a = Math.min(aIn, aOut);
        // 只有"被走过"的旧地貌才下沉
        const dy = (1 - aOut) * sink;

        return (
          <Sequence key={s.key} from={from} durationInFrames={len} layout="none" name={s.name ?? s.key}>
            <AbsoluteFill style={{opacity: a, transform: `translateY(${dy.toFixed(1)}px)`}}>
              <SceneRunner Comp={s.Comp} offset={from} fps={fps} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};
