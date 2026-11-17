#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光域 · 打包分发

    python scripts/pack.py                 # → dist/guangyu-skill-v1.0.0.zip
    python scripts/pack.py --out D:/x.zip
    python scripts/pack.py --dry-run       # 只做检查，不打包

打包前先做三项**自包含检查**，任何一项不过就不出包 ——
因为这个包会离开当前电脑，去到别人的 skills 目录里：
    1. 有没有绝对路径（E:\\ / C:/Users / /home/ ...）
    2. 有没有 import 别的技能（skills/local、skills/vendor、../../）
    3. 必需文件在不在（SKILL.md / package-lock.json / code / src / scripts / references）

包里会多一份 MANIFEST.txt：文件清单 + 体积 + 版本。
想给人看"这个技能里有什么"，直接打开它，比口头说清楚。
"""

import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {"node_modules", "out", "dist", ".git", ".workbuddy", "__pycache__", ".remotion"}
SKIP_FILES = {".DS_Store", "Thumbs.db"}
TEXT_EXT = {".ts", ".tsx", ".js", ".jsx", ".py", ".md", ".json", ".txt", ".html", ".css", ".glsl", ".yml", ".yaml", ".example"}

REQUIRED = [
    "SKILL.md",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "remotion.config.ts",
    "code",
    "src",
    "scripts",
    "references",
    "example",
]

ABS_PATTERNS = [
    re.compile(r"[A-Za-z]:[\\/](?:AI|Users|Program|Service|Amireux|Windows)", re.I),
    re.compile(r"/(?:home|Users|mnt)/[A-Za-z0-9_.-]+/"),
    re.compile(r"file:///"),
]
IMP_PATTERNS = [
    re.compile(r"skills/(?:local|vendor)/"),
    re.compile(r"from\s+['\"]\.\./\.\./"),
]

# 允许的"系统路径探测"：这些是操作系统里的标准安装位置，不是本项目的路径。
# 技能要在任何一台机器上自动找到 Chrome / Edge，就必须把这些路径写出来 ——
# 它们是**候选列表**，找到哪个用哪个，不是硬编码依赖。
OS_PROBE = re.compile(
    r"(Google[/\\]Chrome|Microsoft[/\\]Edge|chrome\.exe|msedge\.exe"
    r"|/Applications/[\w ]*Chrome|/usr/bin/google-chrome|/usr/bin/chromium)",
    re.I,
)


def say(msg=""):
    sys.stdout.write(str(msg) + "\n")
    sys.stdout.flush()


def walk():
    for p in sorted(ROOT.rglob("*")):
        if p.is_dir():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.name in SKIP_FILES or p.suffix in {".pyc", ".log"}:
            continue
        yield p


def scan(files):
    """自包含检查。返回 (绝对路径命中, 跨技能 import 命中)。"""
    abs_hits, imp_hits = [], []
    for p in files:
        if p.suffix.lower() not in TEXT_EXT:
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        rel = p.relative_to(ROOT).as_posix()
        if rel == "scripts/pack.py":          # 本文件里的示例路径不算
            continue
        is_doc = p.suffix.lower() == ".md"
        for i, line in enumerate(text.splitlines(), 1):
            # 踩坑清单里举的例子形如 E:/xxx/...，属于说明文字，放行含 xxx 的行
            if "xxx" in line:
                continue
            # 浏览器候选路径 = 系统探测，不是对本机目录的依赖
            if OS_PROBE.search(line):
                continue
            for pat in ABS_PATTERNS:
                if pat.search(line):
                    abs_hits.append(f"{rel}:{i}  {line.strip()[:90]}")
                    break
            # 文档里出现 skills/local/xxx 是在说"把包放哪儿"，不是 import
            if is_doc:
                continue
            for pat in IMP_PATTERNS:
                if pat.search(line):
                    imp_hits.append(f"{rel}:{i}  {line.strip()[:90]}")
                    break
    return abs_hits, imp_hits


def main():
    ap = argparse.ArgumentParser(description="打包光域技能为可分发的 zip")
    ap.add_argument("--out", default=None, help="输出路径，默认 dist/guangyu-skill-v<版本>.zip")
    ap.add_argument("--dry-run", action="store_true", help="只检查，不写文件")
    args = ap.parse_args()

    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    version = pkg.get("version", "0.0.0")

    say()
    say(f"光域 · 打包  v{version}")
    say("=" * 62)

    missing = [r for r in REQUIRED if not (ROOT / r).exists()]
    say(f"[1/3] 必需文件    {'齐全' if not missing else '缺：' + ', '.join(missing)}")

    files = list(walk())
    abs_hits, imp_hits = scan(files)
    say(f"[2/3] 自包含检查  {'通过' if not (abs_hits or imp_hits) else '有问题'}")
    for h in abs_hits[:8]:
        say(f"        绝对路径  {h}")
    for h in imp_hits[:8]:
        say(f"        跨技能    {h}")

    total = sum(p.stat().st_size for p in files)
    say(f"[3/3] 体积        {len(files)} 个文件 / {total / 1024 / 1024:.1f} MB（不含 node_modules）")

    if missing or abs_hits or imp_hits:
        say()
        say("检查没过，不出包。修完再来。")
        sys.exit(1)

    if args.dry_run:
        say()
        say("dry-run：检查通过，未写文件。")
        return

    out = Path(args.out) if args.out else ROOT / "dist" / f"guangyu-skill-v{version}.zip"
    out.parent.mkdir(parents=True, exist_ok=True)

    manifest = [
        f"光域（guangyu）技能包 v{version}",
        f"文件 {len(files)} 个，解压后约 {total / 1024 / 1024:.1f} MB",
        "",
        "安装：",
        "  1) 解压到任意目录",
        "  2) python scripts/install.py      # 检测 → 装依赖 → 自检",
        "  3) npm start                      # 打开 Studio",
        "",
        "目录：",
        "  SKILL.md            入口：什么时候用、怎么做、验收清单",
        "  references/         七篇原理与判据（连续过渡 / 音频适配 / 人物 / 参数 / 踩坑 / 卡点 / 3D）",
        "  code/               Hero01 2D 人物、Relay01 接力、SkyLayer01 天空、Mist01 雾…",
        "  code/three/         Hero02 3D 旅人、World01 着色器世界、action01、shaders01",
        "  scripts/            check_env / install_tool / fit_audio / beatmap / beatcheck / qc / install / pack",
        "  src/                最小示例（2D 两段接力 / 3D 七段）",
        "  example/journey/    参考成片完整源码：35 秒五段地貌",
        "",
        "文件清单：",
    ]
    for p in files:
        rel = p.relative_to(ROOT).as_posix()
        manifest.append(f"  {p.stat().st_size:>9,}  {rel}")
    manifest_text = "\n".join(manifest) + "\n"

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            z.write(p, p.relative_to(ROOT).as_posix())
        z.writestr("MANIFEST.txt", manifest_text)

    h = hashlib.sha256(out.read_bytes()).hexdigest()
    say()
    say(f"写好了：{out}")
    say(f"  {out.stat().st_size / 1024 / 1024:.1f} MB   sha256 {h[:16]}…")
    say("  解压后先跑 python scripts/install.py，再 npm start。")


if __name__ == "__main__":
    main()
