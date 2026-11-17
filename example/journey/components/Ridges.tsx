import React, {useLayoutEffect, useRef} from 'react';
import {mulberry32, rgba} from '../lib/util';

/* 海面
   关键：真实海面在逆光下不是"均匀的横线"，而是太阳正下方一条碎金般的光路，
   两侧迅速衰减成暗蓝。所以这里的模型是「光路 + 涌 + 极少的浪脊」，
   而不是等距排布的浪线（那个读起来像灯芯绒）。 */

const PAD = 0;

export type SeaColors = {crest: string; glow: string; base: string; deep: string};

export const SeaField: React.FC<{
  t: number;
  W: number;
  H: number;
  horizon: number;
  sunX: number;
  colors: SeaColors;
  rows?: number;
  speed?: number;
  fade?: number;
  seed?: number;
}> = ({t, W, H, horizon, sunX, colors, speed = 0.05, fade = 1, seed = 7717}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const hz = horizon * H;
    const depth = H - hz;
    const rnd = mulberry32(seed);

    /* 1. 海体：贴地平线偏暖（在反射天空），越近越深 */
    const bg = ctx.createLinearGradient(0, hz, 0, H);
    bg.addColorStop(0, rgba(colors.glow, 0.5));
    bg.addColorStop(0.08, rgba(colors.base, 0.72));
    bg.addColorStop(0.34, rgba(colors.base, 0.95));
    bg.addColorStop(1, rgba(colors.deep, 1));
    ctx.globalAlpha = fade;
    ctx.fillStyle = bg;
    ctx.fillRect(0, hz, W, depth);

    /* 2. 暗涌：几条横向的深色带，给海面"体" */
    for (let i = 0; i < 7; i++) {
      const p = (i + 1) / 7;
      const y = hz + Math.pow(p, 2.05) * depth;
      const h = 34 + p * 130;
      const g = ctx.createLinearGradient(0, y - h, 0, y + h);
      g.addColorStop(0, rgba(colors.deep, 0));
      g.addColorStop(0.5, rgba(colors.deep, 0.16));
      g.addColorStop(1, rgba(colors.deep, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-20, y - h * 0.35 + Math.sin(t * 0.35 + i * 1.3) * 10);
      ctx.quadraticCurveTo(W * 0.5, y - h * 0.6 + Math.sin(t * 0.42 + i * 2.1) * 16, W + 20, y - h * 0.25);
      ctx.lineTo(W + 20, y + h);
      ctx.lineTo(-20, y + h);
      ctx.closePath();
      ctx.fill();
    }

    /* 3. 太阳下方的碎金光路：这才是海面在落日下的主要读感 */
    const colW = 560;
    for (let i = 0; i < 420; i++) {
      const p = Math.pow(rnd(), 0.5); // 贴地平线更密
      const spread = 30 + p * (colW + 620);
      const x = sunX * W + (rnd() - 0.5) * spread;
      const y = hz + Math.pow(p, 1.8) * depth + Math.sin(t * 0.9 + x * 0.01) * (0.6 + p * 3);
      const w = 5 + p * 54 * (0.35 + rnd());
      const h = 0.6 + p * 1.9;
      const dist = Math.abs(x - sunX * W) / (spread * 0.55 + 1);
      const falloff = Math.max(0, 1 - dist * 0.9);
      const a = falloff * (0.34 - p * 0.2) * (0.4 + rnd() * 0.8) * fade;
      if (a <= 0.004) continue;
      ctx.globalAlpha = Math.min(0.7, a);
      ctx.fillStyle = colors.crest;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 4. 浪脊：只留很少几条，长而软，几乎看不见 —— 用来暗示"这是水" */
    for (let i = 0; i < 9; i++) {
      const p = Math.pow((i + 1) / 9, 1.5);
      const y = hz + p * depth * 0.92;
      const w = 260 + p * 900;
      const cx = ((i * 0.37 + t * speed * 0.6) % 1.2 - 0.1) * W;
      ctx.strokeStyle = colors.crest;
      ctx.lineWidth = 1 + p * 3.2;
      ctx.globalAlpha = (0.05 + p * 0.07) * fade;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, y);
      ctx.quadraticCurveTo(cx, y - 3 - p * 7, cx + w / 2, y + (i % 2 ? 2 : -2));
      ctx.stroke();
    }

    /* 5. 地平线：一条柔的暖线，把海天缝起来 */
    const hg = ctx.createLinearGradient(0, hz - 18, 0, hz + 30);
    hg.addColorStop(0, rgba(colors.glow, 0));
    hg.addColorStop(0.45, rgba(colors.glow, 0.42));
    hg.addColorStop(1, rgba(colors.glow, 0));
    ctx.fillStyle = hg;
    ctx.globalAlpha = fade * 0.9;
    ctx.fillRect(0, hz - 18, W, 48);

    ctx.globalAlpha = 1;
  }, [t, W, H, horizon, sunX, colors, speed, fade, seed]);

  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};

/* 地形脊线：沙丘 / 雪丘 / 远山通用 */

export type RidgeLayer = {
  base: number;
  amp: number;
  k: number;
  amp2: number;
  k2: number;
  speed: number;
  top: string;
  bot: string;
  rim: string;
  rimW: number;
  rimA: number;
  alpha?: number;
  grain?: number;
  grainColor?: string;
};

export const Ridges: React.FC<{
  t: number;
  layers: RidgeLayer[];
  W: number;
  H: number;
  fade?: number;
}> = ({t, layers, W, H, fade = 1}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const ridgeY = (l: RidgeLayer, x: number) => {
      const xx = x + l.speed * t;
      return l.base * H + Math.sin(xx * l.k) * l.amp + Math.sin(xx * l.k2 + 1.7) * l.amp2;
    };

    layers.forEach((l, li) => {
      const baseY = l.base * H;
      const path = new Path2D();
      path.moveTo(0, H + 40);
      for (let x = 0; x <= W + 6; x += 6) path.lineTo(x, ridgeY(l, x));
      path.lineTo(W + 6, H + 40);
      path.closePath();

      const g = ctx.createLinearGradient(0, baseY - l.amp, 0, H);
      g.addColorStop(0, l.top);
      g.addColorStop(1, l.bot);
      ctx.globalAlpha = (l.alpha ?? 1) * fade;
      ctx.fillStyle = g;
      ctx.fill(path);

      ctx.beginPath();
      for (let x = 0; x <= W + 6; x += 6) {
        const y = ridgeY(l, x);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = l.rim;
      ctx.globalAlpha = l.rimA * fade;
      ctx.lineWidth = l.rimW;
      ctx.shadowColor = l.rim;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (l.grain) {
        const rnd = mulberry32(3300 + li * 733);
        ctx.fillStyle = l.grainColor ?? '#ffffff';
        for (let i = 0; i < l.grain; i++) {
          const u = rnd();
          const v = Math.pow(rnd(), 0.7);
          const r = 0.6 + rnd() * 1.9;
          const a = 0.1 + rnd() * 0.4;
          const x = ((u * (W + PAD * 2) - l.speed * t) % (W + PAD * 2) + (W + PAD * 2)) % (W + PAD * 2) - PAD;
          if (x < -10 || x > W + 10) continue;
          const yTop = ridgeY(l, x);
          const y = yTop + v * (H - yTop);
          ctx.globalAlpha = a * 0.55 * fade;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 2.2, r * 0.62, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    ctx.globalAlpha = 1;
  }, [t, layers, W, H, fade]);

  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};
