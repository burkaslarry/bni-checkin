#!/usr/bin/env python3
"""Convert legacy member CSV to name,profession,chapter format.

Usage:
  python3 scripts/convert-member-csv-to-chapter-format.py \\
    data/amax-member-list-0415.csv data/amax-member-list-chapter.csv amax

If chapter arg omitted, defaults to anchor.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path


def convert(src: Path, dest: Path, chapter: str) -> int:
    chapter = chapter.strip().lower() or "anchor"
    rows_out: list[tuple[str, str, str]] = []

    with src.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError("CSV has no header row")
        for i, row in enumerate(reader, start=2):
            name = (row.get("name") or "").strip()
            profession = (row.get("profession") or row.get("category") or "").strip()
            if not name:
                print(f"skip line {i}: empty name", file=sys.stderr)
                continue
            if not profession:
                raise ValueError(f"line {i}: missing profession for {name!r}")
            row_chapter = (row.get("chapter") or chapter).strip().lower() or chapter
            rows_out.append((name, profession, row_chapter))

    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["name", "profession", "chapter"])
        writer.writerows(rows_out)

    print(f"Wrote {len(rows_out)} rows -> {dest}")
    return len(rows_out)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    src = Path(sys.argv[1])
    dest = Path(sys.argv[2])
    chapter = sys.argv[3] if len(sys.argv) > 3 else "anchor"
    if not src.is_file():
        print(f"Source not found: {src}", file=sys.stderr)
        return 1
    convert(src, dest, chapter)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
