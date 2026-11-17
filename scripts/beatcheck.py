#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光域 · 拍长验证

确认"拉伸之后的音乐是不是被拖坏了"。

    python beatcheck.py bed.wav
    python beatcheck.py bed.wav --expect 0.06        # 自定义容差（秒）
    python beatcheck.py a.wav b.wav                  # 对比两版

判据：
    起点拍长与终点拍长之差 <= 60ms        —— 超过就是"拖"
    相邻窗变化中位数接近 0               —— 偏离 0 说明有阶梯（分段拼接的典型特征）
    拍长范围不出现半拍/双拍跳变           —— 那是检测失败，不是音频问题

实现不依赖第三方库。装了 numpy 会自动用它（更快更准），没装就走纯 Python 路径，
用 ffmpeg 提取 10ms 能量包络后做自相关。
"""

import os
import shutil
import subprocess
import sys
import wave

TOL = 0.060          # 前后拍长差容差（秒）
LAG_LO, LAG_HI = 0.42, 0.90   # 拍长搜索范围（秒），对应 66–143 BPM


def say(msg=""):
    sys.stdout.write(str(msg) + "\n")
    sys.stdout.flush()


def run(cmd, timeout=180):
    p = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    return p.returncode, p.stdout, p.stderr


# ------------------------------------------------------------------
# 包络
# ------------------------------------------------------------------

def envelope_numpy(path):
    import numpy as np  # noqa: WPS433

    with wave.open(path, "rb") as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    y = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if ch == 2:
        y = y.reshape(-1, 2).mean(1)
    hop, win = 256, 1024
    frames = (len(y) - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(frames)[:, None]
    e = np.sqrt((y[idx] ** 2).mean(1))
    e = np.log(e + 1e-6)
    e = e - np.convolve(e, np.ones(41) / 41, mode="same")   # 去慢趋势
    return e.tolist(), sr / hop, "numpy"


def envelope_ffmpeg(path):
    """10ms 一帧的 RMS 包络。不需要 numpy。"""
    af = (
        "aresample=16000,aformat=channel_layouts=mono,asetnsamples=160,"
        "astats=metadata=1:reset=1,"
        "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-"
    )
    rc, out, err = run(["ffmpeg", "-v", "error", "-nostats", "-i", path, "-af", af, "-f", "null", "-"])
    if rc != 0:
        raise RuntimeError("ffmpeg 提取包络失败：\n" + (err or out)[:600])
    vals = []
    for line in out.splitlines():
        if "RMS_level=" in line:
            try:
                vals.append(float(line.split("=")[-1]))
            except ValueError:
                pass
    if len(vals) < 200:
        raise RuntimeError("包络点太少（%d），音频可能过短或被静音检测吞了" % len(vals))
    # 去慢趋势（减滑动均值）
    k = 41
    mean = []
    for i in range(len(vals)):
        a = max(0, i - k // 2)
        b = min(len(vals), i + k // 2 + 1)
        mean.append(sum(vals[a:b]) / (b - a))
    # RMS_level 是 dB，转回线性更接近能量，但差分已经足够
    env = [v - m for v, m in zip(vals, mean)]
    return env, 100.0, "ffmpeg"


# ------------------------------------------------------------------
# 自相关找拍长
# ------------------------------------------------------------------

def beat_series(env, fps, win_sec=1.6, step_sec=0.5):
    W = max(8, int(win_sec * fps))
    step = max(1, int(step_sec * fps))
    lag_lo = max(2, int(LAG_LO * fps))
    lag_hi = max(lag_lo + 2, int(LAG_HI * fps))
    n = len(env)
    out = []
    i = W
    while i < n - W:
        seg = env[i - W:i + W]
        m = sum(seg) / len(seg)
        seg = [v - m for v in seg]
        # 滞后 d 的自相关（只算 lag_lo..lag_hi）
        best_d, best_v = lag_lo, -2.0
        e0 = sum(v * v for v in seg) or 1e-9
        for d in range(lag_lo, min(lag_hi, len(seg) - 1)):
            acc = 0.0
            for j in range(len(seg) - d):
                acc += seg[j] * seg[j + d]
            v = acc / e0
            if v > best_v:
                best_v, best_d = v, d
        if best_v > 0.12:
            out.append((i / fps, best_d / fps, best_v))
        i += step
    return out


def summarize(series, expect_tol=TOL):
    pts = [p for p in series if p[0] > 0.4]
    if len(pts) < 6:
        return dict(ok=False, reason="有效窗口太少（%d）" % len(pts))
    beats = [p[1] for p in pts]
    times = [p[0] for p in pts]
    # 去掉首尾各 5% 再比较，避免淡入淡出段的检测噪声
    k = max(1, len(beats) // 20)
    core = beats[k:len(beats) - k] if len(beats) > 2 * k + 2 else beats
    b0, b1 = core[0], core[-1]
    span = max(core) - min(core)
    diffs = [core[i + 1] - core[i] for i in range(len(core) - 1)]
    diffs_sorted = sorted(diffs)
    med = diffs_sorted[len(diffs_sorted) // 2]
    return dict(
        ok=abs(b1 - b0) <= expect_tol,
        t0=times[0], t1=times[-1],
        b0=b0, b1=b1, delta=b1 - b0, span=span, med=med,
        bpm0=60.0 / b0, bpm1=60.0 / b1,
        n=len(pts),
    )


def report(path, tol=TOL):
    if not os.path.exists(path):
        say("找不到文件：%s" % path)
        return 1
    if not shutil.which("ffmpeg"):
        say("需要 ffmpeg。先跑：python scripts/install_tool.py ffmpeg")
        return 2

    try:
        import numpy  # noqa: F401
        env, fps, how = envelope_numpy(path)
    except Exception:  # noqa: BLE001
        env, fps, how = envelope_ffmpeg(path)

    series = beat_series(env, fps)
    s = summarize(series, tol)

    say("")
    say("%s" % path)
    say("-" * 58)
    say("包络方法 %s（%d 个有效窗口）" % (how, s.get("n", 0)))
    if not s.get("ok") and "reason" in s:
        say("无法判断：%s" % s["reason"])
        return 1

    say("%-10s %-10s %-10s" % ("时间", "拍长", "BPM"))
    picks = [0, len(series) // 4, len(series) // 2, 3 * len(series) // 4, len(series) - 1]
    for i in picks:
        t, b, c = series[max(0, min(i, len(series) - 1))]
        say("%7.1fs   %7.3fs   %7.1f" % (t, b, 60.0 / b))
    say("")
    say("起点拍长 %.3fs（%.1f BPM）" % (s["b0"], s["bpm0"]))
    say("终点拍长 %.3fs（%.1f BPM）" % (s["b1"], s["bpm1"]))
    say("前后差   %+.0fms   容差 %.0fms   %s" % (s["delta"] * 1000, tol * 1000, "通过" if s["ok"] else "不通过"))
    say("相邻窗变化中位 %+.1fms（接近 0 = 平滑，明显偏离 = 有阶梯）" % (s["med"] * 1000))
    say("拍长范围 %.3f-%.3fs" % (min(p[1] for p in series), max(p[1] for p in series)))
    if not s["ok"]:
        say("")
        say("不通过的含义：后面比前面慢太多，人耳会从「跟着走」变成「等它走完」。")
        say("改法见 references/02-音频适配.md —— 通常是提高 --end-tempo 或改用 --shape linear。")
    return 0 if s["ok"] else 4


def main():
    args = [a for a in sys.argv[1:]]
    tol = TOL
    files = []
    i = 0
    while i < len(args):
        if args[i] == "--expect":
            tol = float(args[i + 1])
            i += 2
            continue
        files.append(args[i])
        i += 1
    if not files:
        say(__doc__)
        return 1
    worst = 0
    for f in files:
        worst = max(worst, report(f, tol))
    return worst


if __name__ == "__main__":
    sys.exit(main())
