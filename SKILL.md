---
name: guangyu
description: 做"走着走着就换了世界"的连续过渡短片。天空/镜头/人物必须全片连续，地貌用接力而不是淡入淡出；含可复用人物组件（2D＋3D）、接力容器、音频时长适配、音乐卡点、一键安装与验收脚本。
---

# 光域

一条片子里要穿过好几个世界，但**不能有"切换"**。天空一直在、镜头只有一台、人只有一个，
换的只是脚下的地貌 —— 走着走着，路就变了。

这一套方法不限于某个题材：五个地貌可以是云海到星海，也可以是城市四季、产品四代、
一棵树的春夏秋冬。换的是内容，结构不动。

## 什么时候该用

| 情况 | 用不用 |
| --- | --- |
| 一段旅程要穿过 3 个以上场景，且必须"连续" | 用 |
| 同一个人物要跨段存在（长大、变老、换装） | 用 |
| 音乐比画面短，要拉长但不要"拖" | 用，见「音频比画面短」 |
| 画面要跟着音乐呼吸、但不能剪辑 | 用，见「音乐卡点」 |
| 单场景片子 | 不用，直接写 Remotion 组件 |
| 快切风格、真剪辑点、MV 式跳切 | 不用，这套方法是反快切的 |
| 音乐比画面长很多 | 裁，不要硬压 |

## 包里有什么

| 文档 | 一句话 |
| --- | --- |
| [01-连续过渡](references/01-连续过渡.md) | 为什么"闪"、62%/36% 时序、图层顺序、退场下沉、灰度验证法 |
| [02-音频适配](references/02-音频适配.md) | 拉伸比判据表、固定预算、片尾 ≥0.84、连续变速 |
| [03-人物组件](references/03-人物组件.md) | 造型四要点、参数表、六条曲线、步态相位、转身用 scaleX |
| [04-参数表](references/04-参数表.md) | 所有默认值与出处，含竖屏怎么处理 |
| [05-踩坑清单](references/05-踩坑清单.md) | 9 条：症状 → 根因 → 解法 → 怎么确认修好了 |
| [06-音乐卡点](references/06-音乐卡点.md) | 逐帧能量而非 BPM 网格、拉伸后必须重映射 |
| [07-3D与着色器](references/07-3D与着色器.md) | 2D/3D 怎么选、四个 GLSL、Remotion 里三个必要设置 |

## 三个支柱

"闪"从来不是遮罩的问题，而是**有三个东西在每段各写了一遍**。把它们提成全局层，
地貌怎么换都不会闪：

| 支柱 | 每段各写（会闪） | 全片一份（不闪） |
| --- | --- | --- |
| 天空 | 每段一套配色，叠化时在"融色" | 一条连续曲线，`sky01.ts` |
| 镜头 | 每段各一套 scale/x/y，段尾还各自缓推 | 一台机器，`pose01.ts` 的 `makeCamera` |
| 主角 | 每段画一个，x/身高/foot 对不上 | 一个人，`Hero01.tsx` + `pose01.ts` 的曲线表 |

天空占画面一半面积。它一变，观众判断就是"换了一张图"——这一条最容易被忽略，
也是最省事的一条：只要天色连续，地貌换得再糙都不像切。

## 两种做法：2D 接力 / 3D 着色器

同一套"连续"原则，两种成本结构。**先选对，再动手**：

| | 2D 接力（默认） | 3D（`code/three/`） |
| --- | --- | --- |
| 依赖 | 只要 Remotion | 另加 three / fiber / @remotion/three（约 40MB） |
| 单帧成本 | 0.12 s | 0.33 s（约 2.7 倍） |
| 换地貌 | **接力**，走过去就变了 | 默认按时间轴切场景；要连续就塞进 `Relay01` |
| 适合 | 长镜头、慢推，一段 5–8 秒 | 卡点、快节奏、要"看清空间转折" |

判断方法：需要观众看清地形怎么转折 → 3D；只需要"地面从脚下流过" → 2D。
示例工程里两个 composition 就是这两种：`Demo`（2D 两段接力）与 `ThreeDemo`（3D 七段）。
细节见 [references/07-3D与着色器.md](references/07-3D与着色器.md)。

## 地貌接力

不是"旧淡出新淡入"，是**新的一直在旧的下面等着被露出来**。

```
重叠期 1.8s（占总长 5%）
0%          36%        62%              96%   100%
|-----------|----------|----------------|-----|
新地貌  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   （前 62% 显影完，之后保持满）
旧地貌  ████████████████▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░   （36% 才开始退，96% 退完）
                  ↑ 两者同时"半可见"只有约 0.5s，正好在雾最浓处
```

