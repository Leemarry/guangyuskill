import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Airship, Bird, Figure} from '../code/Figure01';
import {hash01} from '../code/util';

/**
 * 封面：35 秒短片《人的一生》的封面（不是技能包封面）。
 *
 * 人物全部是技能包里的 `Figure01`（斗篷小人），不是正片男主女主。
 *
 * 构图三层：
 *   上：天色 + 标题（文字压在空天里，不压人）
 *   中：地平线暖光带 + 远山 + 飞艇 + 小鸟（逆光剪影）
 *   下：前景山脊，一排小人站在脊线上，脊线有暖色勾边
 *
 * 为什么人物是纯剪影：他们脚下就是最亮的地平线，逆光下只能看到轮廓。
 * 这不是省事，是这类画面的看家本领——人是黑的，光在背后。
 */

const SERIF = "'Noto Serif SC', 'STZhongsong', 'Source Han Serif SC', SimSun, serif";
const SANS = "'Noto Sans SC', 'Microsoft YaHei', sans-serif";

type Variant = 'wide' | 'tall';

const LAYOUT: Record<
  Variant,
  {
    eyebrow: number;
    title: number;
    en: number;
    sub: number;
    tag: number;
    horizon: number;
    crest: number;
    figK: number;
    curve: number;
    titleScale: number;
  }
> = {
  wide: {
    eyebrow: 0.115,
    title: 0.288,
    en: 0.432,
    sub: 0.508,
    tag: 0.568,
    horizon: 0.775,
    crest: 0.796,
    figK: 1,
    curve: 0.062,
    titleScale: 1,
  },
  tall: {
    eyebrow: 0.100,
    title: 0.250,
    en: 0.348,
    sub: 0.418,
    tag: 0.472,
    horizon: 0.696,
    crest: 0.726,
    figK: 1,
    curve: 0.046,
    titleScale: 0.66,
  },
};

/** 山脊顶边（归一化 y）。中间隆起，两侧下探——人在脊线上才站得住。
 *  curve 是两侧下探的幅度：宽画幅可以弯得狠一点，竖画幅弯太狠会在四角留下大片黑。*/
const crestY = (x: number, base: number, curve: number) => base + curve * Math.pow(2 * x - 1, 2);

/** 天空：从夜到黄昏。前 3 段是冷色，后 3 段走到暖色，避免"灰蒙蒙一片" */
const SKY: [number, string][] = [
  [0.0, '#050916'],
  [0.16, '#0B1730'],
  [0.34, '#183453'],
  [0.5, '#2B5A76'],
  [0.62, '#4F7E8C'],
  [0.7, '#8C8079'],
  [0.745, '#D39C82'],
  [0.775, '#F4C295'],
  [0.8, '#FFDDB4'],
  [1.0, '#FFE8C6'],
];

const skyStops = () =>
  SKY.map(([o, c]) => (
    <stop key={o} offset={`${o * 100}%`} stopColor={c} />
  ));

/**
 * 远山脊：正弦叠加，不用随机，保证每次渲出来一样。
 * 只有一条正弦时，压低振幅就读成"一条横杠"，所以这里用三条不同频率叠：
 * 低频起伏（山体走向）+ 中频（峰）+ 高频（碎岩），再乘一个两边收的包络。
 */
const ridgePath = (W: number, H: number, base: number, amp: number, seed: number) => {
  const pts: string[] = [];
  const N = 72;
  for (let i = 0; i <= N; i++) {
    const x = i / N;
    const env = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, x)));
    const h =
      0.5 +
      0.34 * Math.sin(x * 3.4 + seed) +
      0.22 * Math.sin(x * 8.1 + seed * 2.3) +
      0.12 * Math.sin(x * 15.7 + seed * 4.1);
    const y = base - amp * h * (0.6 + 0.4 * env);
    pts.push(`${(x * W).toFixed(1)},${(y * H).toFixed(1)}`);
  }
  return `M${pts.join(' L')} L${W},${H} L0,${H} Z`;
};

