#!/usr/bin/env python3
"""Replace hardcoded forest text (#2C3E2D) with theme CSS variables for readable light + wine modes."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

TEXT_REPLACEMENTS: list[tuple[str, str]] = [
    ("text-[#2C3E2D]/80", "text-[var(--tx2)]"),
    ("text-[#2C3E2D]/75", "text-[var(--tx2)]"),
    ("text-[#2C3E2D]/72", "text-[var(--tx2)]"),
    ("text-[#2C3E2D]/70", "text-[var(--tx2)]"),
    ("text-[#2C3E2D]/65", "text-[var(--tx2)]"),
    ("text-[#2C3E2D]/60", "text-[var(--tx2)]"),
    ("text-[#2C3E2D]/55", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/50", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/45", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/40", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/35", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/30", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/25", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/20", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/15", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/12", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]/8", "text-[var(--tx3)]"),
    ("text-[#2C3E2D]", "text-[var(--tx)]"),
    ("hover:text-[#2C3E2D]/80", "hover:text-[var(--tx2)]"),
    ("hover:text-[#2C3E2D]/75", "hover:text-[var(--tx)]"),
    ("hover:text-[#2C3E2D]", "hover:text-[var(--tx)]"),
    ("dark:text-[#2C3E2D]", "dark:text-[var(--tx)]"),
]


def should_skip_path(path: Path) -> bool:
    try:
        rel = path.relative_to(SRC)
    except ValueError:
        return True
    parts = rel.parts
    if parts[:2] == ("app", "quote"):
        return True
    return False


def process_file(path: Path, dry: bool) -> bool:
    if path.suffix not in (".tsx", ".ts"):
        return False
    if path.name.endswith(".d.ts"):
        return False
    text = path.read_text(encoding="utf-8")
    orig = text
    for old, new in TEXT_REPLACEMENTS:
        text = text.replace(old, new)
    text = re.sub(
        r"text-\[var\(--tx\)\]\s+dark:text-\[var\(--tx2\)\]",
        "text-[var(--tx)]",
        text,
    )
    text = re.sub(
        r"text-\[var\(--tx\)\]\s+dark:text-\[var\(--tx\)\]",
        "text-[var(--tx)]",
        text,
    )
    if text == orig:
        return False
    if not dry:
        path.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    dry = "--dry" in sys.argv
    changed: list[Path] = []
    for path in sorted(SRC.rglob("*.tsx")):
        if should_skip_path(path):
            continue
        if process_file(path, dry):
            changed.append(path)
    for path in sorted(SRC.rglob("*.ts")):
        if should_skip_path(path):
            continue
        if process_file(path, dry):
            changed.append(path)
    print(f"{'Would update' if dry else 'Updated'} {len(changed)} files")
    for p in changed[:100]:
        print(p.relative_to(ROOT))
    if len(changed) > 100:
        print(f"... and {len(changed) - 100} more")


if __name__ == "__main__":
    main()
