#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光域 · 音乐卡点表

把一首曲子分析成 Remotion 能直接用的数组：低频、总能量、起始点（onset）、
以及一串"值得打点"的时刻。需要 numpy。

    python beatmap.py song.mp3 --out beatmap.json
    python beatmap.py song.mp3 --out beatmap.json --stretch-to 35

为什么要自己算，不用现成的 BPM：
    这类片子的音乐往往不是节拍器，速度会变（比如被拉伸过），
    按 BPM 均分网格必然越走越偏。这里量的是**每一帧的能量**，
    画面跟着曲线走，不跟着"第几拍"走 —— 卡的是感觉，不是格子。

--stretch-to 解决的是"音频先被拉伸、再算卡点"的问题：
    拉伸后同一拍的时刻变了。用同一个 tempo 曲线把源时间映射到输出时间
    （t_out = ∫ ds / tempo(s)），events_out / *_out 就是拉伸后的时间轴，
    直接喂给 Remotion，不用手工挪。

依赖：ffmpeg（解码）、numpy（FFT）。缺 numpy 时明确提示安装命令。
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def say(msg=""):
    sys.stdout.write(str(msg) + "\n")
    sys.stdout.flush()


def need_numpy():
    try:
        import numpy as np
    except ImportError:
        say("需要 numpy（只用于本脚本的频谱分析）：")
        say("    python scripts/install_tool.py numpy")
        sys.exit(2)
    return np


def run(cmd, timeout=600):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or b"").decode("utf-8", "replace")[-800:])
    return p.stdout


def decode(path, sr=22050):
    """解成单声道 float32。用管道，不落临时文件。"""
    np = need_numpy()
    raw = run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"])
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64), sr


def ascii_bar(v, width=22):
    n = int(round(max(0.0, min(1.0, v)) * width))
    return "#" * n + "." * (width - n)


