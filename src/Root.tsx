import React from 'react';
import {Composition} from 'remotion';
import {Cover, CoverPortrait} from './Cover';
import {Demo} from './Demo';
import {ThreeDemo} from './ThreeDemo';
import {CFG} from '../example/journey/config';
import {Journey} from '../example/journey/Journey';
import {P1Cloud, P2Dune, P3Sea, P4Snow, P5Star, previewFrames} from '../example/journey/previews';

/**
 * 四类 composition：
 *   Journey    参考成片：35 秒、五段地貌、一个人从少年走到老人（100% 复刻那条片子）
 *   Demo       最小示例：两段接力，学"怎么接"看这个，一屏代码就够
 *   ThreeDemo  3D 版：ThreeCanvas + 着色器，七段（允许切，卡点风格）
 *   P1–P5      单段预览：调一段画面时只渲一段，不用等全片
 */
const size = {fps: CFG.fps, width: CFG.width, height: CFG.height};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Journey"
      component={Journey}
      durationInFrames={CFG.fps * CFG.durationSec}
      {...size}
    />
    <Composition id="Demo" component={Demo} durationInFrames={1050} fps={30} width={1920} height={1080} />
    <Composition id="ThreeDemo" component={ThreeDemo} durationInFrames={924} fps={30} width={1920} height={1080} />

    {/* 封面：同一套构图，16:9 与 3:4 两种画幅（抖音主页九宫格用 3:4） */}
    <Composition id="Cover" component={Cover} durationInFrames={90} fps={30} width={1920} height={1080} />
    <Composition id="CoverPortrait" component={CoverPortrait} durationInFrames={90} fps={30} width={1080} height={1440} />

    <Composition id="P1Cloud" component={P1Cloud} durationInFrames={previewFrames(0, 6.9)} {...size} />
    <Composition id="P2Dune" component={P2Dune} durationInFrames={previewFrames(5.1, 12.9)} {...size} />
    <Composition id="P3Sea" component={P3Sea} durationInFrames={previewFrames(11.1, 19.9)} {...size} />
    <Composition id="P4Snow" component={P4Snow} durationInFrames={previewFrames(18.1, 26.9)} {...size} />
    <Composition id="P5Star" component={P5Star} durationInFrames={previewFrames(25.1, 35)} {...size} />
  </>
);
