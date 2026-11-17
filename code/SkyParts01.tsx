import React from 'react';
import {skyGradient, type Stop} from './util';

export const SkyGradient: React.FC<{stops: Stop[]; stopsEnd?: Stop[]; p?: number}> = ({stops, stopsEnd, p = 0}) => (
  <div style={{position: 'absolute', inset: 0, background: skyGradient(stops, p, stopsEnd)}} />
);

/** 太阳 / 月亮：一个大光晕 + 一个小光核，光核永远比光晕亮，云才能"穿过"它 */
export const Sun: React.FC<{
  x: number;
  y: number;
  t: number;
  scale?: number;
  halo?: number;
  core?: number;
  intensity?: number;
  beam?: boolean;
  tint?: string;
}> = ({x, y, t, scale = 1, halo = 1420, core = 320, intensity = 1, beam = false, tint = '255,244,214'}) => {
  const pulse = 1 + 0.04 * Math.sin(t * 0.7);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: halo * scale * pulse,
          height: halo * scale * pulse,
          transform: 'translate(-50%,-50%)',
          background: `radial-gradient(circle, rgba(${tint},${0.5 * intensity}) 0%, rgba(255,222,172,${0.26 * intensity}) 14%, rgba(255,190,132,${
            0.11 * intensity
          }) 30%, rgba(255,164,116,${0.04 * intensity}) 48%, rgba(255,150,110,0) 68%)`,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: core * scale * pulse,
          height: core * scale * pulse,
          transform: 'translate(-50%,-50%)',
          background: `radial-gradient(circle, rgba(255,255,253,${0.94 * intensity}) 0%, rgba(255,250,234,${0.82 * intensity}) 16%, rgba(255,238,202,${
            0.46 * intensity
          }) 34%, rgba(255,222,178,${0.16 * intensity}) 54%, rgba(255,210,164,0) 74%)`,
        }}
      />
      {beam && (
        <div
          style={{
            position: 'absolute',
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            width: halo * 0.9 * scale,
            height: 160 * scale,
            transform: `translate(-50%,-50%) rotate(${Math.sin(t * 0.2) * 0.8}deg)`,
            background:
              'linear-gradient(90deg, rgba(255,226,182,0) 0%, rgba(255,236,200,0.06) 32%, rgba(255,244,214,0.1) 50%, rgba(255,236,200,0.06) 68%, rgba(255,226,182,0) 100%)',
            mixBlendMode: 'screen',
          }}
        />
      )}
    </>
  );
};

/** 地平线受光带：夹在天空与地面之间那条暖光，两端化开 */
export const HorizonGlow: React.FC<{y: number; width?: number; height?: number; opacity?: number; tint?: string}> = ({
  y,
  width = 112,
  height = 11,
  opacity = 1,
  tint = '255,238,204',
}) => (
  <div
    style={{
      position: 'absolute',
      left: `${(100 - width) / 2 - 4}%`,
      top: `${y * 100}%`,
      width: `${width}%`,
      height: `${height}%`,
      transform: 'translateY(-50%)',
      opacity,
      WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 34%, #000 66%, rgba(0,0,0,0) 100%)',
      maskImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 34%, #000 66%, rgba(0,0,0,0) 100%)',
      background: `radial-gradient(ellipse 40% 58% at 46% 50%, rgba(${tint},0.42) 0%, rgba(255,216,170,0.2) 46%, rgba(255,200,150,0) 82%), radial-gradient(ellipse 34% 54% at 70% 48%, rgba(${tint},0.3) 0%, rgba(255,212,168,0.14) 48%, rgba(255,202,156,0) 84%)`,
    }}
  />
);
