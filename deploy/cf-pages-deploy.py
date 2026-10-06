#!/usr/bin/env python3
"""Deploy a static dist/ directory to Cloudflare Pages via Direct Upload API.

Usage:
  cf-pages-deploy.py --project <name> --dist <dir> [--branch main]

Flow (per Cloudflare Pages Direct Upload docs):
  1. create project if missing
  2. GET upload-token (JWT)
  3. POST /pages/assets/check-missing (JWT) -> missing hashes
  4. POST /pages/assets/upload (JWT, multipart keyed by hash)
  5. POST /pages/assets/upsert-hashes (JWT)
  6. POST /accounts/{id}/pages/projects/{name}/deployments (multipart manifest)

Uses the stored custom.cloudflare credential via authd surrogate for the
account-scoped calls; the short-lived upload JWT is used as a plain Bearer
for the asset-store calls, per Cloudflare's documented workflow.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import sys
import urllib.request

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import (
    add_surrogate_to_request,
    read_json_response,
)

API_BASE = "https://api.cloudflare.com/client/v4"
ALLOWED = ["api.cloudflare.com"]
ACCOUNT_ID = "1782392a1e203f73ef36e8c74f02e850"

# Pages-handled config files: not hashed assets, sent as separate form fields.
CONFIG_FILES = {"_headers", "_redirects"}


def cf_call(method: str, path: str, body: dict | None = None) -> dict:
    url = API_BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=ALLOWED)
    resp = urllib.request.urlopen(req, timeout=60)
    result = read_json_response(resp)
    if not result.get("success"):
        raise RuntimeError(f"Cloudflare API error on {method} {path}: {result.get('errors')}")
    return result["result"]


def jwt_call(method: str, path: str, jwt: str, body: dict | None = None) -> dict:
    url = API_BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {jwt}")
    resp = urllib.request.urlopen(req, timeout=120)
    result = read_json_response(resp)
    if not result.get("success"):
        raise RuntimeError(f"Asset API error on {method} {path}: {result.get('errors')}")
    return result.get("result")


def ensure_project(name: str, production_branch: str = "main") -> dict:
    try:
        proj = cf_call("GET", f"/accounts/{ACCOUNT_ID}/pages/projects/{name}")
        print(f"Project '{name}' exists (subdomain {proj.get('subdomain')})", file=sys.stderr)
        return proj
    except Exception as e:
        if "404" not in str(e) and "8000007" not in str(e):
            raise
    proj = cf_call(
        "POST",
        f"/accounts/{ACCOUNT_ID}/pages/projects",
        {"name": name, "production_branch": production_branch},
    )
    print(f"Project '{name}' created", file=sys.stderr)
    return proj


def wrangler_hash(data: bytes, filename: str) -> str:
    """Wrangler-compatible Pages asset key.

    Byte-exact port of hashFile() in
    cloudflare/workers-sdk packages/deploy-helpers/src/deploy/helpers/hash.ts:
        base64 = data.toString("base64")
        ext = path.extname(filepath).substring(1)   # without the dot
        return blake3(base64 + ext).hex().slice(0, 32)
    """
    import base64 as _b64

    from blake3 import blake3

    base64_contents = _b64.b64encode(data).decode("ascii")
    extension = os.path.splitext(filename)[1][1:]  # extname without dot
    return blake3((base64_contents + extension).encode("utf-8")).hexdigest()[:32]


def collect_files(dist: str):
    """Return (manifest, hash_to_info). manifest: {web_path: wrangler_32hex}."""
    manifest: dict[str, str] = {}
    hash_info: dict[str, tuple[str, bytes, str]] = {}
    for root, _dirs, files in os.walk(dist):
        for fn in files:
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, dist)
            if rel in CONFIG_FILES:
                continue
            web_path = "/" + rel.replace(os.sep, "/")
            with open(full, "rb") as f:
                data = f.read()
            h = wrangler_hash(data, fn)
            manifest[web_path] = h
            ctype = mimetypes.guess_type(fn)[0] or "application/octet-stream"
            hash_info[h] = (web_path, data, ctype)
    return manifest, hash_info


def upload_missing(jwt: str, hash_info: dict, missing: list[str]) -> None:
    """POST /pages/assets/upload — JSON array (KV bulk-write shape), per docs."""
    import base64

    payload = []
    for h in missing:
        _path, data, ctype = hash_info[h]
        payload.append(
            {
                "base64": True,
                "key": h,
                "metadata": {"contentType": ctype},
                "value": base64.b64encode(data).decode(),
            }
        )
    result = jwt_call("POST", "/pages/assets/upload", jwt, payload)
    print(f"Uploaded {len(missing)} new asset(s)", file=sys.stderr)


def create_deployment(name: str, manifest: dict, dist: str) -> dict:
    import uuid

    boundary = uuid.uuid4().hex
    body = bytearray()

    def add_field(fname: str, content: str, ctype: str = "text/plain"):
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="{fname}"\r\n'.encode())
        body.extend(f"Content-Type: {ctype}\r\n\r\n".encode())
        body.extend(content.encode())
        body.extend(b"\r\n")

    add_field("manifest", json.dumps(manifest), "application/json")
    for cfg in CONFIG_FILES:
        p = os.path.join(dist, cfg)
        if os.path.isfile(p):
            with open(p, encoding="utf-8") as f:
                add_field(cfg, f.read())
    body.extend(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{API_BASE}/accounts/{ACCOUNT_ID}/pages/projects/{name}/deployments",
        data=bytes(body),
        method="POST",
    )
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=ALLOWED)
    resp = urllib.request.urlopen(req, timeout=300)
    result = read_json_response(resp)
    if not result.get("success"):
        raise RuntimeError(f"Deployment creation failed: {result.get('errors')}")
    return result["result"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--dist", required=True)
    ap.add_argument("--branch", default="main")
    args = ap.parse_args()

    dist = os.path.abspath(args.dist)
    if not os.path.isdir(dist):
        ap.error(f"dist dir not found: {dist}")

    proj = ensure_project(args.project, args.branch)

    token_res = cf_call(
        "GET", f"/accounts/{ACCOUNT_ID}/pages/projects/{args.project}/upload-token"
    )
    jwt = token_res if isinstance(token_res, str) else token_res.get("jwt") or token_res.get("result")
    if not jwt or not isinstance(jwt, str):
        raise RuntimeError(f"Unexpected upload-token response: {str(token_res)[:200]}")

    manifest, hash_info = collect_files(dist)
    print(f"Manifest: {len(manifest)} file(s)", file=sys.stderr)

    missing = jwt_call("POST", "/pages/assets/check-missing", jwt, {"hashes": list(hash_info)})
    if isinstance(missing, dict):
        missing = missing.get("result", [])
    print(f"Missing assets: {len(missing)}", file=sys.stderr)
    if missing:
        upload_missing(jwt, hash_info, missing)
        jwt_call("POST", "/pages/assets/upsert-hashes", jwt, {"hashes": list(hash_info)})

    dep = create_deployment(args.project, manifest, dist)
    print(f"Deployment created: id={dep.get('id')}")
    print(f"URL: {dep.get('url')}")
    for alias in dep.get("aliases") or []:
        print(f"Alias: {alias}")


if __name__ == "__main__":
    main()
