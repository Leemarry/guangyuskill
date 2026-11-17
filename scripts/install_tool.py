#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光域 · 依赖安装引导

这个脚本**不会偷偷装东西**。流程固定为：
    1. 先检测（可能你已经有了）
    2. 告诉你缺什么、为什么需要它
    3. 先验证内置下载地址是否可达
    4. 把要执行的命令完整打出来，问你一句
    5. 你同意才执行
    6. 装完立刻验证，验证不过就明确告诉你手动步骤

用法：
    python install_tool.py --list
    python install_tool.py node
    python install_tool.py ffmpeg --dry-run
    python install_tool.py numpy --yes

如果内置链接全部失效，脚本会让你去搜关键词，而不是让你对着 404 猜。
"""

import os
import platform
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

# ------------------------------------------------------------------
# 工具表：地址与命令都写死在这里，改地址只改这一处
# ------------------------------------------------------------------

TOOLS = {
    "node": {
        "label": "Node.js",
        "why": "Remotion 的运行时。渲染和 Studio 都靠它，缺了什么都跑不起来。",
        "min": ">= 18",
        "installers": {
            "Windows": [
                "winget install --id OpenJS.NodeJS.LTS -e "
                "--accept-source-agreements --accept-package-agreements"
            ],
            "Darwin": ["brew install node"],
            "Linux": ["sudo apt-get update && sudo apt-get install -y nodejs npm"],
        },
        "download": "https://nodejs.org/en/download",
        "mirrors": ["https://nodejs.org/dist/", "https://github.com/nodejs/node/releases"],
        "search": "Node.js LTS 官方下载",
        "verify": (["node", "-v"], "版本号以 v 开头即成功"),
    },
    "ffmpeg": {
        "label": "ffmpeg（full build）",
        "why": (
            "音频连续变速与视频混流。必须是 full build —— essentials 精简版"
            "没有 rubberband 滤镜，装上去也用不了，这是本技能唯一一个"
            "\"看起来装了其实不能用\"的依赖。"
        ),
        "min": "任意较新版本，但必须含 rubberband",
        "installers": {
            "Windows": [
                "winget install --id Gyan.FFmpeg -e "
                "--accept-source-agreements --accept-package-agreements"
            ],
            "Darwin": ["brew install ffmpeg"],
            "Linux": ["sudo apt-get install -y ffmpeg"],
        },
        "download": "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z",
        "mirrors": [
            "https://www.gyan.dev/ffmpeg/builds/",
            "https://github.com/BtbN/FFmpeg-Builds/releases",
            "https://ffmpeg.org/download.html",
        ],
        "search": "ffmpeg full build gyan release full",
        "verify": (["ffmpeg", "-filters"], "输出里必须出现 rubberband 这一行"),
        "manual": [
            "1. 下载 ffmpeg-release-full.7z（注意是 full，不是 essentials）",
            "2. 解压到任意目录，记住这个目录（下面写作 <FFMPEG_DIR>）",
            "3. 把 <FFMPEG_DIR>/bin 加进系统 PATH",
            "4. 重开一个终端，跑 ffmpeg -filters | findstr rubberband 确认",
        ],
    },
    "chrome": {
        "label": "Chrome 或 Edge",
        "why": "Remotion 用它做无头渲染。Windows 一般自带 Edge，通常不需要装。",
        "min": "任意较新版本",
        "installers": {
            "Windows": [
                "winget install --id Google.Chrome -e "
                "--accept-source-agreements --accept-package-agreements"
            ],
            "Darwin": ["brew install --cask google-chrome"],
            "Linux": ["sudo apt-get install -y chromium-browser"],
        },
        "download": "https://www.google.com/chrome/",
        "mirrors": ["https://www.microsoft.com/edge"],
        "search": "Chrome 下载 或 Edge 下载",
        "verify": (None, "装完重跑 check_env.py 即可"),
    },
    "numpy": {
        "label": "numpy（可选）",
        "why": "只用于拍长分析。没有它 beatcheck.py 会自动降级成粗测，但精度差。",
        "min": "任意版本",
        "installers": {
            "Windows": ["%s -m pip install --upgrade numpy" % sys.executable],
            "Darwin": ["%s -m pip install --upgrade numpy" % sys.executable],
            "Linux": ["%s -m pip install --upgrade numpy" % sys.executable],
        },
        "download": "https://pypi.org/simple/numpy/",
        "mirrors": ["https://pypi.org/project/numpy/"],
        "search": "numpy pip install",
        "verify": ([sys.executable, "-c", "import numpy;print(numpy.__version__)"], "打印出版本号即成功"),
    },
}

REQUIRED = {"node", "ffmpeg", "chrome"}


def say(msg=""):
    sys.stdout.write(str(msg) + "\n")
    sys.stdout.flush()


def run(cmd, timeout=15, shell=False):
    try:
        p = subprocess.run(
            cmd,
            shell=shell,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            universal_newlines=True,
            encoding="utf-8",
            errors="replace",
        )
        return p.returncode, p.stdout or ""
    except Exception as e:  # noqa: BLE001
        return 1, str(e)


def url_ok(url, timeout=8):
    """HEAD 不通就退化成只取第一个字节的 GET。两者都失败才算不可达。"""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; guangyu-skill/1.0)"}
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers=headers)
            if method == "GET":
                req.add_header("Range", "bytes=0-0")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if 200 <= resp.status < 400:
                    return True
        except urllib.error.HTTPError as e:
            if 200 <= e.code < 400:
                return True
        except Exception:  # noqa: BLE001
            continue
    return False


# ------------------------------------------------------------------
# 探测：复用 check_env 的逻辑，缺了就返回 False
# ------------------------------------------------------------------

def probe(name):
    if name == "node":
        exe = shutil.which("node")
        if not exe:
            return False, "未找到"
        rc, out = run(["node", "-v"])
        ver = out.strip().lstrip("v")
        try:
            return int(ver.split(".")[0]) >= 18, ver
        except Exception:  # noqa: BLE001
            return False, ver or "?"

    if name == "ffmpeg":
        exe = shutil.which("ffmpeg")
        if not exe:
            return False, "未找到"
        rc, out = run(["ffmpeg", "-hide_banner", "-filters"])
        ok = "rubberband" in out
        rc2, v = run(["ffmpeg", "-version"])
        line = v.splitlines()[0] if v else "?"
        return ok, line[:60] + ("" if ok else "  （无 rubberband）")

    if name == "chrome":
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
                return True, os.path.basename(c)
        for n in ("google-chrome", "chromium", "chromium-browser", "msedge"):
            if shutil.which(n):
                return True, n
        return False, "未找到"

    if name == "numpy":
        rc, out = run([sys.executable, "-c", "import numpy;print(numpy.__version__)"])
        if rc == 0 and out.strip():
            return True, out.strip()
        return False, "未安装"

    return False, "?"


def ask(question):
    if not sys.stdin.isatty():
        say("（当前非交互环境，不会执行。要装的话在终端里跑一遍，或加 --yes）")
        return False
    try:
        ans = input(question + " [y/N] ").strip().lower()
    except EOFError:
        return False
    return ans in ("y", "yes", "是", "好")


def list_tools():
    say("")
    say("光域可以帮你装这些：")
    say("=" * 62)
    for name, t in TOOLS.items():
        ok, ver = probe(name)
        tag = "[已有]" if ok else ("[必需]" if name in REQUIRED else "[可选]")
        say("%-8s %-10s %s" % (name, tag, t["label"]))
        say("         %s" % t["why"])
        say("         当前：%s" % ver)
        if not ok:
            say("         安装：python install_tool.py %s" % name)
        say("")
    say("也可以直接：python install_tool.py --all")


def install(name, dry=False, assume_yes=False):
    t = TOOLS[name]
    ok, ver = probe(name)

    if ok:
        say("")
        say("已经装好了：%s（%s）" % (t["label"], ver))
        if name == "ffmpeg":
            say("并且带 rubberband，可以直接用。")
        return 0

    system = platform.system()
    cmds = t["installers"].get(system) or t["installers"].get("Linux")

    say("")
    say("你没有 %s，当前状态：%s" % (t["label"], ver))
    say("-" * 62)
    say("为什么需要它：")
    for line in t["why"].split("。"):
        if line.strip():
            say("  " + line.strip() + "。")
    say("")
    say("我可以帮你装。先确认下载地址还在：")

    urls = [t["download"]] + list(t.get("mirrors", []))
    reachable = []
    for u in urls:
        good = url_ok(u)
        say("  %s  %s" % ("可达  " if good else "不可达", u))
        if good:
            reachable.append(u)

    if not reachable:
        say("")
        say("内置地址全部不可达 —— 可能是断网，也可能地址已经变了。")
        say("我不会给你一个 404 让你自己猜。请搜索这个关键词找官方页：")
        say("")
        say("    %s" % t["search"])
        say("")
        say("找到之后把安装包放好，再回来跑 python check_env.py 验证。")
        return 3

    say("")
    say("计划执行的命令（%s）：" % system)
    for c in cmds or []:
        say("  " + c)
    if not cmds:
        say("  （这个平台没有自动安装器，请按下面的手动步骤来）")

    if dry:
        say("")
        say("--dry-run：只显示，不执行。")
        return 0

    say("")
    if not assume_yes and not ask("要按上面的命令装吗？"):
        say("好的，先不动。需要时再跑：python install_tool.py %s" % name)
        if t.get("manual"):
            say("")
            say("手动步骤（如果以后想自己装）：")
            for line in t["manual"]:
                say("  " + line)
        return 1

    say("")
    say("开始安装…")
    ok_all = True
    for c in cmds or []:
        say("> " + c)
        rc = subprocess.call(c, shell=True)
        if rc != 0:
            ok_all = False
            say("命令返回 %d" % rc)

    say("")
    say("验证：")
    ok2, ver2 = probe(name)
    if ok2:
        say("  成功：%s（%s）" % (t["label"], ver2))
        say("")
        say("下一步：python check_env.py 看整体是否就绪。")
        return 0

    say("  仍未通过（%s）" % ver2)
    if t.get("manual"):
        say("")
        say("手动步骤：")
        for line in t["manual"]:
            say("  " + line)
    say("")
    say("如果卡住，搜索关键词：%s" % t["search"])
    return 4


def main():
    argv = sys.argv[1:]
    flags = set(a for a in argv if a.startswith("-"))
    names = [a for a in argv if not a.startswith("-")]

    if "--list" in flags or (not names and "--all" not in flags):
        list_tools()
        return 0

    if "--all" in flags:
        targets = [n for n in TOOLS if not probe(n)[0]]
        if not targets:
            say("全部都装好了，不需要做什么。")
            return 0
        worst = 0
        for n in targets:
            worst = max(worst, install(n, dry="--dry-run" in flags, assume_yes="--yes" in flags))
        return worst

    name = names[0]
    if name not in TOOLS:
        say("没有这个工具：%s" % name)
        list_tools()
        return 2

    return install(name, dry="--dry-run" in flags, assume_yes="--yes" in flags)


if __name__ == "__main__":
    sys.exit(main())
