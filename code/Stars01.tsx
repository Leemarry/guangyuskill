import React from 'react';
import {AbsoluteFill} from 'remotion';
import {smoothStep, window2} from './util';

/**
 * 星光 01：一片会一颗一颗亮起来的星。
 *
 * 这不是"星空背景"，是一次**动作**：光点按顺序被点亮，中间有几次强调闪烁。
 * 用它在"他抬手 → 天亮了"这类时刻替代单纯加亮度 —— 观众能数出星星，
 * 就说明他知道"这是刚刚点亮的"，而不是"画面本来就亮"。
 *
 * 参数化到只剩四个：
 *   from/to   显隐窗口（窗口外完全不渲染，避免 30 秒都在画 38 个 div）
 *   count     星星数量。38 是实测的甜点：少于 20 像噪点，多于 60 像噪点
 *   flash     强调闪烁的时刻（秒）。每一次是一个高斯脉冲，宽 0.1–0.14s
 *   tint      两种取色，按 i%4 交替，避免整片同色发灰
 *
 * 位置用 (i*37.39)%86 这类互质步进取值，不用随机数 ——
 * 随机数在重渲时会变，做不了"改一帧只动一处"的微调。
 */
export const Stars01: React.FC<{
  t: number;
  from?: number;
  to?: number;
  count?: number;
  flash?: number[];
  tint?: [string, string];
}> = ({t, from = 9.7, to = 13.8, count = 38, flash = [], tint = ['#d7f3ff', '#fff1bc']}) => {
  const scene = window2(from, from + 0.4, to - 0.8, to, t);
  if (scene <= 0) return null;

  const pulse = (center: number, width: number) => Math.exp(-(((t - center) / width) ** 2));
  const flashAt = flash.length ? Math.max(...flash.map((c) => pulse(c, 0.12))) : 0;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: count}, (_, i) => {
        const left = 7 + ((i * 37.39) % 86);
        const top = 4 + ((i * 17.73) % 31);
        // 亮起的顺序：每 7 颗一组往下错开，看起来是"从左上往右下扫过去"
        const reveal = from + 0.32 + (i % 7) * 0.065 + Math.floor(i / 7) * 0.04;
        const life = smoothStep(reveal, reveal + 0.16, t);
        const twinkle = 0.5 + 0.5 * Math.sin((t - reveal) * 7 + i * 1.73);
        const opacity = scene * life * Math.min(1, twinkle ** 3 + flashAt * 0.95);
        const size = (i % 6 === 0 ? 19 : 8 + (i % 4) * 2) * (1 + flashAt * 0.4);
        const color = tint[i % 4 === 0 ? 1 : 0];

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              opacity,
              transform: 'translate(-50%,-50%)',
            }}
          >
            {/* 核：小亮点 + 一圈辉光 */}
            <div
              style={{
                position: 'absolute',
                left: '43%',
                top: '43%',
                width: '14%',
                height: '14%',
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: `0 0 ${size * 0.8}px ${size * 0.16}px ${color}`,
              }}
            />
            {/* 十字光芒：两个菱形，比四角星便宜且不会糊成一团 */}
            <div
              style={{
                position: 'absolute',
                left: '46%',
                top: 0,
                width: '8%',
                height: '100%',
                background: color,
                clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '46%',
                width: '100%',
                height: '8%',
                background: color,
                clipPath: 'polygon(0 50%,50% 0,100% 50%,50% 100%)',
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