三条硬规则：

1. **图层顺序**：后段先画（在下），前段后画（在上）。新地貌从一开始就实心，不从透明淡入 ——
   淡入会露底色，两张半透明叠一起会发暗。
2. **新先满、旧后退**：新地貌在重叠期前 62% 就显影完毕，旧的 36% 之后才动。
   这条在物理上也对：旧地貌上半幅本来是透明的，所以新的先在"远处"显出来，
   近处要等旧的退开 —— 远处先变、近处后变，就是大气透视。
3. **退场要下沉**：只改 opacity 是把整幅地貌等比擦掉，底色会透出来。
   加一个同方向的下沉（默认 70px），读作"地面从脚下退走"。

细节与参数见 [references/01-连续过渡.md](references/01-连续过渡.md)。

## 音频比画面短：怎么拉长

先算 `r = 目标时长 / 源时长`，再决定做法 —— 不是所有情况都该拉。

| r | 做法 | 理由 |
| --- | --- | --- |
| 1.00 – 1.06 | 单次匀速（`atempo` 一段到底） | 6% 以内人耳分不出，别折腾 |
| 1.06 – 1.40 | **连续变速 + 曲线摊平** | 见下 |
| > 1.40 | 别拉。循环段落 / 补前奏尾奏 / 换曲 | 拉 40% 以上必然发虚发颤 |

拉伸比在 1.06–1.40 之间时，有三条必须守：

1. **总拉伸是固定预算**。`∫ds/tempo = 目标时长` 改不了，所以"前面慢一点"和
   "后面不拖"是同一件事的两面 —— 片头倍率压下去，片尾倍率必然抬起来。
   想要"越走越慢"就必须接受"起点也不再是原速"。
2. **片尾倍率不低于 0.84**（慢 16%）。低于这个数，35 秒的片子里人耳会从
   "跟着它走"切换成"等它走完"。曲线形状用线性（`p=1`），不要 `p=2` 把减速堆在后 1/3。
3. **速度变化必须连续**。`rubberband` + `asendcmd` 每 0.2 秒推一条命令；
   禁止分段 `atempo` 拼接 —— WSOLA 每次调用重置相位，段边界两侧波形相位无关，
   等功率交叉只把电平接平，实际是两个不同相位信号相加 = 梳状滤波 = 听感"空、薄、金属"。

一条可测的判据：起点拍长与终点拍长之差 **≤ 60ms**。超过就是"拖"。

用法：

```bash
python scripts/fit_audio.py --src song.mp3 --dur 35 --out bed.wav
python scripts/beatcheck.py bed.wav          # 验证拍长曲线
```

详见 [references/02-音频适配.md](references/02-音频适配.md)。

## 音乐卡点：跟着曲线，不跟着格子

如果片子要"跟着音乐呼吸"，不要按 BPM 均分网格 —— 这类曲子的速度会变，
被拉伸过以后全错位。量**每一帧的能量**，让画面跟着曲线走：

```bash
python scripts/beatmap.py song.mp3 --out beatmap.json --stretch-to 35 --end-tempo 0.84
```

四条曲线各管一件事：`bass` 给冲击、`energy` 给亮度、`onset` 给动作起始、
`peak` 用来找"值得打点的时刻"。组件里逐帧查表：

```tsx
const beat = bm.bass_out[frame] ?? 0;   // 不要用 Math.sin(t*…) 造假节拍
const push = 1 + 0.02 * beat;            // 幅度 2% 就够，5% 就俗
```

`--stretch-to` 是必须的：音频被拉伸后每一拍的位置都变了，用**同一条 tempo 曲线**
把源时间映射到输出时间（`t_out = ∫ds/tempo`）。`beatmap.py` 与 `fit_audio.py`
算出的 `a` 必须一致（本项目都是 `0.91961`），对不上就说明两条曲线不是同一条。

细节见 [references/06-音乐卡点.md](references/06-音乐卡点.md)。

## 人物：一个标准代码块

`code/Figure01.tsx` 是纯造型（斗篷 + 两段腿 + 持物手 + 头顶烛光），
`code/pose01.ts` 是六条曲线，`code/Hero01.tsx` 把两者接起来。

```tsx
const rig = makeHero(EXAMPLE_CURVES, {duration: 35, events: EXAMPLE_EVENTS});
<Hero01Walk sec={sec} rig={rig} />
```

