import React from 'react';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {CFG, toF} from '../config';
import {EASE_OUT, hash01} from '../lib/util';

/** 文案：楷体 + 逐字入场 + 手写式错落。整行还有极慢的漂浮与呼吸 */
export const Caption: React.FC<{frame: number}> = ({frame}) => {
  const T = CFG.text;
  const lines = CFG.lines.map((l) => ({...l, from: toF(l.start), to: toF(l.end)}));
  const active = lines.filter((l) => frame >= l.from - 1 && frame <= l.to + 2);
  const frameT = frame / CFG.fps;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {active.map((line) => {
        const chars = Array.from(line.text);
        const out = interpolate(frame, [line.to - 18, line.to], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.quad),
        });
        const floatY = (frame - line.from) * -0.16;
        const lineBreathe = 1 + Math.sin(frameT * 0.8) * 0.008;

        return (
          <div
            key={line.text}
            style={{
              position: 'absolute',
              left: 0,
              width: '100%',
              top: `${T.y * 100}%`,
              transform: `translateY(calc(-50% + ${floatY}px)) scale(${lineBreathe})`,
              display: 'flex',
              justifyContent: 'center',
              opacity: out,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 1320,
                height: 330,
                transform: 'translate(-50%,-50%)',
                background:
                  'radial-gradient(ellipse at center, rgba(255,190,128,0.12) 0%, rgba(255,170,110,0.05) 42%, rgba(255,160,100,0) 72%)',
                mixBlendMode: 'screen',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${T.letterGap}em`,
                fontSize: T.size,
                fontFamily: T.fontFamily,
                fontWeight: 400,
                color: T.color,
                whiteSpace: 'nowrap',
                lineHeight: 1.35,
              }}
            >
              {chars.map((ch, i) => {
                const inStart = line.from + i * T.charStagger;
                const p = interpolate(frame, [inStart, inStart + T.charIn], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: EASE_OUT,
                });

                const jy = (hash01(i + 11) - 0.5) * T.jitterY;
                const jr = (hash01(i + 37) - 0.5) * T.jitterRot;
                const js = 1 + (hash01(i + 73) - 0.5) * T.jitterScale;
                const accent = ch === '光';
                const scale = js * (accent ? 1.13 : 1);
                const wave = Math.sin(frameT * 1.2 + i * 0.62) * 3.8;
                const tilt = Math.sin(frameT * 0.85 + i * 0.95) * 1.7;

                return (
                  <span
                    key={`${ch}-${i}`}
                    style={{
                      display: 'inline-block',
                      color: accent ? T.accentColor : T.color,
                      opacity: p,
                      transform: `translateY(${jy + wave + (1 - p) * 46}px) rotate(${jr + tilt}deg) scale(${scale})`,
                      filter: p < 0.995 ? `blur(${(1 - p) * 14}px)` : undefined,
                      textShadow: accent
                        ? '0 0 2.5px rgba(255,248,228,0.9), 0 0 20px rgba(255,230,180,1), 0 0 54px rgba(255,196,128,0.78), 0 0 112px rgba(255,164,100,0.5)'
                        : '0 0 2px rgba(255,246,224,0.82), 0 0 18px rgba(255,224,172,0.92), 0 0 46px rgba(255,190,124,0.66), 0 0 98px rgba(255,160,98,0.4)',
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
