import React from 'react';

/**
 * 光遇式小人。同一个组件靠参数变成童年 / 少年 / 青年 / 中年 / 老年。
 *
 * 造型要点（这几个细节决定它像不像光遇，而不是一根药丸）：
 *  - 头比斗篷窄，中间留出颈部，否则头和身体黏成一体
 *  - 斗篷是 A 形：肩口窄、下摆宽
 *  - 头顶一盏烛光 + 逆光轮廓，人在逆光里才立得住
 *  - 腿是「髋 → 膝 → 脚」两段折线，跑步才有腾空感
 */

export type FigMode = 'run' | 'walk' | 'idle' | 'sit';
export type FigProp = 'lamp' | 'staff' | null;

export type FigSvgProps = {
  uid: string;
  h: number;
  t: number;
  mode?: FigMode;
  dir?: 1 | -1;
  cadence?: number;
  stride?: number;
  hunch?: number;
  tilt?: number;
  look?: number;
  prop?: FigProp;
  tint?: string;
  rim?: string;
  glow?: number;
  skirt?: number;
};

const VIEW_W = 120;
const VIEW_H = 200;

export const figWidth = (h: number) => h * (VIEW_W / VIEW_H) * 1.02;

/** 把 viewBox 内的点换算成屏幕像素（人物容器按底部中心锚定） */
export const localToScreen = (
  pt: {x: number; y: number},
  at: {x: number; foot: number; h: number; W: number; H: number}
) => {
  const w = figWidth(at.h);
  return {
    x: at.x * at.W - w / 2 + (pt.x / VIEW_W) * w,
    y: at.foot * at.H - at.h + (pt.y / VIEW_H) * at.h,
  };
};

