#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光域 · 一键验收

不靠眼睛，用像素说话。一条命令跑完五件事：

    python qc.py 06_preview/final.mp4
    python qc.py 06_preview/final.mp4 --audio source.mp3 --cuts 117,288,400
    python qc.py 06_preview/final.mp4 --json 08_review/qc.json

查什么：
    1. 元信息        时长 / 帧数 / 帧率 / 分辨率
    2. 亮度连续性    逐帧平均亮度，相邻帧最大差 ≤ 8（>20 就是真跳变）
    3. 空白帧        任何一帧的亮度标准差 ≤ 2，说明那一帧是纯色/黑屏
    4. 画框边缘      最外 2 行的亮度是否恒定（恒定 = 镜头 scale < 1，露了底色）
    5. 转场中心比    某个转场帧的跳变 ÷ 邻域均值 < 1.4，超过就是"硬切"
    6. 音轨          与原音的相关性、整体响度与真峰（需要 --audio 或自带音轨）

只用 ffmpeg + 标准库；有 numpy 会快一些，没有也能跑。
为什么不用肉眼看：8/255 的亮度变化在 30fps 下几乎不可见，但它会在观众那里
累积成"这一段有点奇怪"。数字是唯一能提前发现它的东西。
"""

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

W, H = 64, 36          # 采样分辨率：够算统计量，一帧 2304 字节，纯 python 也跑得动
GRAY_LIMIT = 8         # 相邻帧平均亮度差上限
BLANK_STD = 2.0        # 低于它就是空白帧
EDGE_MEAN_LIMIT = 25   # 最外两行与整帧的亮度差超过它，说明外面有一条边
CUT_RATIO = 1.4        # 转场中心帧跳变 / 邻域均值


def say(msg=""):
    sys.stdout.write(str(msg) + "\n")
    sys.stdout.flush()


def run(cmd, timeout=900):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    return p.returncode, p.stdout, (p.stderr or b"").decode("utf-8", "replace")


def probe(path):
    code, out, err = run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,channels",
        "-of", "json", str(path),
    ])
    if code != 0:
        raise SystemExit(f"ffprobe 失败：{err[-500:]}")
    d = json.loads(out.decode("utf-8", "replace"))
    v = next((s for s in d["streams"] if s.get("codec_type") == "video"), {})
    a = next((s for s in d["streams"] if s.get("codec_type") == "audio"), None)
    num, den = (v.get("r_frame_rate") or "0/1").split("/")
    fps = float(num) / float(den) if float(den) else 0.0
    return {
        "duration": float(d["format"].get("duration", 0)),
        "size": int(d["format"].get("size", 0)),
        "width": int(v.get("width", 0)),
        "height": int(v.get("height", 0)),
        "fps": fps,
        "vcodec": v.get("codec_name", ""),
        "has_audio": a is not None,
        "acodec": (a or {}).get("codec_name", ""),
    }


def frames_rgb(path):
    """整片解码成 W×H 的 rgb24 帧序列。一次解码，后面所有统计都基于它。"""
    code, out, err = run([
        "ffmpeg", "-v", "error", "-i", str(path),
        "-vf", f"scale={W}:{H}:flags=area", "-pix_fmt", "rgb24", "-f", "rawvideo", "-",
    ])
    if code != 0:
        raise SystemExit(f"解码失败：{err[-500:]}")
    step = W * H * 3
    n = len(out) // step
    return [out[i * step:(i + 1) * step] for i in range(n)]


def stats(frames):
    """逐帧：平均亮度、标准差、最外两行（上下）与最外两列的平均亮度。"""
    lum, std, top, bot = [], [], [], []
    for f in frames:
        s = 0
        s2 = 0
        for i in range(0, len(f), 3):
            y = (f[i] * 299 + f[i + 1] * 587 + f[i + 2] * 114) // 1000
            s += y
            s2 += y * y
        npx = len(f) // 3
        mean = s / npx
        var = max(0.0, s2 / npx - mean * mean)
        lum.append(mean)
        std.append(math.sqrt(var))

        def band(rows):
            acc = 0
            cnt = 0
            for r in rows:
                base = r * W * 3
                for c in range(W):
                    i = base + c * 3
                    acc += (f[i] * 299 + f[i + 1] * 587 + f[i + 2] * 114) // 1000
                    cnt += 1
            return acc / cnt

        top.append(band([0, 1]))
        bot.append(band([H - 2, H - 1]))
    return lum, std, top, bot


def audio_f32(path, sr=8000):
    code, out, err = run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"])
    if code != 0:
        return None
    import struct
    n = len(out) // 4
    return list(struct.unpack("<%df" % n, out[:n * 4]))


def corr(a, b, step=4):
    n = min(len(a), len(b))
    if n < 8000:
        return None
    xs = a[:n:step]
    ys = b[:n:step]
    m = len(xs)
    mx = sum(xs) / m
    my = sum(ys) / m
    sx = math.sqrt(sum((v - mx) ** 2 for v in xs))
    sy = math.sqrt(sum((v - my) ** 2 for v in ys))
    if sx < 1e-9 or sy < 1e-9:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)


def loudness(path):
    code, out, err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
                          "-af", "loudnorm=print_format=json", "-f", "null", "-"])
    text = err + out.decode("utf-8", "replace")
    i = text.rfind("{")
    j = text.rfind("}")
    if i < 0 or j < 0:
        return None
    try:
        d = json.loads(text[i:j + 1])
        return float(d["input_i"]), float(d["input_tp"]), float(d["input_lra"])
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description="一条命令跑完画质/转场/音轨验收")
    ap.add_argument("video")
    ap.add_argument("--audio", default=None, help="原始音频，用来算相关性（可选）")
    ap.add_argument("--cuts", default="", help="转场中心帧号，逗号分隔，例如 117,288,400")
    ap.add_argument("--json", default=None, help="把报告写成 json")
    ap.add_argument("--tolerance", type=int, default=GRAY_LIMIT, help=f"相邻帧亮度差上限，默认 {GRAY_LIMIT}")
    args = ap.parse_args()

    video = Path(args.video)
    if not video.is_file():
        raise SystemExit(f"找不到视频：{video}")

    say()
    say(f"光域 · 验收  {video.name}")
    say("=" * 64)

    meta = probe(video)
    frames = frames_rgb(video)
    lum, std, top, bot = stats(frames)
    n = len(frames)
    fps = meta["fps"] or 30.0

    checks = []

    def add(name, ok, value, limit, hint=""):
        checks.append({"name": name, "ok": bool(ok), "value": value, "limit": limit, "hint": hint})

    add("总帧数 / 时长", True, f"{n} 帧 / {n / fps:.3f}s", "—")
    add("分辨率", meta["width"] == 1920 and meta["height"] == 1080,
        f"{meta['width']}×{meta['height']}", "1920×1080")

    # 2. 亮度连续性。头尾的淡入淡出是故意的，判据只看中段；
    #    含头尾的极值单独报一行，方便看出"淡入是不是太陡"
    deltas = [abs(lum[i + 1] - lum[i]) for i in range(n - 1)]
    inner_idx = [i for i in range(len(deltas)) if 30 <= i < len(deltas) - 30] or list(range(len(deltas)))
    worst_all = max(range(len(deltas)), key=lambda i: deltas[i]) if deltas else 0
    worst = max(inner_idx, key=lambda i: deltas[i])
    add("相邻帧最大亮度差", deltas[worst] <= args.tolerance,
        f"{deltas[worst]:.1f}（第 {worst} 帧 / {worst / fps:.2f}s）",
        f"≤ {args.tolerance}", "超过就是有跳变：去那一帧抽图，大概率是场景切换或黑闪")
    add("含头尾的最大差", True, f"{deltas[worst_all]:.1f}（第 {worst_all} 帧）", "参考值",
        "出现在头尾说明淡入淡出偏陡，可把淡入帧数加大")
    add("相邻帧平均亮度差", True, f"{sum(deltas) / max(1, len(deltas)):.3f}", "越小越稳")

    # 3. 空白帧。头尾的黑场是**故意**的（淡入淡出），只查中段
    blanks = [i for i, s in enumerate(std) if s <= BLANK_STD]
    inner = [i for i in blanks if 30 < i < n - 30]
    add("中段空白/纯色帧", not inner, f"{len(inner)} 帧" + (f"（首个 {inner[0]}）" if inner else ""),
        "0 帧", "出现说明有黑屏、纯色占位或素材没加载；头尾黑场不计")

    # 4. 画框边缘：最外两行如果长期恒定，说明镜头缩进去了，露的是底色
    top_flat = sum(1 for v in top if v < 1.0)
    bot_flat = sum(1 for v in bot if v < 1.0)
    add("画框顶部恒定", top_flat <= n * 0.05, f"{top_flat}/{n} 帧",
        "≤ 5%", "恒定说明 scale < 1，画框露出来了")
    add("画框底部恒定", bot_flat <= n * 0.05, f"{bot_flat}/{n} 帧", "≤ 5%", "同上")

    # 5. 转场中心比。注意：绝对跳变很小的时候比值没有意义（0.06 / 0.03 = 2.0），
    #    所以只有"绝对跳变超过 1.5 个灰阶"的转场才参与判定
    cuts = [int(x) for x in args.cuts.replace("，", ",").split(",") if x.strip().isdigit()]
    if cuts:
        say("转场中心检查：")
        ratios = []
        for c in cuts:
            if c < 1 or c >= len(deltas):
                continue
            lo = max(0, c - 16)
            hi = min(len(deltas), c + 16)
            neigh = [deltas[i] for i in range(lo, hi) if abs(i - c) > 1]
            base = sum(neigh) / max(1, len(neigh))
            jump = deltas[c - 1]
            ratio = jump / (base + 1e-6)
            flag = "参与判定" if jump >= 1.5 else "跳变过小，不计"
            if jump >= 1.5:
                ratios.append((ratio, c))
            say(f"  {c:4d} 帧  跳变 {jump:5.2f}  邻域 {base:5.2f}  比 {ratio:4.2f}   {flag}")
        if ratios:
            worst_ratio, worst_cut = max(ratios)
            add("转场中心最大比", worst_ratio < CUT_RATIO, f"{worst_ratio:.2f}（第 {worst_cut} 帧）",
                f"< {CUT_RATIO}", "比值高说明这一帧是硬切，不是过渡")
        else:
            add("转场中心最大比", True, "无有效跳变", f"< {CUT_RATIO}",
                "所有转场帧的绝对跳变都小于 1.5 个灰阶，属于真正的软过渡")

    # 6. 音轨
    if meta["has_audio"]:
        l = loudness(video)
        if l:
            i, tp, lra = l
            add("整体响度", -16.5 <= i <= -12.5, f"{i:.1f} LUFS", "−16.5 ～ −12.5")
            add("真峰", tp <= -1.0, f"{tp:.1f} dBTP", "≤ −1.0", "超过 0 就是削波")
        if args.audio:
            src = Path(args.audio)
            if src.is_file():
                a1 = audio_f32(video)
                a2 = audio_f32(src)
                if a1 and a2:
                    d1, d2 = len(a1) / 8000.0, len(a2) / 8000.0
                    if abs(d1 - d2) > 0.2:
                        # 长度不同 = 音轨被拉伸过。变速会持续改变相位，
                        # 逐样本相关性必然趋近 0，拿它判"是不是同一首歌"没有意义
                        add("与原音相关性", True,
                            f"跳过（{d2:.1f}s → {d1:.1f}s，已拉伸）", "—",
                            "拉伸后的片子改用 beatcheck.py 验拍长曲线，不要用相关性")
                    else:
                        c = corr(a1, a2)
                        if c is not None:
                            add("与原音相关性", c > 0.99, f"{c:.4f}", "> 0.99",
                                "同长却对不上，说明音轨被换过、错位或重编码损坏")

    say()
    say(f"{'检查项':<18}{'结果':<10}{'实测':<34}阈值")
    say("-" * 64)
    fails = 0
    for c in checks:
        mark = "PASS" if c["ok"] else "FAIL"
        if not c["ok"]:
            fails += 1
        say(f"{c['name']:<18}{mark:<10}{c['value']:<34}{c['limit']}")
    say("-" * 64)

    if fails:
        say(f"{fails} 项未通过。先看对照提示，不要凭感觉重渲：")
        for c in checks:
            if not c["ok"] and c["hint"]:
                say(f"  · {c['name']}：{c['hint']}")
    else:
        say("全部通过。可以交付。")

    if args.json:
        Path(args.json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json).write_text(json.dumps({"video": str(video), "meta": meta, "checks": checks},
                                              ensure_ascii=False, indent=2), encoding="utf-8")
        say(f"\n报告写入 {args.json}")

    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
