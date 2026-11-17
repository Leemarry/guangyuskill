# 光域（guangyu）

一条片子里穿过好几个世界，**没有一次"切换"**。天空一直在、镜头只有一台、人只有一个，
换的只是脚下的地貌 —— 走着走着，路就变了。

这是一套可以独立使用的制作方法 + 代码包：给你原理判据、可复用组件、可跑示例，
以及四个能自己判断对错的脚本。

## 三步跑起来

```bash
python scripts/install.py     # 检测 node / ffmpeg / 浏览器 → 装依赖 → 自检
npm start                     # 打开 Studio：Journey（参考成片）/ Demo / ThreeDemo
npm run render:journey        # 渲 35 秒参考成片到 out/journey-35s.mp4
npm run render                # 或渲最小示例（两段接力）
```

只想知道环境行不行，不改任何东西：`python scripts/install.py --check`

## 里面有什么

| 目录 | 内容 |
| --- | --- |
| `SKILL.md` | 入口：什么时候用、三条支柱、接力时序、音频判据、验收清单、八条硬约束 |
| `references/` | 7 篇：连续过渡 / 音频适配 / 人物组件 / 参数表 / 踩坑清单 / 音乐卡点 / 3D 与着色器 |
| `code/` | 2D 组件库：`Relay01` 接力容器、`Hero01` 人物、`SkyLayer01` 天空、`Mist01` 雾、`Stars01` 星光 |
| `code/three/` | 3D 组件库：`World01` 着色器世界、`Hero02` 旅人、`shaders01` 四个 GLSL、`action01` 轨迹 |
| `example/journey/` | **参考成片完整源码**：35 秒五段地貌，一个人从少年走到老人 |
| `src/` | 三个示例：`Demo`（2D 两段）、`ThreeDemo`（3D 七段）、`Cover`／`CoverPortrait`（封面） |
| `scripts/` | check_env / install / install_tool / fit_audio / beatcheck / beatmap / qc / pack |

## 四个脚本各管一件事

| 脚本 | 干什么 | 一条命令 |
| --- | --- | --- |
| `install.py` | 环境检测 → 装依赖 → 自检 | `python scripts/install.py` |
| `fit_audio.py` | 音乐比画面短时，连续变速拉长（不是拼接） | `python scripts/fit_audio.py --src song.mp3 --dur 35 --out bed.wav` |
| `beatmap.py` | 逐帧能量曲线 + 卡点，自动映射到拉伸后的时间轴 | `python scripts/beatmap.py song.mp3 --out beatmap.json --stretch-to 35` |
| `qc.py` | 验收：亮度跳变 / 空白帧 / 转场跳变比 / 画框边缘 / 音轨 / 响度 | `python scripts/qc.py out/demo.mp4` |
| `pack.py` | 打 zip 分发（排除 node_modules 与 out） | `python scripts/pack.py` |

`beatcheck.py` 是 `fit_audio.py` 的配套，用来量"拉完到底拖不拖"。

## 参考成片

`example/journey/` 是那条 35 秒片子的完整源码，原样搬过来的 —— 渲出来的就是同一条片子，
不是"差不多的示例"。要看完整怎么搭，读它的 `Journey.tsx`（156 行，全是编排）。

要做新片子，**从 `code/` 的编号组件起手**，不要直接改 `example/`：
`code/` 是库，`example/` 是样品。

## 编号约定

`Hero01` / `Figure01` / `Relay01` / `SkyLayer01` / `Mist01` / `Particles01` / `SkyParts01` /
`Stars01` / `pose01` / `sky01` / `config01` —— **按"可替换的整件"编号**。
要加第二种人物、第二种雾，就新建 `Hero02` / `Mist02`，不改 01：
已经在用 01 的片子不该因为别人加了变体而变样。

## 依赖

| 工具 | 要求 |
| --- | --- |
| Node.js | ≥ 18 |
| ffmpeg | **full build**（必须带 `rubberband` 滤镜；essentials 版没有） |
| Chrome 或 Edge | 任意较新版本，Remotion 用它无头渲染 |
| numpy | 可选，只有 `beatmap.py` 需要（缺了不影响出片） |

本技能不依赖任何其他技能包，代码与文档自包含。
