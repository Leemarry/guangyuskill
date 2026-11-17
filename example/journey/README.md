# 参考成片（35 秒 · 五段地貌）

这个目录是那条 35 秒片子的**完整源码**，原样搬过来的，为的是一件事：

> 你拿到这个包，`npm run render` 渲出来的是同一条片子，不是"差不多的示例"。

```
Journey.tsx      全片编排：天空在最底、五段地貌倒序叠放、主角压在最上、雾带只在重叠区
config.ts        CFG：五段的时间与名字、天色关键帧、镜头曲线、字幕
lib/clock.ts     镜头曲线 + 主角六条曲线 + 步态相位积分
lib/sky.ts       五套色板 → 一条连续天色曲线
lib/util.ts      工具函数
components/      World(天空层) Hero(主角) Mist(雾) Figure(造型) Ridges/CloudField(地貌零件) Caption(字幕)
scenes/          CloudSea → Dunes → Seaside → Snowfield → StarSea
previews.tsx     P1–P5 单段预览：调一段只渲一段，不用等全片
```

## 它和 `code/` 是什么关系

| | `code/` | `example/journey/` |
| --- | --- | --- |
| 定位 | **库**：编号组件，供新片子组合 | **参考样品**：一条已经拍完的片子 |
| 命名 | `Hero01` / `Relay01` / `SkyLayer01`（按"可替换的整件"编号） | 原名 `Hero` / `World` / `Mist`（不编号，不参与复用） |
| 改不改 | 改它要谨慎，别人可能正在用 01 | 随便改，它就是给人拆开看的 |
| 关系 | 从它提取出来的 | 提取的源头 |

**要做新片子，从 `code/` 起手**，别直接改这里。这里留着，是因为
"看过整片怎么搭的"比"看一份最小示例"学得快，而且它是这套方法的证据。

## 移植时只动了两处

代码几乎是逐字复制的，唯一的改动是让它在 `strict: true` 下通过类型检查：

| 文件 | 改动 | 为什么 |
| --- | --- | --- |
| `lib/clock.ts` | `type K` → `export type K` | 下面那个文件要用这个元组类型 |
| `components/World.tsx` | `const K_HORIZON` 标注成 `K[]` | 不标注时被推成 `number[][]`，`kf()` 收不了 |

除此之外没有改一个像素的绘制逻辑。

## 怎么只看一段

```bash
npx remotion render P3Sea out/p3.mp4      # 海边那段，20 秒出片
```

`P1Cloud` / `P2Dune` / `P3Sea` / `P4Snow` / `P5Star` 五段都带着全局天空、镜头和主角，
`sec` 从本段起点算，所以预览里的天色和人物年龄与正片完全一致 ——
**不要**为了调一处草坡去渲全片。