**编号约定**：按"可替换的整件"编号 —— `Hero01` / `SkyLayer01` / `Mist01` / `Relay01` /
`Particles01` / `Figure01` / `pose01` / `sky01` / `config01`。
以后要加第二种人物、第二种雾、第二种天空，就新建 `Hero02` / `Mist02` / `SkyLayer02`，
**不改 01** —— 已经在用 01 的片子不应该因为别人加了变体而变样。
`util.ts` 不编号：它是纯工具函数，不属于任何"一套做法"。

造型的四个关键（少一个就变成"一根药丸"）：
头比斗篷窄并留出颈部、斗篷是 A 形、头顶一盏烛光、腿是"髋→膝→脚"两段折线。

参数与曲线含义见 [references/03-人物组件.md](references/03-人物组件.md)。

## 依赖与环境

本技能**不依赖任何其他技能包**，代码与文档自包含。只需要三个外部工具：

| 工具 | 要求 | 为什么 |
| --- | --- | --- |
| Node.js | ≥ 18 | 跑 Remotion |
| ffmpeg | **full build**，必须带 `rubberband` 滤镜 | 音频连续变速。essentials / 精简版没有这个滤镜 |
| Chrome 或 Edge | 任意较新版本 | Remotion 用它做无头渲染 |

先检测：

```bash
python scripts/check_env.py
```

### 一条命令装完

拿到分发包（zip 解开或目录复制）后，一条命令做完所有事：

```bash
python scripts/install.py                 # 检测环境 → npm i → 自检
python scripts/install.py --render-test   # 再渲 30 帧，确认真的能出画面
python scripts/install.py --check         # 只看环境，不改任何东西
python scripts/install.py --into ../其他项目/skills/guangyu   # 顺带复制一份过去
```

它做三件事：缺什么工具就**打印出安装命令**（不会静默失败）、`npm i` 装依赖、
最后跑一遍自检。**没有网络也能看到清楚缺什么**，而不是对着一个报错猜。

缺单个工具时（会让你确认，不会静默执行）：

```bash
python scripts/install_tool.py node        # 或 ffmpeg / chrome / python / numpy
python scripts/install_tool.py --list      # 看有哪些可装
```

`install_tool.py` 内置了各工具的官方下载地址；执行前会先检查链接是否可达，
不可达会明确告诉你"链接失效，需要联网搜索"，而不是让你对着一个 404 猜。

### 分发

```bash
python scripts/pack.py                    # 打 zip 到 dist/，自动排除 node_modules 与 out
python scripts/pack.py --dry-run          # 只看会打进去哪些文件
```

别人拿到 zip：解压 → `python scripts/install.py` → `npm start`。

## 十分钟上手

```bash
cd skills/local/guangyu     # 或你放这个技能的位置
npm i                       # 首次 2–4 分钟，会下载 Remotion 的渲染器
npm start                   # Studio 里选：Journey（参考成片）/ Demo / ThreeDemo
npm run render:journey      # 渲 35 秒参考成片 → out/journey-35s.mp4（约 2 分钟）
npm run render              # 渲最小示例（两段接力）
npm run render:3d           # 渲 3D 示例
npx remotion render P3Sea out/p3.mp4   # 只渲"海边"那一段，20 秒出片
```

工程根就在技能目录：`package.json` 与 `node_modules` 都在这一层，
`code/` 是组件库、`src/` 是示例入口、`example/journey/` 是参考成片源码，
三处共用一份依赖，不会出现两个 node_modules。

**参考成片 `example/journey/` 就是这套方法拍出来的那条片子**（五段地貌、
一个人从少年走到老人）。要看"完整怎么搭"，读它的 `Journey.tsx`（156 行，全是编排）；
要用到自己的片子里，从 `code/` 的编号组件起手。

跑通之后改三张表就够：

1. `code/config01.example.ts` 的 `SCENES` —— 几段、多长、什么内容
2. 同文件的 `SKY_KEYS` —— 天色的关键帧
3. `code/pose01.ts` 的 `EXAMPLE_CURVES` —— 人物怎么变

## 文件地图

