#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光域 · 一键安装

    python scripts/install.py                # 检测 → 装依赖 → 自检
    python scripts/install.py --check        # 只检测，不动任何东西
    python scripts/install.py --render-test  # 装完渲 30 帧，确认真的能出画面
    python scripts/install.py --into D:/skills/guangyu   # 顺手复制一份到别处

它按顺序做四件事，任何一步失败就停下来说清楚缺什么、怎么补：
    1. 外部依赖：node / npm / ffmpeg（须带 rubberband）/ 浏览器
    2. Python 依赖：numpy（只有卡点分析要用，缺了不影响出片）
    3. 项目依赖：npm install（有 package-lock，装的是锁定版本）
    4. 自检：tsc --noEmit；--render-test 时再渲 30 帧

为什么不写"一键脚本直接下载安装包"：
    每个人的 node/ffmpeg 安装方式不同（nvm、scoop、官网 msi、公司镜像），
    替用户决定安装路径，比让他自己装更容易坏。这里只负责**检测 + 说清命令**，
    你确认之后它才执行。
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


def say(msg=""):
    sys.stdout.write(str(msg) + "\n")
    sys.stdout.flush()


def step(n, text):
    say()
    say(f"[{n}/4] {text}")
    say("-" * 60)


def run(cmd, cwd=None, timeout=1800):
    say(f"  $ {' '.join(str(c) for c in cmd)}")
    p = subprocess.run(cmd, cwd=str(cwd or ROOT), timeout=timeout)
    return p.returncode


def npm_bin():
    for name in ("npm.cmd", "npm"):
        p = shutil.which(name)
        if p:
            return p
    return None


def node_bin():
    for name in ("node.exe", "node"):
        p = shutil.which(name)
        if p:
            return p
    return None