export const FigSvg: React.FC<FigSvgProps> = ({
  uid,
  h,
  t,
  mode = 'run',
  dir = 1,
  cadence = 1.7,
  stride = 1,
  hunch = 0,
  tilt = 0,
  look = 0,
  prop = null,
  tint = '#140e1d',
  rim = 'rgba(255,210,156,0.52)',
  glow = 1,
  skirt = 0,
}) => {
  const moving = mode === 'run' || mode === 'walk';
  const seated = mode === 'sit';
  const sp = t * Math.PI * 2 * cadence;
  const flicker = 0.76 + 0.24 * Math.sin(t * 3.4 + uid.length);

  const HIP = seated ? 168 : 152;
  const LEG_FOOT = 192;

  const legPath = (phase: number) => {
    const a = Math.sin(phase) * 0.95;
    const fx = 60 + Math.sin(a) * 23 * stride * dir;
    const lift = Math.max(0, Math.cos(a)) * 14 * stride;
    const fy = LEG_FOOT - lift;
    const kx = 60 + (fx - 60) * 0.46 + 3 * dir;
    const ky = HIP + (fy - HIP) * 0.5 - 6;
    return `M60,${HIP} L${kx.toFixed(1)},${ky.toFixed(1)} L${fx.toFixed(1)},${fy.toFixed(1)}`;
  };

  let legA = `M60,${LEG_FOOT - 26} L54,${LEG_FOOT}`;
  let legB = `M60,${LEG_FOOT - 26} L66,${LEG_FOOT}`;
  if (moving) {
    legA = legPath(sp);
    legB = legPath(sp + Math.PI);
  }
  if (seated) {
    legA = `M58,168 L88,172 L96,192`;
    legB = `M58,168 L86,176 L93,194`;
  }

  // 体态：hunch 越大，头越往前塌、肩越抬
  const hx = 60 + hunch * 13 * dir;
  const hy = 40 + hunch * 9;
  const sy = 56 + hunch * 5;
  const hemW = 32 - hunch * 5 + skirt;
  const hem = 148 + hunch * 4;
  const cW = moving ? Math.sin(t * 6.4 + 1.1) * 3.4 : Math.sin(t * 1.05) * 1.6;
  const cW2 = moving ? Math.sin(t * 6.4 + 2.3) * 2.9 : Math.sin(t * 1.05 + 1.2) * 1.3;

  const gid = `g-${uid}`;
  const sid = `s-${uid}`;

  // 手的位置（持物）
  const handX = 60 + 19 * dir;
  const handY = 116;

  const lookShift = look * 5 * dir;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={h * (VIEW_W / VIEW_H)}
      height={h}
      style={{overflow: 'visible', display: 'block'}}
    >
      <defs>
        <radialGradient id={gid}>
          <stop offset="0%" stopColor="#FFFEF8" stopOpacity="1" />
          <stop offset="30%" stopColor="#FFE2AC" stopOpacity="0.7" />
          <stop offset="62%" stopColor="#FFC070" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFA858" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={sid}>
          <stop offset="0%" stopColor="#FFCF96" stopOpacity="0.46" />
          <stop offset="100%" stopColor="#FFB070" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={`rotate(${tilt} ${60} ${seated ? 176 : 190})`}>
        {/* 接触阴影：没有它，人站在坡上会显得悬空 */}
        <ellipse cx={60 + (seated ? 16 : 0)} cy={197} rx={seated ? 30 : 24} ry={4.6} fill="rgba(6,4,10,0.34)" />

        {/* 脚下暖光接触点 */}
        <ellipse cx={60 + (seated ? 16 : 0)} cy={194} rx={seated ? 40 : 31} ry={7} fill={`url(#${sid})`} opacity={0.8 * glow * flicker} />

        {/* 头顶烛光照亮的一小片夜空 */}
        <circle cx={hx} cy={hy - 20} r={50} fill={`url(#${gid})`} opacity={0.8 * glow * flicker} />

        {/* 腿 */}
        <path d={legB} stroke={tint} strokeWidth={9.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={legA} stroke={tint} strokeWidth={9.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* 斗篷：A 形，下摆随步幅飘 */}
        <path
          d={`M60,${sy - 2} C${49 + hunch * 4},${sy + 2} ${40 - skirt},${seated ? 150 : 100} ${(60 - hemW + cW).toFixed(
            1
          )},${hem} C${(60 - hemW + 8).toFixed(1)},${hem + 11} ${(60 - hemW / 2).toFixed(1)},${hem + 15.5} 60,${
            hem + 15.5
          } C${(60 + hemW / 2).toFixed(1)},${hem + 15.5} ${(60 + hemW - 8).toFixed(1)},${hem + 11} ${(
            60 + hemW + cW2
          ).toFixed(1)},${hem} C${80 + skirt},${seated ? 150 : 100} ${71 - hunch * 4},${sy + 2} 60,${sy - 2} Z`}
          fill={tint}
        />

        {/* 肩部披风领 */}
        <ellipse cx={60 + hunch * 4 * dir} cy={sy} rx={23 - hunch * 2} ry={7.5} fill={tint} />

        {/* 头 */}
        <ellipse cx={hx + lookShift} cy={hy} rx={15.5} ry={16} fill={tint} />

        {/* 头顶火焰 */}
        <ellipse cx={hx + lookShift} cy={hy - 20} rx={8.5} ry={11} fill="#FFD48C" opacity={0.36 * glow} />
        <ellipse cx={hx + lookShift} cy={hy - 21} rx={4.6} ry={8.6} fill="#FFFCF0" opacity={0.94 * glow * flicker} />

        {/* 逆光轮廓 */}
        <path
          d={`M60,${sy - 2} C${71 - hunch * 4},${sy + 2} 80,${seated ? 150 : 100} ${(60 + hemW + cW2).toFixed(1)},${hem}`}
          stroke={rim}
          strokeWidth={1.9}
          fill="none"
          opacity={0.9}
        />
        <ellipse cx={hx + lookShift} cy={hy} rx={15.5} ry={16} fill="none" stroke={rim} strokeWidth={1.6} opacity={0.72} />
        <path
          d={`M${60 - hemW + cW},${hem} C${60 - hemW + 8},${hem + 11} ${60 - hemW / 2},${hem + 15.5} 60,${hem + 15.5}`}
          stroke={rim}
          strokeWidth={1.6}
          fill="none"
          opacity={0.55}
        />

        {/* 持物 */}
        {prop === 'lamp' && (
          <g>
            <path d={`M${60 + 6 * dir},104 L${handX},${handY}`} stroke={tint} strokeWidth={6} strokeLinecap="round" />
            <line
              x1={handX}
              y1={handY + 2}
              x2={handX}
              y2={handY + 12}
              stroke="rgba(220,196,168,0.75)"
              strokeWidth={1.6}
            />
            <circle cx={handX} cy={handY + 18} r={7} fill="#FFD9A0" opacity={0.5 * glow} />
            <rect x={handX - 5.5} y={handY + 12} width={11} height={12} rx={3} fill={tint} stroke="rgba(255,214,160,0.5)" strokeWidth={1} />
            <circle cx={handX} cy={handY + 18} r={3.2} fill="#FFF3DA" opacity={0.95 * flicker} />
          </g>
        )}

        {prop === 'staff' && (
          <g>
            <path d={`M${60 + 4 * dir},108 L${handX},${handY}`} stroke={tint} strokeWidth={6} strokeLinecap="round" />
            <line
              x1={handX + 2 * dir}
              y1={handY - 12}
              x2={handX + 12 * dir}
              y2={196}
              stroke="#2a2030"
              strokeWidth={3.4}
              strokeLinecap="round"
            />
            <line
              x1={handX + 2 * dir}
              y1={handY - 12}
              x2={handX + 12 * dir}
              y2={196}
              stroke="rgba(255,206,150,0.28)"
              strokeWidth={1.2}
            />
            <circle cx={handX + 2 * dir} cy={handY - 13} r={9} fill="#FFD79C" opacity={0.24 * glow} />
            <circle cx={handX + 2 * dir} cy={handY - 13} r={3.4} fill="#FFF8E2" opacity={0.95 * glow * flicker} />
          </g>
        )}
      </g>
    </svg>
  );
};

