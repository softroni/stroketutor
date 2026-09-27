#!/usr/bin/env python3
"""Puts the rendered App Store screenshots (out/iphone, out/ipad) on the App Store
version being prepared in App Store Connect.

    python3 docs/app-store/marketing/upload.py            # shows what differs, changes nothing
    python3 docs/app-store/marketing/upload.py --apply    # replaces the sets that differ

It works on the one iOS version App Store Connect still lets you edit (Prepare for
Submission, or rejected), or on `--version 1.1`. A set whose screenshots already
match out/ file for file (by MD5, in order) is left alone, so running it twice
changes nothing. A set that differs is emptied and uploaded again in listing order,
then the script waits for Apple to finish processing each file. If it stops part
way, run it again. With no version to edit it compares the newest version and says
what would change, so it can be run at any time.

Needs PyJWT and the team API key in ~/.appstoreconnect/config (see ~/.claude/CLAUDE.md).
The key is only read to sign requests, never printed.
"""
import argparse
import glob
import hashlib
import json
import os
import re
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.request

import jwt

APP_ID = "6816231257"  # Paper Coach
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
# App Store Connect display type -> out/<device> and the exact upload size.
SETS = {
    "APP_IPHONE_67": ("iphone", (1320, 2868)),  # iPhone 6.9"
    "APP_IPAD_PRO_3GEN_129": ("ipad", (2064, 2752)),  # iPad 13"
}
EDITABLE = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY"}
FILE = re.compile(r"^(\d\d)-[a-z0-9-]+\.png$")


# ---------- App Store Connect ----------

def _config():
    cfg = {}
    for line in open(os.path.expanduser("~/.appstoreconnect/config")):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            cfg[key.replace("export ", "").strip()] = os.path.expandvars(
                os.path.expanduser(value.strip().strip('"').strip("'")))
    return cfg


CFG = _config()