const CoverArt: React.FC<{variant: Variant}> = ({variant}) => {
  const frame = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const t = frame / 30;
  const L = LAYOUT[variant];
  const U = Math.min(W, H) / 1080; // 字号统一按短边缩放，两种画幅视觉一致

  // 前景山脊路径
  const hillPts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = i / 40;
    hillPts.push(`${(x * W).toFixed(1)},${(crestY(x, L.crest, L.curve) * H).toFixed(1)}`);
  }
  const hill = `M${hillPts.join(' L')} L${W},${H} L0,${H} Z`;

  // 一排小人：x 从远到近，个子由小到大，中间那个最高（主角位）
  const figures = [
    {x: 0.185, h: 0.098, mode: 'walk', prop: 'staff', dir: -1, cad: 1.35, tint: '#0A1420'},
    {x: 0.315, h: 0.128, mode: 'walk', prop: null, dir: 1, cad: 1.6, tint: '#0A1420'},
    {x: 0.445, h: 0.176, mode: 'walk', prop: 'lamp', dir: 1, cad: 1.7, tint: '#060D16'},
    {x: 0.545, h: 0.104, mode: 'walk', prop: null, dir: 1, cad: 1.95, tint: '#0A1420'},
    {x: 0.665, h: 0.118, mode: 'idle', prop: 'lamp', dir: -1, cad: 1.2, tint: '#0A1420'},
    {x: 0.795, h: 0.092, mode: 'sit', prop: null, dir: -1, cad: 1.1, tint: '#0C1822'},
  ] as const;

  // 星点
  const stars = Array.from({length: 150}, (_, i) => {
    const x = hash01(i * 3.7 + 1);
    const y = hash01(i * 7.1 + 5) * 0.66;
    const fade = Math.pow(1 - y / 0.66, 1.5);
    return {
      x,
      y,
      r: 0.7 + hash01(i * 1.9) * 1.5,
      a: fade * (0.35 + 0.65 * hash01(i * 5.3)) * (0.72 + 0.28 * Math.sin(t * 1.9 + i)),
    };
  });

  // 上升的光点（光遇的招牌粒子）：贴着脊线往上飘
  const motes = Array.from({length: 46}, (_, i) => {
    const bx = hash01(i * 4.3 + 2);
    const speed = 6 + hash01(i * 2.2) * 14;
    const life = 4.5 + hash01(i * 8.8) * 4;
    const ph = (t * speed + i * 3.3) % life;
    const rise = ph / life;
    return {
      x: bx + Math.sin(t * 0.9 + i) * 0.006,
      y: crestY(bx, L.crest, L.curve) - rise * (0.10 + hash01(i * 6.6) * 0.12),
      a: Math.sin(rise * Math.PI) * 0.85,
      r: 1.1 + hash01(i * 9.1) * 1.9,
    };
  });

  return (
    <AbsoluteFill style={{background: '#050916'}}>
      {/* ---------------- 天空 ---------------- */}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            {skyStops()}
          </linearGradient>
          <radialGradient id="sunglow">
            <stop offset="0%" stopColor="#FFD9A6" stopOpacity="0.72" />
            <stop offset="26%" stopColor="#FFB877" stopOpacity="0.34" />
            <stop offset="58%" stopColor="#F08A5C" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#E07040" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunCore">
            <stop offset="0%" stopColor="#FFFDF4" stopOpacity="1" />
            <stop offset="55%" stopColor="#FFE7BE" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#FFC98A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vignette" cx="0.5" cy="0.52" r="0.78">
            <stop offset="45%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#02040B" stopOpacity="0.55" />
          </radialGradient>
        </defs>

        <rect width={W} height={H} fill="url(#sky)" />

        {/* 星：只在天顶，越靠地平线越淡 */}
        {stars.map((s, i) => (
          <circle key={i} cx={s.x * W} cy={s.y * H} r={s.r * U} fill="#FFF6E4" opacity={s.a} />
        ))}

        {/* 太阳光晕：圆心在地平线下一点点，只露上半 */}
        <ellipse cx={W * 0.505} cy={H * (L.horizon + 0.012)} rx={W * 0.42} ry={H * 0.40} fill="url(#sunglow)" />
        <ellipse cx={W * 0.505} cy={H * (L.horizon + 0.004)} rx={W * 0.055} ry={H * 0.05} fill="url(#sunCore)" />

        {/* 高空薄云：压暗一点天顶，让标题区不空 */}
        <ellipse
          cx={W * 0.28}
          cy={H * 0.30}
          rx={W * 0.34}
          ry={H * 0.055}
          fill="#7E9BB4"
          opacity={0.14}
          style={{filter: `blur(${38 * U}px)`}}
        />
        <ellipse
          cx={W * 0.74}
          cy={H * 0.40}
          rx={W * 0.30}
          ry={H * 0.05}
          fill="#93A9BE"
          opacity={0.12}
          style={{filter: `blur(${42 * U}px)`}}
        />

        {/* 远山两层：越近越暗，做出空气透视 */}
        <path d={ridgePath(W, H, L.horizon - 0.004, 0.058, 1.3)} fill="#24405A" opacity={0.74} />
        <path d={ridgePath(W, H, L.horizon + 0.014, 0.034, 3.7)} fill="#132539" opacity={0.92} />

        {/* 地平线暖雾：用两团模糊椭圆化开接缝，不用矩形——矩形的上下边会留下两道横杠 */}
        <ellipse
          cx={W * 0.5}
          cy={H * (L.horizon - 0.006)}
          rx={W * 0.62}
          ry={H * 0.015}
          fill="#FFCFA0"
          opacity={0.18}
          style={{filter: `blur(${22 * U}px)`}}
        />
        <ellipse
          cx={W * 0.505}
          cy={H * (L.horizon + 0.002)}
          rx={W * 0.24}
          ry={H * 0.013}
          fill="#FFDCB2"
          opacity={0.28}
          style={{filter: `blur(${26 * U}px)`}}
        />

        {/* 小鸟不在这里画：Bird 自带一层 <svg>，嵌在天空的 <svg> 里 left/top 会失效，
            必须和人物一样放在外层。见下方 sky 闭合之后。 */}

        {/* 前景山脊 */}
        <path d={hill} fill="#070E19" />
        {/* 地面反光：脊线两侧压一层极淡的冷光。没有它，纯黑地面紧贴亮带，像贴上去的纸 */}
        <path
          d={`M${hillPts.join(' L')}`}
          fill="none"
          stroke="#8FB0C8"
          strokeWidth={30 * U}
          opacity={0.1}
          strokeLinecap="round"
          style={{filter: `blur(${20 * U}px)`}}
        />
        {/* 脊线勾边：一条暖线，人站在那里才像被地平线照亮 */}
        <path
          d={`M${hillPts.join(' L')}`}
          fill="none"
          stroke="#FFC894"
          strokeWidth={2.4 * U}
          opacity={0.42}
          strokeLinecap="round"
        />
        <path
          d={`M${hillPts.join(' L')}`}
          fill="none"
          stroke="#FFB070"
          strokeWidth={7 * U}
          opacity={0.18}
          strokeLinecap="round"
          style={{filter: `blur(${6 * U}px)`}}
        />

        {/* 上升光点 */}
        {motes.map((m, i) => (
          <circle key={`m${i}`} cx={m.x * W} cy={m.y * H} r={m.r * U} fill="#FFE0AE" opacity={m.a * 0.8} />
        ))}

        <rect width={W} height={H} fill="url(#vignette)" />
      </svg>

      {/* ---------------- 小鸟 ----------------
          相位不是随便给的：Bird 的翅膀高度是 0.6+0.4·sin(t·7+φ)，
          取到 sin≈−1 时整只鸟会压成一条横线。这里挑的都是这一帧展翅的相位。 */}
      <Bird x={W * 0.212} y={H * (L.horizon - 0.123)} size={30 * U} t={t} phase={4.4} color="rgba(10,7,14,0.9)" />
      <Bird x={W * 0.272} y={H * (L.horizon - 0.161)} size={21 * U} t={t} phase={5.9} color="rgba(10,7,14,0.76)" />
      <Bird x={W * 0.176} y={H * (L.horizon - 0.079)} size={16 * U} t={t} phase={4.9} color="rgba(10,7,14,0.66)" />
      <Bird x={W * 0.732} y={H * (L.horizon - 0.159)} size={18 * U} t={t} phase={5.3} color="rgba(12,9,18,0.6)" />

      {/* ---------------- 飞艇（绝对定位，用组件原样） ---------------- */}
      <Airship x={W * 0.855} y={H * (L.horizon - 0.185)} scale={0.62 * U} t={t} uid="cv" opacity={0.85} />

      {/* ---------------- 人物 ---------------- */}
      {figures.map((f, i) => (
        <Figure
          key={i}
          x={f.x}
          foot={crestY(f.x, L.crest, L.curve) + 0.002}
          W={W}
          H={H}
          uid={`cv${i}`}
          h={H * f.h * L.figK}
          t={t + i * 0.37}
          mode={f.mode as 'walk' | 'idle' | 'sit'}
          dir={f.dir as 1 | -1}
          cadence={f.cad}
          prop={f.prop as 'lamp' | 'staff' | null}
          tint={f.tint}
          rim="rgba(255,206,150,0.55)"
          glow={1.05}
        />
      ))}

      {/* ---------------- 文字 ---------------- */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily: SERIF,
        }}
      >
        {/* 眉标 */}
        <div
          style={{
            position: 'absolute',
            top: `${L.eyebrow * 100}%`,
            display: 'flex',
            alignItems: 'center',
            gap: 22 * U,
          }}
        >
          <Line U={U} />
          <span
            style={{
              fontFamily: SANS,
              fontSize: 25 * U,
              fontWeight: 400,
              letterSpacing: '0.56em',
              marginRight: '-0.56em',
              color: 'rgba(255,238,214,0.78)',
            }}
          >
            一个人的旅程
          </span>
          <Line U={U} flip />
        </div>

        {/* 主标题 */}
        <div
          style={{
            position: 'absolute',
            top: `${L.title * 100}%`,
            transform: 'translateY(-50%)',
            fontSize: 224 * U * L.titleScale,
            fontWeight: 500,
            letterSpacing: '0.16em',
            marginRight: '-0.16em',
            lineHeight: 1,
            background: 'linear-gradient(178deg, #FFFFFF 6%, #FFF3DC 44%, #FFD8A6 96%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(0 0 46px rgba(255,182,110,0.42)) drop-shadow(0 3px 10px rgba(4,8,18,0.45))',
          }}
        >
          人的一生
        </div>

        {/* 英文小标 */}
        <div
          style={{
            position: 'absolute',
            top: `${L.en * 100}%`,
            transform: 'translateY(-50%)',
            fontFamily: SANS,
            fontSize: 22 * U,
            fontWeight: 300,
            letterSpacing: '0.62em',
            marginRight: '-0.62em',
            color: 'rgba(255,236,206,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          A LIFE IN 35 SECONDS
        </div>

        {/* 副标 */}
        <div
          style={{
            position: 'absolute',
            top: `${L.sub * 100}%`,
            transform: 'translateY(-50%)',
            fontSize: 52 * U,
            fontWeight: 400,
            letterSpacing: '0.08em',
            color: '#FFF2DC',
            textShadow: '0 2px 22px rgba(6,10,22,0.55)',
            whiteSpace: 'nowrap',
          }}
        >
          35 秒，走过五个世界
        </div>

        {/* 标签行 */}
        <div
          style={{
            position: 'absolute',
            top: `${L.tag * 100}%`,
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 18 * U,
            fontFamily: SANS,
            fontSize: 28 * U,
            fontWeight: 400,
            letterSpacing: '0.18em',
            color: 'rgba(255,228,196,0.74)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>云海</span>
          <Dot U={U} />
          <span>沙丘</span>
          <Dot U={U} />
          <span>海边</span>
          <Dot U={U} />
          <span>雪原</span>
          <Dot U={U} />
          <span>星海</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Line: React.FC<{U: number; flip?: boolean}> = ({U, flip}) => (
  <div
    style={{
      width: 68 * U,
      height: 1.2 * U,
      background: flip
        ? 'linear-gradient(90deg, rgba(255,226,190,0.62), rgba(255,226,190,0))'
        : 'linear-gradient(90deg, rgba(255,226,190,0), rgba(255,226,190,0.62))',
    }}
  />
);

const Dot: React.FC<{U: number}> = ({U}) => (
  <div style={{width: 5 * U, height: 5 * U, borderRadius: 999, background: 'rgba(255,206,150,0.55)'}} />
);

export const Cover: React.FC = () => <CoverArt variant="wide" />;
export const CoverPortrait: React.FC = () => <CoverArt variant="tall" />;