/** 屏幕坐标版：按 x（0~1）、foot（0~1）摆一个人 */
export const Figure: React.FC<
  FigSvgProps & {x: number; foot: number; W: number; H: number; opacity?: number; blur?: number}
> = ({x, foot, W, H, opacity = 1, blur = 0, ...rest}) => {
  const w = figWidth(rest.h);
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${foot * 100}%`,
        width: w,
        height: rest.h,
        transform: 'translate(-50%,-100%)',
        opacity,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      }}
    >
      <FigSvg {...rest} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 道具：风筝 / 小鸟 / 海鸥 / 飞艇                                       */
/* ------------------------------------------------------------------ */

export const Bird: React.FC<{
  x: number;
  y: number;
  size: number;
  t: number;
  phase: number;
  color?: string;
  glide?: boolean;
  opacity?: number;
}> = ({x, y, size, t, phase, color = 'rgba(28,20,34,0.82)', glide = false, opacity = 1}) => {
  const flap = glide ? 0.24 + 0.1 * Math.sin(t * 0.9 + phase) : 0.6 + 0.4 * Math.sin(t * 7 + phase);
  const wy = flap * size * 0.62;
  return (
    <svg
      width={size * 2.4}
      height={size * 1.4}
      viewBox="0 0 100 60"
      style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', opacity, overflow: 'visible'}}
    >
      <path
        d={`M6,${30 + wy * 0.4} Q26,${30 - wy} 50,30 Q74,${30 - wy} 94,${30 + wy * 0.4}`}
        stroke={color}
        strokeWidth={3.4}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** 风筝：菱形骨架 + 三段长尾。tail 越大飘得越厉害 */
export const Kite: React.FC<{
  x: number;
  y: number;
  size: number;
  t: number;
  rot?: number;
  color?: string;
  tail?: number;
  opacity?: number;
}> = ({x, y, size, t, rot = 0, color = '#2a1e2e', tail = 1, opacity = 1}) => {
  const sway = Math.sin(t * 1.1) * 6;
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg)`, opacity}}>
      <svg width={size} height={size * 1.1} viewBox="0 0 100 110" style={{overflow: 'visible'}}>
        <path d="M50,2 L86,44 L50,86 L14,44 Z" fill={color} opacity={0.92} />
        <path d="M50,2 L50,86 M14,44 L86,44" stroke="rgba(255,222,180,0.34)" strokeWidth={1.4} />
        <path
          d={`M50,86 C${44 + sway},${100} ${56 + sway},${112} 50,${124 + tail * 14}`}
          stroke={color}
          strokeWidth={2}
          fill="none"
          opacity={0.72}
        />
        <path
          d={`M50,${96 + tail * 4} q${8 + sway * 0.4},6 ${2 + sway * 0.3},12`}
          stroke={color}
          strokeWidth={1.6}
          fill="none"
          opacity={0.5}
        />
      </svg>
    </div>
  );
};

