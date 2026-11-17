import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {glowSprite, mulberry32, wrap} from './util';

export type ParticleSpec = {
  count: number;
  rMin: number;
  rMax: number;
  speedMin: number;
  speedMax: number;
  mode: 'up' | 'down' | 'side' | 'static';
  colors: string[];
  alphaMin: number;
  alphaMax: number;
  twinkle?: number;
  sway?: number;
  glow?: boolean;
  streak?: number; // >1 时画成横向拖尾（沙粒、雪粒）
  yRange?: [number, number]; // 生成高度区间（0~1），把粒子关在画面某一段里
};

type P = {x: number; y: number; r: number; speed: number; phase: number; sway: number; alpha: number; color: string; tw: number};

/** 粒子层：光尘 / 沙粒 / 雪 / 星点是同一个模型，只换参数 */
export const Particles01: React.FC<{
  t: number;
  W: number;
  H: number;
  spec: ParticleSpec;
  seed: number;
  fade?: number;
  offsetY?: number;
}> = ({t, W, H, spec, seed, fade = 1, offsetY = 0}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  const ps = useMemo(() => {
    const rnd = mulberry32(seed);
    const y0 = (spec.yRange?.[0] ?? 0) * H;
    const y1 = (spec.yRange?.[1] ?? 1) * H;
    return Array.from({length: spec.count}, (): P => ({
      x: rnd() * W,
      y: y0 + rnd() * (y1 - y0),
      r: spec.rMin + (spec.rMax - spec.rMin) * Math.pow(rnd(), 1.6),
      speed: spec.speedMin + (spec.speedMax - spec.speedMin) * rnd(),
      phase: rnd() * Math.PI * 2,
      sway: (spec.sway ?? 10) * (0.4 + rnd()),
      alpha: spec.alphaMin + (spec.alphaMax - spec.alphaMin) * rnd(),
      color: spec.colors[Math.floor(rnd() * spec.colors.length)],
      tw: 0.4 + rnd() * 2.2,
    }));
  }, [spec, seed, W, H]);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = spec.glow ? 'lighter' : 'source-over';
    const tw = spec.twinkle ?? 0.5;
    const streak = spec.streak ?? 1;
    const bandTop = (spec.yRange?.[0] ?? -0.1) * H;
    const bandBot = (spec.yRange?.[1] ?? 1.1) * H;
    const bandSpan = Math.max(1, bandBot - bandTop);

    for (const p of ps) {
      let x = p.x;
      let y = p.y;
      if (spec.yRange) {
        // 有区间约束时，回收也发生在区间内，粒子不会漏到别的段落里去
        if (spec.mode === 'up') y = wrap(p.y - p.speed * t - bandTop, bandSpan) + bandTop;
        else if (spec.mode === 'down') y = wrap(p.y + p.speed * t - bandTop, bandSpan) + bandTop;
        else y = p.y;
      } else {
        if (spec.mode === 'up') y = wrap(p.y - p.speed * t, H + 200) - 100 + offsetY;
        if (spec.mode === 'down') y = wrap(p.y + p.speed * t, H + 200) - 100 + offsetY;
      }
      if (spec.mode === 'side') x = wrap(p.x - p.speed * t * 2.2, W + 300) - 150;
      if (spec.mode !== 'side') x = p.x + Math.sin(t * 0.42 + p.phase) * p.sway;

      const k = 1 + tw * Math.sin(t * p.tw + p.phase * 2);
      const a = p.alpha * k * fade;
      if (a <= 0.002) continue;

      if (spec.glow) {
        const s = p.r * 11;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(glowSprite(p.color), x - s / 2, y - s / 2, s, s);
      } else if (streak > 1) {
        // 风里的沙/雪：拉成一道细横线，才有速度
        ctx.globalAlpha = Math.min(1, a);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.r;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + p.r * streak * 6, y - p.r * 0.6);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [t, ps, W, H, spec, fade, offsetY]);

  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};
