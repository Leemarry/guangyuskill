import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {SkyLayer} from './components/World';
import {Caption} from './components/Caption';
import {Hero} from './components/Hero';
import {CFG, toF} from './config';
import {cameraAt} from './lib/clock';
import {CloudSea} from './scenes/CloudSea';
import {Dunes} from './scenes/Dunes';
import {Seaside} from './scenes/Seaside';
import {Snowfield} from './scenes/Snowfield';
import {StarSea} from './scenes/StarSea';

/**
 * 单段预览：只渲一段，但要带着全局的天空 / 镜头 / 主角。
 *
 * 为什么不能单独抽一个场景出来看：因为天空、镜头、主角这三样现在是**跨段**的，
 * 单抽一个场景会没有天、没有人。这里把三者照样带上，`sec` 从本段的 from 起算，
 * 所以预览里的天色、人物年龄和正片完全一致。
 *
 * 调画面时用它们，不要为了改一处草坡等 2 分钟渲全片。
 */
const Seg: React.FC<{C: React.FC<{frame: number; sec: number}>; from: number}> = ({C, from}) => {
  const f = useCurrentFrame();
  const sec = (f + toF(from)) / CFG.fps;
  const cam = cameraAt(sec);
  return (
    <AbsoluteFill style={{backgroundColor: '#05070f', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `translate(${cam.x.toFixed(2)}px, ${cam.y.toFixed(2)}px) scale(${cam.scale.toFixed(4)})`,
          transformOrigin: '50% 61%',
        }}
      >
        <SkyLayer sec={sec} />
        <C frame={f} sec={sec} />
        <Hero sec={sec} />
      </AbsoluteFill>
      <Caption frame={f + toF(from)} />
    </AbsoluteFill>
  );
};

export const P1Cloud: React.FC = () => <Seg C={CloudSea} from={0} />;
export const P2Dune: React.FC = () => <Seg C={Dunes} from={5.1} />;
export const P3Sea: React.FC = () => <Seg C={Seaside} from={11.1} />;
export const P4Snow: React.FC = () => <Seg C={Snowfield} from={18.1} />;
export const P5Star: React.FC = () => <Seg C={StarSea} from={25.1} />;

/** 每段的帧数，注册 composition 时用。 */
export const previewFrames = (from: number, to: number) => toF(to) - toF(from);
