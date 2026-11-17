#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光域 · 音频时长适配

把一段音乐铺到指定时长，并且**不把它拖坏**。

    python fit_audio.py --src song.mp3 --dur 35 --out bed.wav
    python fit_audio.py --src song.mp3 --dur 35 --out bed.wav --end-tempo 0.86 --shape ease
    python fit_audio.py --src song.mp3 --dur 35 --out bed.wav --dry-run

它做的事：
    1. 算拉伸比 r = 目标 / 源，按判据选策略（不是所有情况都该拉）
    2. r 在 1.06–1.40 之间时，用 librubberband + asendcmd 做**一条滤镜的连续变速**
    3. 曲线形状用线性摊平：片头稍慢、片尾略慢，前后差不超过 8 个点
    4. 精确校准长度（rubberband 有几十毫秒的内部延迟，不能信理论值）
    5. 加淡入淡出

为什么不用分段 atempo 拼接：WSOLA 每次调用重置相位，段边界两侧波形相位无关，
等功率交叉只把电平接平，实际是不同相位信号相加 = 梳状滤波，听感"空、薄、金属"。

依赖：ffmpeg，且必须带 rubberband 滤镜。缺了会明确告诉你怎么办。
"""

import argparse
import math
import os
import shutil
import subprocess
import sys

CMD_STEP = 0.2  # 每 0.2 秒推一条 tempo 命令


def say(msg=""):
    sys.stdout.write(str(msg) + "\n")
    sys.stdout.flush()


def run(cmd, cwd=None, timeout=600):
    p = subprocess.run(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def probe_duration(path):
    rc, out = run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]
    )
    if rc != 0:
        raise RuntimeError("ffprobe 读不到时长：\n" + out[:400])
    return float(out.strip())


def check_ffmpeg():
    if not shutil.which("ffmpeg"):
        say("找不到 ffmpeg。先跑：python scripts/install_tool.py ffmpeg")
        return False
    rc, out = run(["ffmpeg", "-hide_banner", "-filters"])
    if "rubberband" not in out:
        say("当前 ffmpeg 没有 rubberband 滤镜（多半是 essentials 精简版）。")
        say("需要的做法：python scripts/install_tool.py ffmpeg")
        return False
    return True


# ------------------------------------------------------------------
# 曲线与求解
# ------------------------------------------------------------------

def make_curve(a, e, p, T):
    """tempo(s) = a - (a - e) * (s/T)^p，s 是原曲时间轴"""
    return lambda s: a - (a - e) * math.pow(max(0.0, min(1.0, s / T)), p)


def out_len(a, e, p, T, n=20000):
    """∫ ds / tempo(s)，即输出时长"""
    ds = T / n
    tot = 0.0
    curve = make_curve(a, e, p, T)
    for i in range(n):
        s = (i + 0.5) * ds
        tot += ds / curve(s)
    return tot


def solve_a(e, p, T, target):
    """
    解片头倍率 a，使输出长度 = target。
    out_len 随 a 单调递减（a 越大 tempo 越大、输出越短），二分即可。
    """
    lo, hi = e, 2.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if out_len(mid, e, p, T) > target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def write_cmds(path, a, e, p, T, step=CMD_STEP):
    lines = []
    s = 0.0
    curve = make_curve(a, e, p, T)
    while s < T:
        lines.append("%.4f rubberband@rb tempo %.6f;" % (s, curve(s)))
        s += step
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(lines)


# ------------------------------------------------------------------
# 渲染
# ------------------------------------------------------------------

def render_varispeed(src, a, e, p, T, out_raw, cmds_name, workdir):
    fc = (
        "[0:a]atrim=0:%.6f,asetpts=N/SR/TB,"
        "asendcmd=f=%s,"
        "rubberband@rb=tempo=%.6f:transients=crisp:detector=compound:"
        "window=standard:formant=preserved[a]"
    ) % (T, cmds_name, a)
    rc, out = run(
        [
            "ffmpeg", "-v", "error", "-y",
            "-i", os.path.basename(src),
            "-filter_complex", fc,
            "-map", "[a]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le",
            os.path.basename(out_raw),
        ],
        cwd=workdir,
    )
    if rc != 0:
        raise RuntimeError("rubberband 渲染失败：\n" + out[:1200])


def render_uniform(src, tempo, out_raw):
    rc, out = run(
        [
            "ffmpeg", "-v", "error", "-y",
            "-i", src,
            "-af", "atempo=%.6f" % tempo,
            "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le",
            out_raw,
        ]
    )
    if rc != 0:
        raise RuntimeError("atempo 渲染失败：\n" + out[:1200])


def apply_fades(src, out, dur, fade_in, fade_out, gain_db):
    """淡入淡出 + 末段修整。不用 apad 硬切，长度由曲线控制。"""
    st_out = max(0.0, dur - fade_out - 0.10)
    af = "afade=t=in:st=0:d=%.3f,afade=t=out:st=%.3f:d=%.3f" % (fade_in, st_out, fade_out)
    if abs(gain_db) > 1e-6:
        af += ",volume=%.2fdB" % gain_db
    af += ",apad=whole_dur=%.4f,atrim=0:%.4f,asetpts=N/SR/TB" % (dur, dur)
    rc, msg = run(
        ["ffmpeg", "-v", "error", "-y", "-i", src, "-af", af,
         "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out]
    )
    if rc != 0:
        raise RuntimeError("淡入淡出处理失败：\n" + msg[:1200])


# ------------------------------------------------------------------
# 主流程
# ------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description="把音乐铺到指定时长，按「平缓下坡」的连续变速曲线，而不是把后面一段硬拉长。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
判据（脚本会自动判断并提示）：
  r = 目标/源
  0.80-0.94  匀速压缩
  0.94-1.06  匀速，6% 以内人耳分不出
  1.06-1.40  连续变速 + 曲线摊平  ← 本脚本的主场
  > 1.40     建议改结构：循环段落 / 补前奏尾奏 / 换曲
""",
    )
    ap.add_argument("--src", required=True, help="源音频（mp3/wav/m4a 都可以）")
    ap.add_argument("--dur", type=float, required=True, help="目标时长，秒")
    ap.add_argument("--out", required=True, help="输出 wav 路径")
    ap.add_argument("--end-tempo", type=float, default=0.84,
                    help="片尾倍率，默认 0.84（慢 16%%）。低于 0.80 会明显「拖」")
    ap.add_argument("--shape", choices=["linear", "ease"], default="linear",
                    help="linear=全程均匀下坡（推荐）；ease=减速集中在后段")
    ap.add_argument("--fade-in", type=float, default=0.42, help="淡入秒数")
    ap.add_argument("--fade-out", type=float, default=1.70, help="淡出秒数")
    ap.add_argument("--gain", type=float, default=0.0, help="线性增益 dB，例如 -2.5")
    ap.add_argument("--force", action="store_true", help="忽略拉伸比警告，强行处理")
    ap.add_argument("--dry-run", action="store_true", help="只算方案，不渲染")
    args = ap.parse_args()

    if not os.path.exists(args.src):
        say("找不到源文件：%s" % args.src)
        return 2
    if not check_ffmpeg():
        return 2

    T = probe_duration(args.src)
    r = args.dur / T
    say("")
    say("源 %.3fs -> 目标 %.3fs   拉伸比 r = %.4f" % (T, args.dur, r))
    say("-" * 60)

    # ---- 判据 ----
    if 0.94 <= r <= 1.06:
        tempo = T / args.dur
        say("r 在 6%% 以内，直接匀速。tempo = %.6f" % tempo)
        if args.dry_run:
            say("（dry-run，不渲染）")
            return 0
        render_uniform(args.src, tempo, args.out + ".raw.wav")
        apply_fades(args.out + ".raw.wav", args.out, args.dur, args.fade_in, args.fade_out, args.gain)
        os.remove(args.out + ".raw.wav")
        say("完成：%s" % args.out)
        return 0

    if r > 1.40 or r < 0.80:
        say("拉伸比超出舒适区（0.80–1.40）。硬拉会发虚发颤、听感「拖」。")
        say("更干净的做法：")
        say("  · 找一段可循环的 4/8 小节重复一次")
        say("  · 补前奏/尾奏（静音段 + 单音延音）")
        say("  · 换一首时长相符的")
        say("如果确实要拉，加 --force。")
        if not args.force:
            return 3
        say("--force 已指定，继续。")

    if r < 0.94:
        tempo = T / args.dur
        say("加速（压缩），匀速 tempo = %.6f" % tempo)
        if args.dry_run:
            say("（dry-run，不渲染）")
            return 0
        render_uniform(args.src, tempo, args.out + ".raw.wav")
        apply_fades(args.out + ".raw.wav", args.out, args.dur, args.fade_in, args.fade_out, args.gain)
        os.remove(args.out + ".raw.wav")
        say("完成：%s" % args.out)
        return 0

    # ---- 连续变速 ----
    e = args.end_tempo
    p = 1.0 if args.shape == "linear" else 2.0
    a = solve_a(e, p, T, args.dur)

    say("连续变速：tempo(s) = %.5f - %.5f * (s/%.3f)^%.1f" % (a, a - e, T, p))
    say("  片头 %.4f（慢 %.1f%%）" % (a, (1 - a) * 100))
    say("  片尾 %.4f（慢 %.1f%%）  前后差 %.1f 个点" % (e, (1 - e) * 100, (a - e) * 100))
    say("  理论输出 %.4fs" % out_len(a, e, p, T))

    if e < 0.80:
        say("  注意：片尾倍率 %.2f 低于 0.80，35 秒的片子里会听出「等它走完」。" % e)
    if (a - e) > 0.12:
        say("  注意：前后差 %.1f 个点偏大，建议 e 提到 0.84 以上、或用 linear。" % ((a - e) * 100))

    if args.dry_run:
        say("（dry-run，不渲染）")
        return 0

    here = os.path.dirname(os.path.abspath(args.out)) or "."
    out_raw = args.out + ".raw.wav"
    cmds_name = "tempo_cmds_%d.txt" % os.getpid()
    cmds_path = os.path.join(here, cmds_name)

    n = write_cmds(cmds_path, a, e, p, T)
    say("  命令 %d 条 -> %s" % (n, cmds_name))

    # 实测校准：rubberband 有内部延迟，理论值会差几十毫秒
    a_use = a
    dur_meas = 0.0
    for attempt in range(4):
        render_varispeed(args.src, a_use, e, p, T, out_raw, cmds_name, here)
        dur_meas = probe_duration(out_raw)
        say("  [校准 %d] a=%.5f  实测 %.4fs  (差 %+.4f)" % (attempt + 1, a_use, dur_meas, dur_meas - args.dur))
        if abs(dur_meas - args.dur) < 0.02:
            break
        # 用一次扰动估斜率，再线性修正
        a_probe = a_use - 0.01
        render_varispeed(args.src, a_probe, e, p, T, out_raw + ".p.wav", cmds_name, here)
        d_probe = probe_duration(out_raw + ".p.wav")
        slope = (d_probe - dur_meas) / (-0.01)
        if abs(slope) < 1e-6:
            break
        a_use = max(e + 0.005, min(1.9, a_use + (args.dur - dur_meas) / slope))

    # 最后一次用确认过的参数渲染
    render_varispeed(args.src, a_use, e, p, T, out_raw, cmds_name, here)
    dur_meas = probe_duration(out_raw)
    if abs(dur_meas - args.dur) > 0.02:
        say("  警告：最终长度 %.4fs 与目标差 %.4fs，淡入淡出会做末段修整" % (dur_meas, dur_meas - args.dur))

    apply_fades(out_raw, args.out, args.dur, args.fade_in, args.fade_out, args.gain)
    final = probe_duration(args.out)
    os.remove(out_raw)
    px = out_raw + ".p.wav"
    if os.path.exists(px):
        os.remove(px)
    try:
        os.remove(cmds_path)
    except OSError:
        pass

    say("")
    say("输出 %s  时长 %.4fs  a=%.5f  e=%.3f" % (args.out, final, a_use, e))
    say("速度映射（原曲 -> 输出）：")
    curve = make_curve(a_use, e, p, T)
    t_out = 0.0
    marks = [x * T / 6 for x in range(7)]
    mi = 0
    ds = T / 40000.0
    s = 0.0
    while s < T and mi < len(marks):
        while mi < len(marks) and s >= marks[mi]:
            say("  原曲 %6.2fs -> 输出 %6.2fs   tempo %.3f" % (marks[mi], t_out, curve(s)))
            mi += 1
        t_out += ds / curve(s)
        s += ds

    say("")
    say("下一步：python scripts/beatcheck.py %s   （确认前后拍长差 <= 60ms）" % args.out)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as ex:
        say("")
        say(str(ex))
        sys.exit(1)
    except KeyboardInterrupt:
        say("已取消")
        sys.exit(130)
