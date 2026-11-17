#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光域 · 环境检测

只读，不改任何东西。检查这个技能真正需要的四样东西，缺什么告诉你怎么装。

    python check_env.py            # 看报告
    python check_env.py --json     # 机器可读
    python check_env.py --fix      # 缺什么就直接进安装流程

设计原则：
  · 每一项都写清"为什么需要它"，而不是只报"找不到"
  · ffmpeg 单独检查 rubberband 滤镜 —— 这是唯一一个"装了但可能不能用"的依赖
  · 不自动安装任何东西，安装走 install_tool.py，需要你确认
"""

import json
import os
import platform
import re
import shutil
import subprocess
import sys

MIN_NODE = 18

# ---------------- 基础 ----------------

def run(cmd, timeout=15):
    """执行命令，返回 (returncode, 合并后的输出)"""
    try:
        p = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            universal_newlines=True,
            encoding="utf-8",
            errors="replace",
        )
        return p.returncode, p.stdout or ""
    except FileNotFoundError:
        return 127, "not found"
    except subprocess.TimeoutExpired:
        return 124, "timeout"
    except Exception as e:  # noqa: BLE001
        return 1, str(e)


def say(msg=""):
    sys.stdout.write(msg + "\n")
    sys.stdout.flush()


# ---------------- 四项检查 ----------------

def check_node():
    exe = shutil.which("node")
    if not exe:
        return dict(ok=False, version="未找到", note="Remotion 靠它跑", extra="")
    rc, out = run(["node", "-v"])
    ver = out.strip().lstrip("v")
    ok = False
    detail = ""
    try:
        major = int(ver.split(".")[0])
        ok = major >= MIN_NODE
        if not ok:
            detail = "版本过低，需要 >= %d" % MIN_NODE
    except Exception:  # noqa: BLE001
        detail = "版本号解析失败"
    return dict(ok=ok, version=ver or "?", note="Remotion 运行时", extra=detail)


def check_ffmpeg():
    exe = shutil.which("ffmpeg")
    if not exe:
        return dict(ok=False, version="未找到", note="音频变速 + 混流", extra="需要 full build")
    rc, ver_out = run(["ffmpeg", "-version"])
    m = re.search(r"ffmpeg version (\S+)", ver_out)
    ver = m.group(1) if m else "?"
    rc2, filt = run(["ffmpeg", "-hide_banner", "-filters"])
    has_rb = "rubberband" in filt
    extra = "" if has_rb else "没有 rubberband 滤镜 -> 需要 full build"
    return dict(ok=has_rb, version=ver, note="音频变速 + 混流", extra=extra, path=exe)


def check_browser():
    cands = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ]
    for c in cands:
        if os.path.exists(c):
            name = "Chrome" if "chrome" in c.lower() else "Edge" if "edge" in c.lower() else "Chromium"
            return dict(ok=True, version=name, note="无头渲染", extra="")
    for name in ("google-chrome", "chromium", "chromium-browser", "msedge"):
        if shutil.which(name):
            return dict(ok=True, version=name, note="无头渲染", extra="")
    return dict(ok=False, version="未找到", note="无头渲染", extra="Chrome 或 Edge 都行")


def check_numpy():
    rc, out = run([sys.executable, "-c", "import numpy;print(numpy.__version__)"])
    if rc == 0 and out.strip():
        return dict(ok=True, version=out.strip(), note="拍长分析（可选）", extra="")
    return dict(ok=False, version="未安装", note="拍长分析（可选）", extra="可选：没有它 beatcheck 会降级")


# ---------------- 报告 ----------------

CHECKERS = [
    ("Node.js", "node", check_node),
    ("ffmpeg", "ffmpeg", check_ffmpeg),
    ("浏览器", "chrome", check_browser),
    ("numpy", "numpy", check_numpy),
]

REQUIRED = {"Node.js", "ffmpeg", "浏览器"}


def main():
    as_json = "--json" in sys.argv
    want_fix = "--fix" in sys.argv

    results = {}
    for label, key, fn in CHECKERS:
        try:
            results[key] = fn()
        except Exception as e:  # noqa: BLE001
            results[key] = dict(ok=False, version="检测异常", note="", extra=str(e))
        results[key]["label"] = label

    missing = [k for k, v in results.items() if not v["ok"] and results[k]["label"] in REQUIRED]
    optional_missing = [k for k, v in results.items() if not v["ok"] and results[k]["label"] not in REQUIRED]

    if as_json:
        say(json.dumps(
            dict(
                platform=platform.system(),
                python=sys.version.split()[0],
                results=results,
                missing=missing,
                optional_missing=optional_missing,
            ),
            ensure_ascii=False,
            indent=2,
        ))
        return 0 if not missing else 1

    say("")
    say("光域 · 环境检测")
    say("=" * 58)
    say("%-10s %-8s %-26s %s" % ("项目", "状态", "版本", "用途 / 问题"))
    say("-" * 58)
    for key, v in results.items():
        flag = "OK  " if v["ok"] else ("MISS" if v["label"] in REQUIRED else "WARN")
        ver = str(v["version"])[:26]
        tail = v["note"] if not v["extra"] else "%s | %s" % (v["note"], v["extra"])
        say("%-10s %-8s %-26s %s" % (v["label"], flag, ver, tail))
    say("-" * 58)
    say("Python %s / %s" % (sys.version.split()[0], platform.system()))
    say("")

    if not missing and not optional_missing:
        say("全部就绪。可以直接跑 demo：")
        say("    npm i && npm start")
        return 0

    if missing:
        say("缺少 %d 项必需依赖。我可以帮你装，不需要你手动找下载页：" % len(missing))
        say("")
        for k in missing:
            say("    python install_tool.py %s" % k)
        say("")
        say("每一条都会先告诉你将要执行什么、链接是否可达，你确认之后才动手。")
        say("也可以一次看全部：python install_tool.py --list")

    if optional_missing:
        say("")
        say("可选项没装（不影响出片，只影响验证精度）：")
        for k in optional_missing:
            say("    python install_tool.py %s" % k)

    if want_fix and missing:
        say("")
        say("正在进入安装流程…")
        here = os.path.dirname(os.path.abspath(__file__))
        script = os.path.join(here, "install_tool.py")
        for k in missing:
            rc = subprocess.call([sys.executable, script, k])
            if rc != 0:
                say("安装 %s 未完成（返回 %d），可以稍后重试。" % (k, rc))
        say("")
        say("装完重新跑一次 python check_env.py 确认。")

    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())