| 文件 | 干什么 |
| --- | --- |
| `code/Relay01.tsx` | **核心**。地貌接力容器 |
| `code/sky01.ts` | 天色曲线工厂：多套调色板 → 一条连续曲线 |
| `code/SkyLayer01.tsx` | 天空层：太阳/极光/银河/星点/地平光 |
| `code/pose01.ts` | 镜头曲线 + 主角六条曲线 + 步态相位 |
| `code/Hero01.tsx` | 人物 01：驱动 + 摆位（SVG） |
| `code/Figure01.tsx` | 造型基座（斗篷小人本体 + 鸟/风筝/飞艇道具） |
| `code/Mist01.tsx` | 雾带：转场真正发生的地方 |
| `code/SkyParts01.tsx` `code/Particles01.tsx` `code/util.ts` | 渐变元件、粒子、工具函数 |
| `code/Stars01.tsx` | 星光：一颗一颗亮起来（DOM 实现，不用 canvas） |
| `code/config01.example.ts` | 五套天色 + 时间轴样板 |
| `code/three/World01.tsx` | 3D 世界：七套色板 + 天空/海/山/云/岛/船/火/彩虹 |
| `code/three/Hero02.tsx` | 人物 02：3D 旅人（袍身 + 逐顶点斗篷 + 蝴蝶/蒲公英/风筝） |
| `code/three/shaders01.ts` | 四个 GLSL：天空、海面、点精灵、水母 |
| `code/three/action01.ts` | 旅人轨迹 + 地形高度 + 镜头位姿曲线表 |
| `scripts/check_env.py` | 依赖检测 |
| `scripts/install.py` | **一键安装**：检测 → npm i → 自检 |
| `scripts/install_tool.py` | 单个工具引导安装（带链接自检） |
| `scripts/fit_audio.py` | 音频时长适配（连续变速） |
| `scripts/beatcheck.py` | 拍长验证 |
| `scripts/beatmap.py` | 音乐卡点表 + 拉伸后时间轴重映射 |
| `scripts/qc.py` | **一键验收**：亮度/空白帧/转场/边缘/音轨/响度 |
| `scripts/pack.py` | 打包分发（排除 node_modules 与 out） |
| `src/Demo.tsx` | 可运行的 2D 两段接力示例 |
| `src/ThreeDemo.tsx` | 可运行的 3D 七段示例 |
| `src/Cover.tsx` | 封面构图：`Cover`（16:9）/ `CoverPortrait`（3:4），人物全用 `Figure01` |
| `example/journey/` | **参考成片**：35 秒五段完整源码，`npm run render:journey` 渲出同一条片子 |
| `package.json` `remotion.config.ts` | 工程根：依赖与渲染入口 |

## 验收清单

交付前逐条过，别凭"看着还行"。大部分条目 `qc.py` 能直接判：

```bash
python scripts/qc.py out/demo.mp4
python scripts/qc.py 成片.mp4 --audio 原曲.mp3 --cuts 153,333,543,753
```

- [ ] 逐帧测整帧灰度，**相邻帧最大差 ≤ 8**（超过就是有跳变）。示例片 1050 帧实测 **1.9**、均值 0.149
- [ ] 采样画面最外圈像素（第 0/1/4 行），**不能出现纯底色**（出现说明 scale < 1）
- [ ] 转场中心帧的跳变不超过邻域的 **4 倍**（超过就是硬切，不是过渡）
- [ ] 无空白/纯色帧（有就是素材没加载或黑屏）
- [ ] 音频起点与终点拍长差 **≤ 60ms**
- [ ] 换音轨时视频包 md5 必须与无音轨版**完全一致**（证明画面没重编码）
- [ ] 响度 −14 LUFS 附近、真峰 ≤ −1.5 dBTP

> 提示：`ThreeDemo` 是按 `cuts` 硬切的卡点版，`qc.py` 会判它 **FAIL**（实测最大跳变 126.6）。
> 那是 qc 判对了 —— 它不满足"连续"，只适合卡点风格。要 3D 又连续，见
> [references/07-3D与着色器.md](references/07-3D与着色器.md) 第八节。

## 八条硬约束

1. **不用 flash / 全屏白闪做转场** —— 那读作"闪一下换了张图"。
2. **镜头 scale 不跌破 1** —— 跌破就露出画框边，且地貌会在画面内侧断开、露出天。
3. **不用分段 atempo 拼接** —— 梳状滤波，听感空薄金属。
4. **片尾倍率不低于 0.84** —— 低于这个数就是"拖"。
5. **转身用外层 `scaleX 1→0→−1`，不改 `dir`** —— `dir` 参与逐点几何，只能取 ±1。
6. **步态相位用 `∫cadence dt`，不用 `t×cadence`** —— 减速段会倒着抽腿。
7. **卡点用逐帧能量表，不用 `sin(t)` 造假节拍** —— 假节拍和音乐无关，观众立刻出戏。
8. **3D 里 `dpr=1` + `preserveDrawingBuffer: true`** —— 不设前者慢 4 倍，不设后者抽到黑帧。

前因后果见 [references/05-踩坑清单.md](references/05-踩坑清单.md)。