/**
 * 奇思妙想的飞艇：半透布料气囊 + 补丁 + 鼻环 + 尾旗 + 推进桨 + 吊舱 + 挂灯
 *
 * 关键判断：气囊不能画成「暗色实心椭圆 + 一圈细亮边」——在逆光天空里那读作
 * 一只锅盖/飞碟。真布料是半透的，光从背后与地平线透上来，所以用「上暗下暖」
 * 的线性渐变 + 下缘暖光 + 边缘暗化，靠透光而不是靠描边来塑体积。
 * 另外必须破掉纯椭圆轮廓：鼻环、尾旗、尾鳍、桨环各咬一口，剪影才不像圆盘。
 */
export const Airship: React.FC<{
  x: number;
  y: number;
  scale: number;
  t: number;
  flip?: number;
  snowy?: boolean;
  opacity?: number;
  uid?: string;
}> = ({x, y, scale, t, flip = 1, snowy = false, opacity = 1, uid = 'as'}) => {
  const bob = Math.sin(t * 0.7) * 5;
  const rot = Math.sin(t * 0.5) * 1.6;
  const hull = snowy ? '#5b5266' : '#4a3446';
  const gid = `${uid}-env`;
  const hid = `${uid}-halo`;
  const sid = `${uid}-shade`;
  const scid = `${uid}-snowclip`;
  const sgid = `${uid}-snowgrad`;
  const lamp = 0.74 + 0.26 * Math.sin(t * 3.1);

  // 雪原是冷暮色。这里要克制：气囊不能被提亮成"玻璃泡"，
  // 夜景里它是一只暗调剪影，只靠极光在上缘勾一道冷边。
  const env = snowy
    ? ['#0e121b', '#19202e', '#2b3447', '#4b5568']
    : ['#2c2233', '#4c354a', '#9c6157', '#f2b487'];
  const haloCore = snowy ? 'rgba(158,188,250,0.14)' : 'rgba(255,186,126,0.26)';
  const haloMid = snowy ? 'rgba(150,180,240,0.06)' : 'rgba(255,168,116,0.10)';
  const under = snowy ? 'rgba(172,198,252,0.10)' : 'rgba(255,196,146,0.13)';
  const under2 = snowy ? 'rgba(190,212,255,0.07)' : 'rgba(255,206,158,0.10)';
  const underLine = snowy ? 'rgba(182,204,252,0.13)' : 'rgba(255,214,172,0.17)';
  const underLine2 = snowy ? 'rgba(202,220,255,0.15)' : 'rgba(255,226,190,0.20)';
  // 补丁要跟着气囊的色系走。暗底上贴暖橙色会变成"彩色贴纸"
  const patchA = snowy ? '#2a3244' : '#6a4c5e';
  const patchB = snowy ? '#4d5871' : '#c07c60';
  const patchC = snowy ? '#151b27' : '#543a52';
  const patchA2 = snowy ? 0.9 : 0.75;
  const patchB2 = snowy ? 0.7 : 0.5;
  const patchC2 = snowy ? 0.9 : 0.7;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + bob,
        transform: `translate(-50%,-50%) scaleX(${flip}) rotate(${rot}deg) scale(${scale})`,
        opacity,
      }}
    >
      <svg width={340} height={240} viewBox="0 0 340 240" style={{overflow: 'visible'}}>
        <defs>
          <linearGradient id={gid} x1="0.34" y1="0.04" x2="0.46" y2="1">
            <stop offset="0%" stopColor={env[0]} />
            <stop offset="34%" stopColor={env[1]} />
            <stop offset="68%" stopColor={env[2]} />
            <stop offset="100%" stopColor={env[3]} />
          </linearGradient>
          <radialGradient id={hid} cx="0.5" cy="0.62" r="0.5">
            <stop offset="0%" stopColor={haloCore} />
            <stop offset="58%" stopColor={haloMid} />
            <stop offset="100%" stopColor="rgba(255,168,116,0)" />
          </radialGradient>
          <radialGradient id={sid} cx="0.5" cy="0.4" r="0.64">
            <stop offset="0%" stopColor="rgba(18,9,22,0)" />
            <stop offset="64%" stopColor="rgba(18,9,22,0.05)" />
            <stop offset="100%" stopColor="rgba(18,9,22,0.40)" />
          </radialGradient>
          <clipPath id={scid}>
            <ellipse cx={160} cy={90} rx={104} ry={54} />
          </clipPath>
          <linearGradient id={sgid} gradientUnits="userSpaceOnUse" x1={0} y1={32} x2={0} y2={62}>
            <stop offset="0%" stopColor="rgba(240,246,255,0.70)" />
            <stop offset="48%" stopColor="rgba(240,246,255,0.34)" />
            <stop offset="100%" stopColor="rgba(240,246,255,0)" />
          </linearGradient>
        </defs>

        {/* 身后暖光：把气囊从天空里托出来，避免整块死黑压在暖天上 */}
        <ellipse cx={160} cy={112} rx={128} ry={66} fill={`url(#${hid})`} />

        {/* 尾气：三道渐薄的气流，示速。从桨后面起，别压住桨环 */}
        <path d="M300,86 q20,-3 38,0" stroke="rgba(255,214,170,0.13)" strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d="M302,94 q18,3 34,-4" stroke="rgba(255,214,170,0.09)" strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d="M302,74 q16,-3 30,-1" stroke="rgba(255,214,170,0.07)" strokeWidth={4} fill="none" strokeLinecap="round" />

        {/* 气囊：半透布料 */}
        <ellipse cx={160} cy={90} rx={104} ry={54} fill={`url(#${gid})`} opacity={0.97} />
        {/* 边缘暗化 → 侧壁转过去，不是一张贴纸 */}
        <ellipse cx={160} cy={90} rx={104} ry={54} fill={`url(#${sid})`} />
        {/* 下缘透光：地平线的暖光从布面里透上来。
            注意别画成一道锐利亮弧——那会立刻读成"飞碟底盘"。
            所以用「宽而淡 + 窄而亮」两条叠，且只占气囊下半的三分之二，两端化开 */}
        <ellipse cx={152} cy={124} rx={92} ry={19} fill={under} />
        <ellipse cx={150} cy={128} rx={70} ry={12} fill={under2} />
        <path d="M86,124 Q158,148 230,124" stroke={underLine} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        <path d="M104,126 Q158,143 214,125" stroke={underLine2} strokeWidth={1.6} fill="none" strokeLinecap="round" />

        {/* 分瓣线：只画下半个弧，上半暗部不给亮线 */}
        <path d="M160,36 C132,62 132,116 160,144" stroke="rgba(255,220,180,0.10)" strokeWidth={1.4} fill="none" />
        <path d="M160,36 C188,62 188,116 160,144" stroke="rgba(255,220,180,0.10)" strokeWidth={1.4} fill="none" />

        {/* 补丁：暖侧亮、暗侧沉 */}
        <rect x={104} y={72} width={23} height={17} rx={3} fill={patchA} opacity={patchA2} transform="rotate(-8 115 80)" />
        <rect x={184} y={106} width={19} height={15} rx={3} fill={patchB} opacity={patchB2} transform="rotate(6 193 113)" />
        <rect x={136} y={108} width={16} height={13} rx={2} fill={patchC} opacity={patchC2} transform="rotate(-4 144 114)" />

        {/* 鼻环：破掉左侧完美圆弧 */}
        <path d="M66,66 Q52,90 66,114" stroke="rgba(255,224,186,0.42)" strokeWidth={3} fill="none" strokeLinecap="round" />
        <circle cx={58} cy={90} r={4.5} fill={hull} stroke="rgba(255,214,170,0.3)" strokeWidth={1.2} />

        {/* 尾鳍 + 顶旗：把椭圆剪影咬出两个缺口 */}
        <path d="M256,66 L282,90 L256,114 Z" fill={hull} stroke="rgba(255,214,168,0.22)" strokeWidth={1.2} />
        <line x1={252} y1={38} x2={252} y2={10} stroke="rgba(255,214,168,0.35)" strokeWidth={1.4} />
        <path d="M252,13 L252,30 L274,21 Z" fill="rgba(255,204,150,0.42)" />

        {/* 推进桨：环 + 转动的叶片。叶片要压暗，亮了会变成一个十字星 */}
        <ellipse cx={290} cy={90} rx={13} ry={13} fill="none" stroke="rgba(255,214,170,0.18)" strokeWidth={1.2} />
        <ellipse cx={290} cy={90} rx={3} ry={13} fill="rgba(255,220,180,0.13)" />
        <line
          x1={290}
          y1={78}
          x2={290}
          y2={102}
          stroke="rgba(255,230,196,0.32)"
          strokeWidth={1.6}
          strokeLinecap="round"
          transform={`rotate(${(t * 720) % 180} 290 90)`}
        />
        <circle cx={290} cy={90} r={2.4} fill="rgba(255,226,186,0.34)" />

        {/* 积雪：裁在气囊轮廓里，下边界靠渐变化开。
            原来的写法有两个毛病——下边界是一条近乎水平的硬线（读作"贴了条白胶带"），
            而且两端超出椭圆，在气囊外面飘着。现在裁切 + 渐变，两端自然收成 0 */}
        {snowy && (
          <g clipPath={`url(#${scid})`}>
            <path d="M52,74 Q110,52 160,54 Q214,56 268,70 L268,18 L52,18 Z" fill={`url(#${sgid})`} />
            {/* 两坨垂下来的小雪，让边界不至于均匀 */}
            <ellipse cx={114} cy={60} rx={14} ry={8} fill="rgba(240,246,255,0.18)" />
            <ellipse cx={198} cy={57} rx={10} ry={6} fill="rgba(240,246,255,0.14)" />
          </g>
        )}

        {/* 吊索 */}
        <line x1={126} y1={140} x2={134} y2={172} stroke="rgba(255,220,180,0.3)" strokeWidth={1.2} />
        <line x1={194} y1={140} x2={186} y2={172} stroke="rgba(255,220,180,0.3)" strokeWidth={1.2} />

        {/* 吊舱 */}
        <rect x={120} y={170} width={80} height={34} rx={13} fill={hull} />
        <rect x={120} y={170} width={80} height={34} rx={13} fill="none" stroke="rgba(255,214,168,0.28)" strokeWidth={1.4} />
        <rect x={120} y={196} width={80} height={8} rx={4} fill="rgba(255,190,140,0.18)" />
        <circle cx={148} cy={187} r={4.6} fill={`rgba(255,232,190,${0.85 * lamp})`} />
        <circle cx={166} cy={187} r={4.6} fill={`rgba(255,232,190,${0.55 * lamp})`} />

        {/* 挂灯 */}
        <line x1={160} y1={204} x2={160} y2={214} stroke="rgba(255,220,180,0.4)" strokeWidth={1.2} />
        <circle cx={160} cy={218} r={12} fill="rgba(255,206,144,0.2)" />
        <circle cx={160} cy={218} r={4} fill="#FFEFCE" />
      </svg>
    </div>
  );
};
