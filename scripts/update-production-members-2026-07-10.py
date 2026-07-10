#!/usr/bin/env python3
"""Apply production member corrections from BNI Member List_NEW.pdf (Jul 2026)."""
import json
import os
import sys
import urllib.parse
import urllib.request

BASE_URL = os.environ.get("BASE_URL", "https://bni-anchor-checkin-backend.onrender.com").rstrip("/")


def request(method: str, path: str, payload: dict | None = None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def put_member(name: str, **fields):
    payload = {k: v for k, v in fields.items() if v is not None}
    encoded_name = urllib.parse.quote(name)
    return request("PUT", f"/api/members/{encoded_name}", payload)


def update_by_name(current_name: str, **fields):
    payload = {k: v for k, v in fields.items() if v is not None}
    query = urllib.parse.urlencode({"currentName": current_name})
    return request("PUT", f"/api/members?{query}", payload)


def delete_by_name(name: str):
    query = urllib.parse.urlencode({"name": name})
    return request("DELETE", f"/api/members?{query}")


def main() -> int:
    print(f"Updating production members at {BASE_URL}")

    fixes = [
        ("Larry Lo", {"profession": "客戶管理系統"}),
        ("Phoebe Lin", {"profession": "催乳及紮肚服務"}),
        ("Frankie Ng", {"profession": "目經一眼藥水及護眼素"}),
        ("Yoko Sin", {"profession": "催債服務"}),
    ]
    for name, fields in fixes:
        result = update_by_name(name, **fields)
        print(f"updated {name}: {result.get('status')} -> {result.get('member', {}).get('profession', fields)}")

    result = update_by_name("Max Chan/Eddie Chou", name="Max Chan/William Lai")
    print(f"renamed Max Chan/Eddie Chou: {result.get('status')} -> {result.get('member', {}).get('name')}")

    delete_by_name("Chan one")
    print("deleted Chan one (One Chan already exists)")
    one_chan = update_by_name("One Chan", profession="商業活動策劃", professionCode="B")
    print(f"ensured One Chan category B: {one_chan.get('status')}")

    for name in ("Eison Chiang", "Eric Su", "Summer Ha"):
        result = delete_by_name(name)
        print(f"deleted {name}: {result.get('status')}")

    with urllib.request.urlopen(f"{BASE_URL}/api/members") as resp:
        members = json.loads(resp.read().decode()).get("members", [])
    print(f"final member count: {len(members)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
