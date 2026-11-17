import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export type MaskKind = 'cloud' | 'sand' | 'spray' | 'snow';

/**
 * 转场遮罩：不用叠化，用「穿过一层元素」。
 * 窗口中心 = 硬切点，此时遮罩最厚（0.97），观众看到的是穿过云/沙/浪/雪幕的那一瞬。
 * 前后各 0.6~1 秒是用来把情绪推上去的余量。
 */
export const Mask: React.FC<{kind: MaskKind; dur: number; tint?: string}> = ({kind, dur, tint}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const u = Math.min(1, Math.max(0, frame / Math.max(1, dur - 1)));
  const env = Math.pow(Math.sin(Math.PI * u), 0.42); // 平的顶：切点前后约 6 帧接近全白，硬切藏在这几帧里
  const t = frame / fps;

  if (kind === 'cloud') {
    const x = interpolate(u, [0, 1], [118, -42]);
    const y = interpolate(u, [0, 1], [26, -14]);
    return (
      <AbsoluteFill style={{overflow: 'hidden'}}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x + i * 9}%`,
              top: `${y + i * 7}%`,
              width: '160%',
              height: '120%',
              transform: 'translate(-50%,-50%)',
              background:
                'radial-gradient(ellipse 44% 40% at 50% 50%, rgba(255,252,246,0.98) 0%, rgba(255,248,238,0.86) 34%, rgba(255,242,228,0.4) 62%, rgba(255,240,226,0) 84%)',
              filter: 'blur(26px)',
              opacity: env,
            }}
          />
        ))}
        <AbsoluteFill style={{background: `rgba(255,251,244,${0.98 * env})`}} />
      </AbsoluteFill>
    );
  }

  if (kind === 'sand') {
    const x = interpolate(u, [0, 1], [-68, 78]);
    return (
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <div
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: '-20%',
            width: '150%',
            height: '150%',
            transform: `translate(-50%,-50%) rotate(-8deg)`,
            background:
              'linear-gradient(90deg, rgba(226,176,124,0) 0%, rgba(232,186,136,0.4) 26%, rgba(240,200,150,0.92) 52%, rgba(232,186,136,0.4) 78%, rgba(226,176,124,0) 100%)',
            filter: 'blur(30px)',
            opacity: env,
          }}
        />
        {/* 沙粒被风拉出的横向丝 */}
        {Array.from({length: 22}).map((_, i) => (
          <div
            key={`g${i}`}
            style={{
              position: 'absolute',
              left: `${x + ((i * 37) % 60) - 30}%`,
              top: `${8 + ((i * 53) % 84)}%`,
              width: `${24 + (i % 5) * 12}%`,
              height: i % 3 === 0 ? 3 : 2,
              background: 'rgba(255,232,198,0.5)',
              filter: 'blur(3px)',
              opacity: env * 0.9,
            }}
          />
        ))}
        <AbsoluteFill style={{background: `rgba(240,203,158,${0.95 * env})`}} />
      </AbsoluteFill>
    );
  }

  if (kind === 'spray') {
    const s = interpolate(u, [0, 1], [0.3, 2.6]);
    return (
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '108%',
            width: 2000,
            height: 1400,
            transform: `translate(-50%,-50%) scale(${s})`,
            background:
              'radial-gradient(ellipse 50% 46% at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(246,252,255,0.72) 30%, rgba(226,244,255,0.34) 56%, rgba(214,238,255,0) 78%)',
            filter: 'blur(18px)',
            opacity: env,
          }}
        />
        {Array.from({length: 26}).map((_, i) => {
          const a = -Math.PI / 2 + (i / 26 - 0.5) * 2.1;
          const d = interpolate(u, [0, 1], [0, 900]);
          return (
            <div
              key={`d${i}`}
              style={{
                position: 'absolute',
                left: `calc(50% + ${Math.cos(a) * d * 0.9}px)`,
                top: `calc(104% + ${Math.sin(a) * d * 0.55}px)`,
                width: 6 + (i % 4) * 4,
                height: 6 + (i % 4) * 4,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)',
                opacity: env * (0.5 + (i % 5) * 0.1),
                filter: 'blur(1px)',
              }}
            />
          );
        })}
        <AbsoluteFill style={{background: `rgba(244,251,255,${0.96 * env})`}} />
      </AbsoluteFill>
    );
  }

  // snow：雪幕被风拉开
  const sx = interpolate(u, [0, 1], [-40, 40]);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(100deg, rgba(232,240,255,0) 0%, rgba(238,244,255,0.5) 34%, rgba(246,250,255,0.95) 52%, rgba(238,244,255,0.5) 70%, rgba(232,240,255,0) 100%)`,
          transform: `translateX(${sx}%)`,
          filter: 'blur(12px)',
          opacity: env,
        }}
      />
      {Array.from({length: 46}).map((_, i) => (
        <div
          key={`s${i}`}
          style={{
            position: 'absolute',
            left: `${((i * 23) % 100) + sx * 0.6}%`,
            top: `${(i * 17) % 100}%`,
            width: 2 + (i % 3),
            height: 26 + (i % 5) * 22,
            background: 'rgba(255,255,255,0.7)',
            transform: `rotate(${18 + (i % 7) * 2}deg)`,
            filter: 'blur(1.5px)',
            opacity: env * 0.8,
          }}
        />
      ))}
      <AbsoluteFill style={{background: `rgba(246,250,255,${0.96 * env})`}} />
    </AbsoluteFill>
  );
};
