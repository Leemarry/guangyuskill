import React, {useLayoutEffect, useRef} from 'react';
import {cloudSprite, mulberry32, wrap, type CloudTone} from '../lib/util';

export type CloudBand = {
  y: number;
  h: number;
  speed: number;
  n: number;
  dn: number;
  wMin: number;
  wMax: number;
  aMin: number;
  aMax: number;
  tone: number;
  jitter: number;
};

type Cloud = {
  x0: number;
  y: number;
  w: number;
  h: number;
  a: number;
  tone: number;
  spr: number;
  ph: number;
  bob: number;
  speed: number;
  morph: number;
  morphPh: number;
  rise: number;
  risePh: number;
};

/**
 * 云海：分层横向视差。
 * 越靠下的层离镜头越近 → 越大越快（火车窗外那一层）。
 * 同一层内每条云的速度还有 ±speedJitter 的扰动，所以走十几秒后相对位置会错开，
 * 云海轮廓持续重排 —— 这是它不像"一张纸平移"的关键。
 */
export function buildClouds(bands: CloudBand[], seed: number, W: number, pad: number): Cloud[] {
  const rnd = mulberry32(seed);
  const RANGE = W + pad * 2;
  return bands.flatMap((b) => {
    const step = RANGE / b.n;
    const mk = (x0: number, detail: boolean): Cloud => ({
      x0,
      y: b.y * 1080 + (rnd() - 0.5) * b.jitter * 2,
      w: detail ? b.wMin * 0.26 + rnd() * b.wMax * 0.2 : b.wMin + rnd() * (b.wMax - b.wMin),
      h: b.h * (0.78 + rnd() * 0.46) * (detail ? 0.6 : 1),
      a: (b.aMin + rnd() * (b.aMax - b.aMin)) * (detail ? 1.06 : 1),
      tone: b.tone,
      spr: Math.floor(rnd() * 4),
      ph: rnd() * Math.PI * 2,
      bob: 4 + rnd() * 8,
      speed: b.speed * (1 + (rnd() * 2 - 1) * 0.1) * (detail ? 1.14 : 1),
      morph: (rnd() * 2 - 1) * 0.08,
      morphPh: rnd() * Math.PI * 2,
      rise: (rnd() * 2 - 1) * 18,
      risePh: rnd() * Math.PI * 2,
    });
    const mains = Array.from({length: b.n}, (_, i) => mk((i + rnd() * 0.55) * step, false));
    const details = Array.from({length: b.dn}, () => mk(rnd() * RANGE, true));
    return [...mains, ...details];
  });
}

export const CloudField: React.FC<{
  t: number;
  clouds: Cloud[];
  tones: CloudTone[];
  W: number;
  H: number;
  pad: number;
  fade?: number;
  scroll?: number;
}> = ({t, clouds, tones, W, H, pad, fade = 1, scroll = 1}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const RANGE = W + pad * 2;

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    for (const c of clouds) {
      const x = wrap(c.x0 - c.speed * t * scroll, RANGE) - pad;
      const m = 1 + c.morph * Math.sin(t * 0.32 + c.morphPh);
      const cw = c.w * m;
      const hw = cw / 2;
      if (x + hw < -40 || x - hw > W + 40) continue;

      const y = c.y + Math.sin(t * 0.55 + c.ph) * c.bob + c.rise * Math.sin(t * 0.22 + c.risePh);
      const ch = c.h * m;
      const hh = ch / 2;
      if (y + hh < -40 || y - hh > H + 40) continue;

      ctx.globalAlpha = Math.min(1, c.a * fade);
      ctx.drawImage(cloudSprite(tones[c.tone], c.spr), x - hw, y - hh, cw, ch);
    }
    ctx.globalAlpha = 1;
  }, [t, clouds, tones, W, H, pad, fade, scroll, RANGE]);

  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};