def _token():
    now = int(time.time())
    with open(CFG["ASC_KEY_PATH"]) as key:
        return jwt.encode({"iss": CFG["ASC_ISSUER_ID"], "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
                          key.read(), algorithm="ES256", headers={"kid": CFG["ASC_KEY_ID"]})


def api(method, path, body=None):
    url = path if path.startswith("http") else "https://api.appstoreconnect.apple.com" + path
    request = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Authorization": "Bearer " + _token(),
                                              "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request) as response:
            text = response.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as error:
        sys.exit(f"{method} {path}: {error.code} {error.read().decode()[:600]}")


# ---------- The local renders ----------

def png_facts(path):
    """(width, height, has_alpha) from the PNG header, without an image library."""
    with open(path, "rb") as f:
        head = f.read(26)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    width, height = struct.unpack(">II", head[16:24])
    color_type = head[25]
    return width, height, color_type in (4, 6)


def local_shots(device, size):
    """The PNGs for one device in listing order, checked the way App Store Connect checks them."""
    paths = sorted(p for p in glob.glob(os.path.join(OUT, device, "*.png")) if FILE.match(os.path.basename(p)))
    problems = []
    if not paths:
        problems.append(f"out/{device} has no screenshots; render them with node docs/app-store/marketing/render.mjs")
    if len(paths) > 10:
        problems.append(f"out/{device} has {len(paths)} screenshots; App Store Connect takes at most 10")
    numbers = [int(os.path.basename(p)[:2]) for p in paths]
    if numbers != list(range(1, len(paths) + 1)):
        problems.append(f"out/{device} is not numbered 01..{len(paths):02d}: {[os.path.basename(p) for p in paths]}")
    for path in paths:
        facts = png_facts(path)
        if not facts or facts[:2] != size or facts[2]:
            problems.append(f"{os.path.relpath(path, HERE)} must be a {size[0]}x{size[1]} PNG without alpha, is {facts}")
    return paths, problems


def md5(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


# ---------- One screenshot set ----------

def find_set(localization_id, display_type, create):
    found = api("GET", f"/v1/appStoreVersionLocalizations/{localization_id}/appScreenshotSets"
                       f"?filter[screenshotDisplayType]={display_type}")["data"]
    if found or not create:
        return found[0]["id"] if found else None
    return api("POST", "/v1/appScreenshotSets", {"data": {
        "type": "appScreenshotSets",
        "attributes": {"screenshotDisplayType": display_type},
        "relationships": {"appStoreVersionLocalization": {
            "data": {"type": "appStoreVersionLocalizations", "id": localization_id}}}}})["data"]["id"]


def remote_shots(set_id):
    """The set's screenshots in their App Store order."""
    if not set_id:
        return []
    order = [item["id"] for item in api("GET", f"/v1/appScreenshotSets/{set_id}/relationships/appScreenshots?limit=50")["data"]]
    by_id = {shot["id"]: shot for shot in api("GET", f"/v1/appScreenshotSets/{set_id}/appScreenshots?limit=50")["data"]}
    return [by_id[i] for i in order if i in by_id]


def upload(set_id, path):
    with open(path, "rb") as f:
        data = f.read()
    shot = api("POST", "/v1/appScreenshots", {"data": {
        "type": "appScreenshots",
        "attributes": {"fileName": os.path.basename(path), "fileSize": len(data)},
        "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}}}})["data"]
    for op in shot["attributes"]["uploadOperations"]:
        part = urllib.request.Request(op["url"], data=data[op["offset"]:op["offset"] + op["length"]], method=op["method"],
                                      headers={h["name"]: h["value"] for h in op["requestHeaders"]})
        with urllib.request.urlopen(part) as response:
            if response.status >= 300:
                sys.exit(f"uploading {path}: {response.status}")
    api("PATCH", f"/v1/appScreenshots/{shot['id']}", {"data": {
        "type": "appScreenshots", "id": shot["id"],
        "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}})
    return shot["id"]


def wait_until_processed(ids, label):
    deadline = time.time() + 300
    pending = set(ids)
    while pending and time.time() < deadline:
        time.sleep(5)
        for shot_id in list(pending):
            state = api("GET", f"/v1/appScreenshots/{shot_id}")["data"]["attributes"]["assetDeliveryState"]
            if state["state"] == "COMPLETE":
                pending.discard(shot_id)
            elif state["state"] == "FAILED":
                sys.exit(f"{label}: Apple could not process a screenshot: {state.get('errors')}")
    if pending:
        sys.exit(f"{label}: {len(pending)} screenshots still processing after 5 minutes; check App Store Connect")


# ---------- Main ----------

def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true", help="replace the sets that differ (default: only report)")
    parser.add_argument("--version", help="the version string to work on, e.g. 1.1 (default: the editable one)")
    parser.add_argument("--locale", default="en-US")
    args = parser.parse_args()

    local, problems = {}, []
    for display_type, (device, size) in SETS.items():
        local[display_type], found = local_shots(device, size)
        problems += found
    if problems:
        sys.exit("Not uploading:\n  " + "\n  ".join(problems))
    dirty = subprocess.run(["git", "status", "--porcelain", "--", "out"], cwd=HERE, capture_output=True, text=True).stdout
    if dirty.strip():
        print("Note: out/ has uncommitted changes; these files are what gets compared and uploaded.\n" + dirty)

    versions = api("GET", f"/v1/apps/{APP_ID}/appStoreVersions?filter[platform]=IOS&limit=20"
                          "&fields[appStoreVersions]=versionString,appVersionState,appStoreState,createdDate")["data"]
    state = lambda v: v["attributes"].get("appVersionState") or v["attributes"].get("appStoreState")
    if args.version:
        chosen = [v for v in versions if v["attributes"]["versionString"] == args.version]
    else:
        chosen = [v for v in versions if state(v) in EDITABLE]
    if not chosen:
        if args.version:
            sys.exit(f"No iOS version {args.version} in App Store Connect.")
        newest = max(versions, key=lambda v: v["attributes"]["createdDate"])
        print(f"No version to edit: the newest is {newest['attributes']['versionString']} ({state(newest)}). "
              "Comparing with it; nothing will be changed.")
        chosen, args.apply = [newest], False
    version = chosen[0]
    name = f"{version['attributes']['versionString']} ({state(version)})"
    if args.apply and state(version) not in EDITABLE:
        sys.exit(f"{name} cannot be edited in App Store Connect.")

    localizations = api("GET", f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50")["data"]
    localization = next((l for l in localizations if l["attributes"]["locale"] == args.locale), None)
    if not localization:
        sys.exit(f"{name} has no {args.locale} localization.")

    changed = False
    for display_type, paths in local.items():
        label = f"{name} {args.locale} {display_type}"
        set_id = find_set(localization["id"], display_type, create=args.apply)
        remote = remote_shots(set_id)
        theirs = [s["attributes"].get("sourceFileChecksum") for s in remote]
        ours = [md5(p) for p in paths]
        if theirs == ours:
            print(f"{label}: up to date ({len(paths)} screenshots)")
            continue
        changed = True
        positions = [f"{i + 1:02d}" for i in range(max(len(theirs), len(ours)))
                     if i >= len(theirs) or i >= len(ours) or theirs[i] != ours[i]]
        print(f"{label}: differs at {', '.join(positions)} "
              f"({len(remote)} in App Store Connect, {len(paths)} in out/{SETS[display_type][0]})")
        if not args.apply:
            continue
        for shot in remote:
            api("DELETE", f"/v1/appScreenshots/{shot['id']}")
        ids = []
        for path in paths:
            ids.append(upload(set_id, path))
            print(f"  uploaded {os.path.basename(path)}")
        api("PATCH", f"/v1/appScreenshotSets/{set_id}/relationships/appScreenshots",
            {"data": [{"type": "appScreenshots", "id": i} for i in ids]})
        wait_until_processed(ids, label)
        print(f"{label}: replaced and processed")

    # Other sizes on the version (a 6.5" set copied from an old version, say) would be shown instead of
    # scaled 6.9" screenshots on those devices, so they are pointed out, never touched.
    others = [s for s in api("GET", f"/v1/appStoreVersionLocalizations/{localization['id']}/appScreenshotSets")["data"]
              if s["attributes"]["screenshotDisplayType"] not in SETS]
    for other in others:
        print(f"Note: {name} also has a {other['attributes']['screenshotDisplayType']} set, which this script leaves alone.")

    if changed and not args.apply:
        print("Run again with --apply to upload." if state(version) in EDITABLE else
              "Upload once a new version exists in App Store Connect.")


if __name__ == "__main__":
    main()
