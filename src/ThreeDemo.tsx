import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {World} from '../code/three/World01';
import {Stars01} from '../code/Stars01';

/**
 * 3D 示例（ThreeCanvas 版）：七段地貌一次走完，靠 World01 自带着色器天空与海面。
 *
 * 和 src/Demo.tsx（2D 接力版）是两种做法，不是新旧关系：
 *   Demo     —— Relay01 接力，零额外依赖，适合 5–8 秒一段的长镜头
 *   ThreeDemo—— 真 3D，有景深和体积感，适合卡点、快节奏
 *
 * beat：这里用一个固定周期的脉冲占位，只为了让海面和粒子有可见的呼吸。
 * 真做卡点不要抄这一行——
 *   python scripts/beatmap.py 曲目.mp3 --out beatmap.json --stretch-to 30.8
 *   import bm from './beatmap.json';  const beat = bm.bass_out[frame] ?? 0;
 */
const demoBeat = (frame: number) => {
  const f = (frame % 30) / 30; // 每秒一拍
  return Math.exp(-f * 6) * 0.9;
};

export const ThreeDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const beat = useMemo(() => demoBeat(frame), [frame]);

  return (
    <AbsoluteFill style={{backgroundColor: '#04121f'}}>
      <World beat={beat} />
      {/* 星光：只在最后一段（20.5s 之后）亮，替代"整片都加亮" */}
      <Stars01 t={t} from={20.5} to={30.8} count={38} flash={[22.6, 26.4]} />
    </AbsoluteFill>
  );
};
