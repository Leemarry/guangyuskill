import React from 'react';
import {AbsoluteFill} from 'remotion';

/**
 * 示例场景 B：雪原（冷调）。
 *
 * 注意它和 A 的差别只在于"内容"：色系、轮廓、颗粒。
 * 结构上完全一样 —— 整幅铺满、只接 sec、地平线位置一致。
 * 地平线一致很重要：接力时如果两段的天地分界差得远，
 * 观众会看到"地表在跳"，哪怕天色是连续的。
 */
export const Frost: React.FC<{sec: number}> = ({sec}) => {
  const drift = (sec * 3) % 300;

  return (
    <AbsoluteFill>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
      >
        {/* 远山：冷蓝，几乎融进天色。
            走势要和前一段的远脊接近 —— 两段的地平线在同一条线上，
            观众读到的是"地表换了"，而不是"后面冒出一排新山" */}
        <path
          d="M0,726 C200,700 360,722 540,706 C720,690 880,716 1060,702 C1240,688 1400,714 1580,703 C1740,694 1840,712 1920,706 L1920,1080 L0,1080 Z"
          fill="#1b2338"
          opacity="0.72"
        />
        {/* 雪坡正面 */}
        <path
          d="M0,812 C280,782 560,818 840,802 C1120,786 1420,820 1920,796 L1920,1080 L0,1080 Z"
          fill="#232c44"
        />
        {/* 雪面高光：只在下缘一条，不做整片提亮（否则夜空不下雪） */}
        <path
          d="M0,810 C280,780 560,816 840,800 C1120,784 1420,818 1920,794 L1920,846 C1420,868 1120,836 840,850 C560,864 280,830 0,860 Z"
          fill="#cfe0ff"
          opacity="0.1"
        />
        {/* 两座雪丘：底边用下凸弧，上缘加一道受光边。
            只画填充会读成"扁椭圆斑"，补上受光边才立得住 */}
        <path d="M300,838 C330,790 430,782 470,838 C470,856 420,862 386,862 C352,862 306,856 300,838 Z" fill="#283146" />
        <path
          d="M308,830 C336,792 426,787 462,830"
          stroke="#93abc9"
          strokeWidth="1.8"
          fill="none"
          opacity="0.28"
          strokeLinecap="round"
        />
        <path d="M1320,846 C1352,796 1452,788 1492,846 C1492,864 1440,870 1406,870 C1372,870 1326,864 1320,846 Z" fill="#263045" />
        <path
          d="M1328,838 C1356,798 1446,793 1484,838"
          stroke="#8fa7c6"
          strokeWidth="1.8"
          fill="none"
          opacity="0.24"
          strokeLinecap="round"
        />
      </svg>

      {/* 雪粒：横向拖尾，才有风感。
          只在地平线以下 —— 飘到天上就成了"两个天气叠在一起"，
          交接期会明显出戏 */}
      {Array.from({length: 60}, (_, i) => {
        const seed = (i * 137) % 1000;
        const x = (seed * 1.9 - drift * (0.6 + (seed % 5) * 0.2) + 1920) % 1920;
        const y = 690 + ((seed * 7) % 360);
        const w = 3 + (seed % 4) * 2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${w * 2}px`,
              height: '1px',
              background: 'rgba(226,238,255,0.42)',
              borderRadius: '1px',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
