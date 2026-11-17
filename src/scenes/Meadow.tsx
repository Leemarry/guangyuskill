import React from 'react';
import {AbsoluteFill} from 'remotion';

/**
 * 示例场景 A：丘陵草甸（暖调）。
 *
 * 场景组件的约定只有两条：
 *   1. 只接收全局秒数 sec，不自己持有时间原点 —— 这样 Relay 才能把它塞进任意区间。
 *   2. 整幅铺满：地面一直画到画框底边，天上不留透明区。
 *      因为接力的原理是"新的在旧的下面等着被露出来"，如果新场景有透明区，
 *      露出来的就是底色，那就又变成"闪"了。
 */
export const Meadow: React.FC<{sec: number}> = ({sec}) => {
  const drift = (sec * 5) % 400;

  return (
    <AbsoluteFill>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
      >
        {/* 远脊：最淡，压在地平线附近 */}
        <path
          d="M0,700 C240,654 420,692 620,668 C820,644 980,684 1180,664 C1400,642 1600,690 1800,670 L1920,662 L1920,1080 L0,1080 Z"
          fill="#2b2547"
          opacity="0.5"
        />
        {/* 中景丘 */}
        <path
          d="M0,776 C260,730 480,772 700,752 C920,732 1120,776 1340,758 C1560,740 1760,776 1920,762 L1920,1080 L0,1080 Z"
          fill="#241f3d"
          opacity="0.86"
        />
        {/* 地面：从地平线一路到画框底，暖色接住落日 */}
        <path
          d="M0,830 C300,800 600,836 900,822 C1200,808 1500,838 1920,816 L1920,1080 L0,1080 Z"
          fill="#191430"
        />
        {/* 地面受光：一条贴着地平线的暖光，两端化开 */}
        <path
          d="M0,828 C300,798 600,834 900,820 C1200,806 1500,836 1920,814 L1920,864 C1500,884 1200,856 900,870 C600,884 300,850 0,878 Z"
          fill="#ffb877"
          opacity="0.13"
        />
      </svg>

      {/* 三团低云：横向缓慢漂移，不换层，看起来就是"一直在那儿" */}
      {[
        {x: 320, y: 690, w: 520, h: 90, o: 0.2},
        {x: 980, y: 660, w: 640, h: 110, o: 0.16},
        {x: 1560, y: 700, w: 460, h: 80, o: 0.14},
      ].map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${c.x - drift * (0.4 + i * 0.2)}px`,
            top: `${c.y}px`,
            width: c.w,
            height: c.h,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 50% 60%, rgba(255,214,170,0.9) 0%, rgba(255,196,150,0) 70%)',
            opacity: c.o,
            filter: 'blur(18px)',
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