def check_external():
    """外部三件套。返回 (ok, 说明列表)。"""
    rows = []
    ok = True

    node = node_bin()
    if node:
        v = subprocess.run([node, "-v"], capture_output=True, text=True).stdout.strip()
        rows.append(("Node.js", True, v))
    else:
        rows.append(("Node.js", False, "未安装 → https://nodejs.org/ （≥18 LTS）"))
        ok = False

    npm = npm_bin()
    if npm:
        v = subprocess.run([npm, "-v"], capture_output=True, text=True, shell=False).stdout.strip()
        rows.append(("npm", True, v))
    else:
        rows.append(("npm", False, "随 Node.js 一起装，装完重开终端"))
        ok = False

    ff = shutil.which("ffmpeg")
    if ff:
        p = subprocess.run([ff, "-hide_banner", "-filters"], capture_output=True, text=True, errors="replace")
        has_rb = "rubberband" in p.stdout
        ver = subprocess.run([ff, "-version"], capture_output=True, text=True, errors="replace").stdout.split("\n")[0]
        rows.append(("ffmpeg", has_rb, ver[:58] + ("" if has_rb else "  ← 缺 rubberband，需 full build")))
        if not has_rb:
            ok = False
    else:
        rows.append(("ffmpeg", False, "未安装 → https://www.gyan.dev/ffmpeg/builds/ （full build）"))
        ok = False

    chrome = None
    for cand in (
        r"C:/Program Files/Google/Chrome/Application/chrome.exe",
        r"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        r"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        r"C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    ):
        if Path(cand).is_file():
            chrome = cand
            break
    rows.append(("浏览器", chrome is not None, chrome or "未找到 Chrome/Edge → 装一个即可"))
    if not chrome:
        ok = False

    say(f"  {'组件':<10}{'状态':<8}版本 / 说明")
    for name, good, note in rows:
        say(f"  {name:<10}{'OK' if good else 'MISS':<8}{note}")
    return ok


def check_python():
    try:
        import importlib

        np = importlib.import_module("numpy")
        say(f"  numpy {np.__version__}  OK（卡点分析可用）")
        return True
    except ImportError:
        say("  numpy 未安装 —— 只有 scripts/beatmap.py 需要它，缺了不影响出片")
        say("  需要就打点：python scripts/install_tool.py numpy")
        return True


def install_node_modules():
    if (ROOT / "node_modules").is_dir() and not args.force_npm:
        say("  node_modules 已存在，跳过（要重装加 --force-npm）")
        return True
    npm = npm_bin()
    if not npm:
        say("  没有 npm，先装 Node.js")
        return False
    code = run([npm, "install", "--no-audit", "--no-fund"], cwd=ROOT)
    if code != 0:
        say("  npm install 失败。常见原因：网络（换镜像 npm config set registry https://registry.npmmirror.com）、")
        say("  公司代理、或 node 版本过低（需要 ≥18）")
        return False
    return True


def typecheck():
    npm = npm_bin()
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not npx:
        say("  找不到 npx，跳过类型检查")
        return True
    say("  npx tsc --noEmit …")
    p = subprocess.run([npx, "tsc", "--noEmit"], cwd=str(ROOT), capture_output=True, text=True, errors="replace")
    if p.returncode != 0:
        say((p.stdout or p.stderr)[-1500:])
        say("  类型检查失败 —— 通常是有文件被改动过，或依赖没装全")
        return False
    say("  TypeScript 通过")
    return True


def render_test():
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not npx:
        return False
    out = ROOT / "out" / "install-check.mp4"
    out.parent.mkdir(exist_ok=True)
    say("  渲 30 帧验证整条链路（约 20 秒）…")
    code = run([npx, "remotion", "render", "Demo", str(out), "--frames", "0-29", "--log=error"], timeout=900)
    if code == 0 and out.is_file() and out.stat().st_size > 1000:
        say(f"  成功：{out.relative_to(ROOT)}（{out.stat().st_size // 1024} KB）")
        return True
    say("  渲染失败。先确认浏览器能被 Remotion 唤起：npx remotion browser ensure")
    return False


def copy_to(target: Path):
    if target.exists():
        say(f"  目标已存在：{target}（不覆盖，先自己挪走）")
        return False
    say(f"  复制到 {target} …")
    ignore = shutil.ignore_patterns("node_modules", "out", "dist", ".git", "*.log")
    shutil.copytree(ROOT, target, ignore=ignore)
    say("  已复制（不含 node_modules，到新位置再跑一次 install.py 即可）")
    return True


def main():
    global args
    ap = argparse.ArgumentParser(description="光域技能包：一键安装与自检")
    ap.add_argument("--check", action="store_true", help="只检测，不安装")
    ap.add_argument("--render-test", action="store_true", help="装完渲 30 帧确认能出画面")
    ap.add_argument("--into", default=None, help="复制一份到指定目录（例如别的项目的 skills/ 下）")
    ap.add_argument("--force-npm", action="store_true", help="即使 node_modules 存在也重装")
    args = ap.parse_args()

    say()
    say("光域 · 一键安装")
    say("=" * 60)

    step(1, "外部依赖")
    ext_ok = check_external()

    step(2, "Python 依赖")
    check_python()

    if not ext_ok:
        say()
        say("外部依赖没齐，先补齐再重跑。缺哪个装哪个：")
        say("  python scripts/install_tool.py --list     # 看所有可装的工具与官方地址")
        sys.exit(2)

    if args.check:
        say()
        say("检测完成（--check，不做任何安装）")
        return

    step(3, "项目依赖")
    if not install_node_modules():
        sys.exit(3)

    step(4, "自检")
    ok = typecheck()
    if args.render_test and ok:
        ok = render_test()

    if args.into:
        say()
        copy_to(Path(args.into))

    say()
    if ok:
        say("装好了。下一步：")
        say("  npm start        # 打开 Studio，直接看到人走过去、地貌接力")
        say("  npm run render   # 渲一条 35 秒成片到 out/demo.mp4")
        say("  python scripts/qc.py out/demo.mp4    # 验收")
    else:
        say("自检没通过，看上面标红的那一步。")
        sys.exit(4)


if __name__ == "__main__":
    main()
