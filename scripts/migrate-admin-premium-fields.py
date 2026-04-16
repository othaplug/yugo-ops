#!/usr/bin/env python3
"""One-off: replace boxed admin field class strings with admin-premium-* utilities. See globals.css."""

from __future__ import annotations

import pathlib

REPO = pathlib.Path(__file__).resolve().parents[1]
ROOT = REPO / "src" / "app" / "admin"

# (old_className_substring, new_classes) — longest first
FIELD_REPLACEMENTS: list[tuple[str, str]] = [
    (
        "w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input flex-1",
    ),
    (
        "w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none resize-none",
        "admin-premium-textarea w-full resize-none",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none focus:border-[var(--gold)]",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] font-mono focus:border-[var(--gold)] outline-none",
        "admin-premium-input w-full font-mono",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)]/60 rounded-xl text-[13px] text-[var(--tx)] outline-none focus:border-[var(--gold)]/50",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 text-[13px] font-semibold bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)]",
        "admin-premium-input w-full font-semibold",
    ),
    (
        "w-full px-3 py-2 text-[12px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)]",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 text-[12px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)]",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 text-[11px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)] resize-none placeholder:text-[var(--tx3)]",
        "admin-premium-textarea w-full resize-none",
    ),
    (
        "w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none mb-4",
        "admin-premium-input w-full mb-4",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none min-h-[40px] touch-manipulation",
        "admin-premium-input w-full min-h-[40px] touch-manipulation",
    ),
    (
        "mt-0.5 w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2 py-1.5 text-[12px] text-[var(--tx)]",
        "mt-0.5 admin-premium-input w-full",
    ),
    (
        "mt-0.5 w-full bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]",
        "mt-0.5 admin-premium-input w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none transition-colors",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none transition-colors",
        "admin-premium-input w-full",
    ),
    (
        "w-full pl-5 pr-2 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)] transition-colors",
        "admin-premium-input admin-premium-input--leading admin-premium-input--compact w-full",
    ),
    (
        "w-full pl-5 pr-2 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] outline-none focus:border-[var(--gold)] transition-colors",
        "admin-premium-input admin-premium-input--leading admin-premium-input--compact w-full",
    ),
    (
        "w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)]",
        "admin-premium-input w-full",
    ),
    (
        "flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none",
        "admin-premium-input flex-1",
    ),
    (
        "flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] font-mono text-[var(--tx)] placeholder:text-[var(--tx2)] focus:border-[var(--gold)] outline-none",
        "admin-premium-input flex-1 font-mono",
    ),
    (
        "flex-1 px-2.5 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] outline-none focus:border-[var(--gold)] transition-colors",
        "admin-premium-input admin-premium-input--compact flex-1",
    ),
    (
        "flex-1 px-2.5 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)] transition-colors",
        "admin-premium-input admin-premium-input--compact flex-1",
    ),
    (
        "w-full px-4 py-2.5 pr-10 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input admin-premium-input--trailing w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] outline-none resize-none focus:border-amber-500/50 transition-colors",
        "admin-premium-textarea w-full resize-none",
    ),
    (
        "w-full sm:max-w-xs px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none focus:border-[var(--gold)]",
        "admin-premium-input w-full sm:max-w-xs",
    ),
    (
        "w-full sm:max-w-xl px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full sm:max-w-xl",
    ),
    (
        "w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] font-mono text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full font-mono",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] text-[var(--tx)] font-mono focus:border-[var(--brd)] outline-none resize-y",
        "admin-premium-textarea w-full font-mono resize-y",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--brd)]/50",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] text-[var(--tx)] outline-none focus:border-[var(--brd)]/50",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 text-[11px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)]",
        "admin-premium-input w-full",
    ),
    (
        "w-full px-3 py-2 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)]/50",
        "admin-premium-input w-full",
    ),
    (
        "w-full min-w-[120px] text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full min-w-[120px] admin-premium-input--compact",
    ),
    (
        "w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none resize-y",
        "admin-premium-textarea w-full resize-y",
    ),
    (
        "w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none resize-none",
        "admin-premium-textarea w-full resize-none",
    ),
    (
        "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none",
        "admin-premium-input w-full",
    ),
    (
        "w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5",
        "admin-premium-input w-full",
    ),
    (
        "w-full max-w-[200px] text-[12px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none",
        "admin-premium-input w-full max-w-[200px]",
    ),
    (
        "w-full text-[12px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] resize-none",
        "admin-premium-textarea w-full resize-none",
    ),
    (
        "w-full bg-[var(--bg2)] border border-[var(--brd)] rounded px-2 py-1.5 text-[11px] font-mono text-[var(--tx)] outline-none focus:border-[var(--gold)] resize-none",
        "admin-premium-textarea w-full font-mono resize-none text-[11px]",
    ),
    (
        "flex-1 min-w-[120px] px-2 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none",
        "admin-premium-input flex-1 min-w-[120px]",
    ),
    (
        "flex-1 px-2 py-1 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded outline-none text-[var(--tx)]",
        "admin-premium-input admin-premium-input--compact flex-1",
    ),
    (
        "flex-1 px-3 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none",
        "admin-premium-input flex-1",
    ),
    (
        "w-full px-3 py-2 text-[11px] font-mono bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx3)]",
        "admin-premium-input w-full font-mono text-[var(--tx3)] admin-premium-input--compact",
    ),
    (
        "w-full text-[13px] bg-[var(--bg)]/50 border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx2)]",
        "admin-premium-input w-full text-[var(--tx2)]",
    ),
]

LABEL_REPLACEMENTS: list[tuple[str, str]] = [
    (
        "block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2",
        "admin-premium-label",
    ),
    (
        "block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5",
        "admin-premium-label admin-premium-label--tight",
    ),
    (
        "block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5",
        "admin-premium-label admin-premium-label--tight",
    ),
    (
        "block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1",
        "admin-premium-label admin-premium-label--tight mb-1",
    ),
]

FIELD_REPLACEMENTS.sort(key=lambda x: len(x[0]), reverse=True)
LABEL_REPLACEMENTS.sort(key=lambda x: len(x[0]), reverse=True)


def main() -> None:
    total = 0
    for path in sorted(ROOT.rglob("*.tsx")):
        text = path.read_text(encoding="utf-8")
        orig = text
        for old, new in FIELD_REPLACEMENTS:
            if old in text:
                c = text.count(old)
                text = text.replace(old, new)
                total += c
        for old, new in LABEL_REPLACEMENTS:
            if old in text:
                c = text.count(old)
                text = text.replace(old, new)
                total += c
        if text != orig:
            path.write_text(text, encoding="utf-8")
            print(path.relative_to(REPO), "updated")
    print("total replacements:", total)


if __name__ == "__main__":
    main()