def analyse(y, sr, fps):
    np = need_numpy()
    hop = max(64, int(sr / 100))          # 10ms 一格，再按 fps 重采样
    win = 1024
    if len(y) < win:
        raise SystemExit("音频太短，至少 0.2 秒")

    # 分帧：用 stride tricks 省一次拷贝
    n = 1 + (len(y) - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    frames = y[idx] * np.hanning(win)[None, :]
    mag = np.abs(np.fft.rfft(frames, axis=1))          # (n, 513)
    freqs = np.fft.rfftfreq(win, 1 / sr)

    # 频谱通量：对数幅度沿**时间**方向的一阶正差分，再对频率求均值。
    # 用对数幅度而不是能量差：能量差对整体音量敏感，对"音头"不敏感。
    # 注意轴：mag 是 (时间, 频率)，所以 axis=0 才是时间
    d = np.diff(np.log1p(mag * 90), axis=0)
    flux = np.maximum(d, 0).mean(axis=1)          # 长度 n-1
    flux = np.r_[0.0, flux]                        # 补成 n，与 times 对齐

    bass = np.sqrt((mag[:, (freqs > 35) & (freqs < 160)] ** 2).mean(axis=1))
    energy = np.sqrt((mag ** 2).mean(axis=1))
    times = np.arange(n) * hop / sr

    def norm(v):
        return np.clip(v / (np.percentile(v, 97) + 1e-9), 0, 1)

    novelty = norm(flux)
    peak = norm(bass) * 0.55 + norm(energy) * 0.45

    # 输出网格：一帧一个值
    dur = len(y) / sr
    grid = np.arange(int(round(dur * fps))) / fps
    return {
        "duration": round(dur, 4),
        "fps": fps,
        "times": times,
        "bass": np.interp(grid, times, norm(bass)),
        "energy": np.interp(grid, times, norm(energy)),
        "onset": np.interp(grid, times, novelty),
        "peak": np.interp(grid, times, novelty * 0.6 + peak * 0.4),
        "grid": grid,
    }


def find_events(novelty_on_grid, fps, min_gap=0.22, floor=0.20):
    """在 already-resampled 的曲线上找局部峰。不假设等间隔节拍。"""
    np = need_numpy()
    v = novelty_on_grid
    w = max(1, int(round(min_gap * fps)))
    best = np.zeros_like(v)
    for k in range(1, w + 1):
        best = np.maximum(best, np.r_[np.zeros(k), v[:-k]])
        best = np.maximum(best, np.r_[v[k:], np.zeros(k)])
    is_peak = (v >= best) & (v > floor)
    events = []
    last = -1e9
    for i in np.nonzero(is_peak)[0]:
        t = i / fps
        if t - last < min_gap:
            continue
        events.append({"time": round(float(t), 4), "frame": int(i), "strength": round(float(v[i]), 3)})
        last = t
    return events


def stretch_math(e, p, src_dur, target, n=8000):
    """和 fit_audio.py 同一套曲线：tempo(s) = a + (e-a)(s/S)^p，解 a 使 ∫ds/tempo = target。

    这里用**数值积分**而不是解析式：p=2 时解析式要分 e>a / e<a 两种情况（atan / atanh），
    写错一个符号就会得到 NaN，而且没人看得出来。8000 格的梯形积分误差 < 1e-6，
    对"把 30.77 秒铺到 35 秒"这种精度完全够。
    """
    np = need_numpy()

    def build(a):
        g = np.linspace(0.0, src_dur, n)
        inv = 1.0 / (a + (e - a) * (g / src_dur) ** p)
        cum = np.concatenate([[0.0], np.cumsum((inv[1:] + inv[:-1]) * 0.5 * np.diff(g))])
        return lambda s: np.interp(s, g, cum)

    lo, hi = e, 2.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if build(mid)(src_dur) > target:
            lo = mid
        else:
            hi = mid
    a = (lo + hi) / 2
    return a, build(a)


def main():
    ap = argparse.ArgumentParser(
        description="音乐卡点表：频谱通量 + 低频/能量曲线，可按变速曲线重映射到拉伸后的时间轴",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="示例：\n  python beatmap.py song.mp3 --out beatmap.json\n  python beatmap.py song.mp3 --out beatmap.json --stretch-to 35 --end-tempo 0.84",
    )
    ap.add_argument("src", help="源音频（mp3/wav/m4a 均可）")
    ap.add_argument("--out", required=True, help="输出 json")
    ap.add_argument("--fps", type=int, default=30, help="视频帧率，默认 30")
    ap.add_argument("--stretch-to", type=float, default=None, help="把卡点映射到拉伸后的时长（秒）")
    ap.add_argument("--end-tempo", type=float, default=0.84, help="拉伸曲线的片尾倍率，默认 0.84")
    ap.add_argument("--shape", choices=["linear", "ease"], default="linear", help="曲线形状，默认 linear")
    ap.add_argument("--sr", type=int, default=22050, help="分析采样率，默认 22050")
    args = ap.parse_args()

    np = need_numpy()
    src = Path(args.src)
    if not src.is_file():
        raise SystemExit(f"找不到音频：{src}")

    say(f"分析 {src.name} …")
    y, sr = decode(src, args.sr)
    res = analyse(y, sr, args.fps)
    events = find_events(res["peak"], args.fps)

    out = {
        "src": src.name,
        "duration": res["duration"],
        "fps": args.fps,
        "analysis": "spectral flux transient peaks (STFT 1024 / 10ms hop), resampled to frame grid; not a metronomic beat grid",
        "events": events,
        "bass": [round(float(v), 4) for v in res["bass"]],
        "energy": [round(float(v), 4) for v in res["energy"]],
        "onset": [round(float(v), 4) for v in res["onset"]],
    }

    if args.stretch_to:
        p = 1 if args.shape == "linear" else 2
        e = args.end_tempo
        a, t_out = stretch_math(e, p, res["duration"], args.stretch_to)
        out["stretch"] = {
            "target": args.stretch_to,
            "end_tempo": e,
            "shape": args.shape,
            "a": round(a, 5),
            "p": p,
            "method": "t_out = ∫ ds / tempo(s), tempo(s) = a + (e-a)(s/S)^p",
        }
        out["events_out"] = [
            {"src_time": ev["time"], "time": round(t_out(ev["time"]), 4),
             "frame": int(round(t_out(ev["time"]) * args.fps)), "strength": ev["strength"]}
            for ev in events
        ]
        n_out = int(round(args.stretch_to * args.fps))
        src_grid = res["grid"]
        out_grid = np.array([t_out(t) for t in src_grid])
        for k in ("bass", "energy", "onset"):
            out[f"{k}_out"] = [
                round(float(v), 4)
                for v in np.interp(np.arange(n_out) / args.fps, out_grid, res[k])
            ]

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")

    # 屏幕上给一份能读的报告：哪几秒最值得打点
    say()
    say(f"时长 {res['duration']:.3f}s   帧率 {args.fps}   检出 {len(events)} 个起始点")
    say("-" * 58)
    top = sorted(events, key=lambda x: -x["strength"])[:12]
    for ev in sorted(top, key=lambda x: x["time"]):
        say(f"  {ev['time']:6.2f}s  帧 {ev['frame']:4d}  {ev['strength']:.2f}  {ascii_bar(ev['strength'])}")
    if args.stretch_to:
        st = out["stretch"]
        head = ", ".join("%.2fs" % ev["time"] for ev in out["events_out"][:5])
        say()
        say(f"已映射到 {st['target']}s：a={st['a']:.5f}  end={st['end_tempo']}  shape={st['shape']}")
        say(f"  前 5 个打点（输出时间轴）：{head}")
    say()
    say(f"写入 {args.out}")


if __name__ == "__main__":
    main()
