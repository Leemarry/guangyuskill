import React from 'react';
import {clamp01} from '../lib/util';
import {skyTintAt} from '../lib/sky';

/**
 * 雾带：转场真正"发生"的地方。
 *
 * 原来是「闪白遮罩」——整屏刷白 6 帧，底下硬切。读作"闪了一下换了张图"。
 * 现在是一团雾从地平线那头漫过来、盖住画面、再沉下去。雾散时脚下已经是新地貌。
 *
 * 三个要点：
 *  1. 它是一团「团块」，不是一条带。七团椭圆错落叠在一起，y 各差 4–9%，
 *     再上 40px 以上的模糊 —— 边缘永远不会整齐，也就不会读成"白横条"。
 *  2. 浓度曲线 sin^0.6：两端为零、中段宽平。最浓的一刻正好是旧地貌退到一半的一刻。
 *  3. 颜色不写死，取当前天色在地平线附近的色再往白里提。
 *     所以云海的雾是暖白、沙丘的是浅橙、雪原的是冷白 —— 雾永远"属于"当时的光。
 *  4. 它只在 28%–88% 的画面高度里活动：从地平线升起、沉到脚下，
 *     不去糊上半幅的天空。天空是连续的，糊它反而会让人觉得"天变了"。
 */

export type MistKind = 'cloud' | 'sand' | 'spray' | 'snow';

const KIND: Record<MistKind, {h: number; a: number; blur: number}> = {
  cloud: {h: 38, a: 0.72, blur: 44},
  sand: {h: 32, a: 0.58, blur: 40},
  spray: {h: 28, a: 0.62, blur: 38},
  snow: {h: 36, a: 0.70, blur: 46},
};

/** 七团椭圆，横向铺开、纵向错落。位置写死是为了每次转场的形态可复现 */
const PUFFS: {x: number; y: number; rx: number; ry: number; a: number}[] = [
  {x: 14, y: 54, rx: 30, ry: 40, a: 0.78},
  {x: 27, y: 44, rx: 22, ry: 46, a: 0.62},
  {x: 41, y: 58, rx: 26, ry: 38, a: 0.72},
  {x: 55, y: 46, rx: 20, ry: 48, a: 0.58},
  {x: 68, y: 56, rx: 28, ry: 40, a: 0.74},
  {x: 82, y: 45, rx: 22, ry: 44, a: 0.62},
  {x: 94, y: 55, rx: 26, ry: 38, a: 0.7},
];

export const MistBand: React.FC<{kind: MistKind; sec: number; from: number; to: number}> = ({
  kind,
  sec,
  from,
  to,
}) => {
  const p = clamp01((sec - from) / (to - from));
  if (p <= 0.001 || p >= 0.999) return null;

  const cfg = KIND[kind];
  const rgb = skyTintAt(sec).mist;

  // 从地平线附近升起，一路沉到脚下。上下都不出画，所以"出现"和"消失"只能靠浓度
  const cy = 0.28 + p * 0.6;
  const op = Math.pow(Math.sin(Math.PI * p), 0.6) * cfg.a;

  const body = PUFFS.map(
    (q) =>
      `radial-gradient(ellipse ${q.rx}% ${q.ry}% at ${q.x}% ${q.y}%, rgba(${rgb},${q.a}) 0%, rgba(${rgb},${
        q.a * 0.42
      }) 44%, rgba(${rgb},0) 76%)`
  ).join(', ');

  return (
    <>
      {/* 外扩一层：雾的上下缘，压得很淡，负责把主带"化"进画面 */}
      <div
        style={{
          position: 'absolute',
          left: '-32%',
          width: '164%',
          top: `${(cy - cfg.h * 1.05) * 100}%`,
          height: `${cfg.h * 2.1}%`,
          opacity: op * 0.4,
          filter: `blur(${cfg.blur * 1.5}px)`,
          background: body,
          pointerEvents: 'none',
        }}
      />
      {/* 主团 */}
      <div
        style={{
          position: 'absolute',
          left: '-24%',
          width: '148%',
          top: `${(cy - cfg.h * 0.5) * 100}%`,
          height: `${cfg.h}%`,
          opacity: op,
          filter: `blur(${cfg.blur}px)`,
          background: body,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
