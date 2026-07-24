#!/usr/bin/env python3
"""Bulk import members from name,profession,chapter CSV into production DB.

Groups rows by chapter and POSTs to /api/bulk-import-members?chapter=...

Usage:
  python3 scripts/import-member-csv-chapter.py data/amax-member-list-chapter.csv
  BASE_URL=https://... CHAPTER=amax python3 scripts/import-member-csv-chapter.py file.csv

Default chapter for rows with empty chapter column: CHAPTER env or anchor.
"""
from __future__ import annotations

import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

BASE_URL = os.environ.get("BASE_URL", "https://bni-anchor-checkin-backend.onrender.com").rstrip("/")
DEFAULT_CHAPTER = os.environ.get("CHAPTER", "anchor").strip().lower() or "anchor"


def load_rows(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            name = (row.get("name") or "").strip()
            profession = (row.get("profession") or "").strip()
            chapter = (row.get("chapter") or DEFAULT_CHAPTER).strip().lower() or DEFAULT_CHAPTER
            if not name:
                continue
            if not profession:
                raise ValueError(f"line {i}: missing profession for {name!r}")
            record: dict[str, str] = {
                "name": name,
                "profession": profession,
                "standing": "GREEN",
            }
            # Optional legacy columns if present
            for key in ("email", "phone", "phoneNumber", "membershipId", "professionCode", "position"):
                val = (row.get(key) or "").strip()
                if val:
                    record["phoneNumber" if key == "phone" else key] = val
            if row.get("chapter"):
                record["chapter"] = chapter
            rows.append((chapter, record))
    return rows


def post_import(chapter: str, records: list[dict]) -> dict:
    url = f"{BASE_URL}/api/bulk-import-members?{urllib.parse.urlencode({'chapter': chapter})}"
    payload = json.dumps(records).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        return 1

    grouped: dict[str, list[dict]] = defaultdict(list)
    for chapter, record in load_rows(path):
        grouped[chapter].append(record)

    print(f"Importing from {path} -> {BASE_URL}")
    total_inserted = total_updated = total_failed = 0
    for chapter in sorted(grouped.keys()):
        records = grouped[chapter]
        print(f"  chapter={chapter} rows={len(records)}")
        try:
            result = post_import(chapter, records)
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            print(f"ERROR chapter={chapter}: HTTP {e.code} {body}", file=sys.stderr)
            return 1
        inserted = result.get("inserted", 0)
        updated = result.get("updated", 0)
        failed = result.get("failed", 0)
        total_inserted += inserted
        total_updated += updated
        total_failed += failed
        print(f"    inserted={inserted} updated={updated} failed={failed}")
        for err in (result.get("errors") or [])[:5]:
            print(f"    - {err}")
        if failed:
            return 1

    print(f"Done: inserted={total_inserted} updated={total_updated} failed={total_failed}")
    verify_url = f"{BASE_URL}/api/members?chapter=amax"
    with urllib.request.urlopen(verify_url) as resp:
        data = json.loads(resp.read().decode())
        print(f"Verify GET /api/members?chapter=amax -> {len(data.get('members', []))} members")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
