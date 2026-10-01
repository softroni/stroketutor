#!/usr/bin/env python3
"""Paper Coach operations: what Claude reads every day, and what the Studio's Today page shows.

    python3 docs/ops/today.py check      # cheap: review state and new App Store reviews since last time
    python3 docs/ops/today.py collect    # everything: App Store Connect, sales, Apple Ads, Superwall
    python3 docs/ops/today.py publish    # facts.json + notes.json + the log -> status.json (the Today page)
    python3 docs/ops/today.py log "Resubmitted 1.0.1 (4) after the 2.1 rejection"
    python3 docs/ops/today.py log --kind release "Apple approved 1.1 (4); tagged and merged"
    python3 docs/ops/today.py show       # the status as it stands, for a session to read
    python3 docs/ops/today.py archive    # commit and push the day's history (branch ops-history)

Everything lives in .studio/ops/ of the main checkout (gitignored, on this Mac), whichever
worktree runs the script:

    facts.json   what `collect` found (overwritten each run)
    notes.json   what Claude says: headline, needs-you, working-on, PostHog numbers and funnel, next
                 run, dates coming up, and `addLog`: lines for the log, which `publish` moves into
                 log.jsonl (so a scheduled run logs with a file edit, not with a command whose text
                 changes every time)
    log.jsonl    one line per thing that happened, appended by `log` or from `addLog`
    state.json   what `check` saw last, so it can say what changed
    status.json  what the Today page reads, made by `publish`
    history/     a worktree of the branch `ops-history`: status.json as it stood at the end of each
                 day (YYYY-MM-DD.json) and a copy of log.jsonl. Never deleted; `archive` pushes it to
                 GitHub, and the Studio shows any past day at #/today/YYYY-MM-DD.

docs/ops/README.md is the runbook: what Claude does with all this, and what it may do on its own.
Standard library only, plus PyJWT for App Store Connect (python3 on this Mac has it).
"""

from __future__ import annotations

import csv
import datetime as dt
import gzip
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

APP_ID = "6816231257"  # Paper Coach on App Store Connect
APP_SKU = "papercouch"  # its SKU (App Store Connect cannot change one); sales rows of its subscriptions name it as parent
SUPERWALL_APP = "56531"  # Paper Coach in Superwall
ASA_VIA_APP = "54792"  # the Superwall app whose Apple Ads connection reaches the Softroni LLC org
POSTHOG_DASHBOARD = "https://us.posthog.com/project/629055/dashboard/2140277"
LOCAL_TZ = ZoneInfo("America/Chicago")  # the creator's clock (Central: -05:00 in summer, -06:00 in winter)

# App Store Connect states, as a person would say them, and how they should feel.
STATES = {
    "PREPARE_FOR_SUBMISSION": ("Being prepared", "neutral"),
    "READY_FOR_REVIEW": ("Ready to submit", "neutral"),
    "WAITING_FOR_EXPORT_COMPLIANCE": ("Waiting for export compliance", "attention"),
    "WAITING_FOR_REVIEW": ("Waiting for review", "waiting"),
    "IN_REVIEW": ("In review", "waiting"),
    "ACCEPTED": ("Approved", "good"),
    "PENDING_DEVELOPER_RELEASE": ("Approved, waiting to be released", "good"),
    "PENDING_APPLE_RELEASE": ("Approved, Apple releasing", "good"),
    "PROCESSING_FOR_APP_STORE": ("Approved, processing", "good"),
    "PROCESSING_FOR_DISTRIBUTION": ("Approved, processing", "good"),
    "READY_FOR_SALE": ("On sale", "good"),
    "READY_FOR_DISTRIBUTION": ("On sale", "good"),
    "REJECTED": ("Rejected", "bad"),
    "METADATA_REJECTED": ("Metadata rejected", "bad"),
    "INVALID_BINARY": ("Invalid binary", "bad"),
    "DEVELOPER_REJECTED": ("Withdrawn", "attention"),
    "DEVELOPER_REMOVED_FROM_SALE": ("Removed from sale", "attention"),
    "REMOVED_FROM_SALE": ("Removed from sale", "bad"),
    "REPLACED_WITH_NEW_VERSION": ("Replaced", "neutral"),
    "REPLACED_WITH_NEW_BUILD": ("Build replaced", "neutral"),
}
LIVE_STATES = {"READY_FOR_SALE", "READY_FOR_DISTRIBUTION", "DEVELOPER_REMOVED_FROM_SALE", "REMOVED_FROM_SALE"}
# What a log line can say it is about (`log --kind`); without one the page reads it from the words.
LOG_KINDS = {"release", "review", "ads", "tests", "social", "build", "money", "learners", "check"}


# ---------------------------------------------------------------- where things are


def main_checkout() -> Path:
    common = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=Path(__file__).resolve().parent,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    return Path(common).parent


OPS = main_checkout() / ".studio" / "ops"


def read_json(name: str, default):
    try:
        return json.loads((OPS / name).read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(name: str, value) -> None:
    OPS.mkdir(parents=True, exist_ok=True)
    path = OPS / name
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    temporary.replace(path)


def now() -> dt.datetime:
    """The creator's time; its date is the day a log line and a history file are kept under."""
    return dt.datetime.now(LOCAL_TZ).replace(microsecond=0)


# ---------------------------------------------------------------- App Store Connect


def asc_config() -> dict:
    config = {}
    for line in Path("~/.appstoreconnect/config").expanduser().read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            config[key.strip()] = value.strip().strip('"')
    return config


def asc_token(role: str = "manager") -> str:
    import jwt  # PyJWT

    config = asc_config()
    key_id = config["ASC_SALES_KEY_ID"] if role == "sales" else config["ASC_KEY_ID"]
    key_path = config["ASC_SALES_KEY_PATH"] if role == "sales" else config["ASC_KEY_PATH"]
    key = Path(os.path.expandvars(key_path)).expanduser().read_text()
    issued = int(time.time())
    return jwt.encode(
        {"iss": config["ASC_ISSUER_ID"], "iat": issued, "exp": issued + 1100, "aud": "appstoreconnect-v1"},
        key,
        algorithm="ES256",
        headers={"kid": key_id},
    )


def asc_get(path: str, role: str = "manager", accept: str = "application/json"):
    request = urllib.request.Request(
        "https://api.appstoreconnect.apple.com" + path,
        headers={"Authorization": "Bearer " + asc_token(role), "Accept": accept},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
    return body if accept != "application/json" else json.loads(body)


def app_versions() -> dict:
    """The version on sale and the one with Apple, with their builds and phased releases."""
    data = asc_get(
        f"/v1/apps/{APP_ID}/appStoreVersions?limit=10&include=build,appStoreVersionPhasedRelease&fields[builds]=version"
    )
    included = data.get("included", [])
    builds = {item["id"]: item["attributes"]["version"] for item in included if item["type"] == "builds"}
    phased = {
        item["id"]: {
            "state": item["attributes"].get("phasedReleaseState"),
            "day": item["attributes"].get("currentDayNumber") or 0,
        }
        for item in included
        if item["type"] == "appStoreVersionPhasedReleases"
    }
    live, pending = None, None
    for version in data["data"]:
        attributes = version["attributes"]
        state = attributes.get("appVersionState") or attributes.get("appStoreState")
        relationships = version.get("relationships", {})
        build_ref = (relationships.get("build", {}) or {}).get("data")
        phased_ref = (relationships.get("appStoreVersionPhasedRelease", {}) or {}).get("data")
        entry = {
            "id": version["id"],
            "version": attributes["versionString"],
            "build": builds.get(build_ref["id"], "?") if build_ref else "?",
            "code": state,
            "created": attributes.get("createdDate"),
            "phased": phased.get(phased_ref["id"]) if phased_ref else None,
        }
        if state in LIVE_STATES:
            live = live or entry
        elif state not in ("REPLACED_WITH_NEW_VERSION",) and pending is None:
            pending = entry
    return {"live": live, "pending": pending}


def latest_submission() -> dict | None:
    data = asc_get(f"/v1/reviewSubmissions?filter[app]={APP_ID}&limit=10")
    submitted = [item for item in data["data"] if item["attributes"].get("submittedDate")]
    if not submitted:
        return None
    item = max(submitted, key=lambda item: item["attributes"]["submittedDate"])
    return {"id": item["id"], "state": item["attributes"].get("state"), "submitted": item["attributes"]["submittedDate"]}


def customer_reviews(limit: int = 20) -> list[dict]:
    data = asc_get(f"/v1/apps/{APP_ID}/customerReviews?sort=-createdDate&limit={limit}&include=response")
    answered = {
        item["relationships"]["review"]["data"]["id"]
        for item in data.get("included", [])
        if item["type"] == "customerReviewResponses" and item.get("relationships", {}).get("review", {}).get("data")
    }
    reviews = []
    for item in data["data"]:
        attributes = item["attributes"]
        response_ref = (item.get("relationships", {}).get("response", {}) or {}).get("data")
        reviews.append(
            {
                "id": item["id"],
                "date": attributes["createdDate"],
                "rating": attributes["rating"],
                "title": attributes.get("title") or "",
                "body": attributes.get("body") or "",
                "territory": attributes.get("territory"),
                "replied": bool(response_ref) or item["id"] in answered,
            }
        )
    return reviews


def store_rating() -> dict | None:
    """The US storefront's average and count, from Apple's public lookup (only once the app is live)."""
    try:
        with urllib.request.urlopen(f"https://itunes.apple.com/lookup?id={APP_ID}&country=us", timeout=30) as response:
            results = json.load(response).get("results", [])
    except (urllib.error.URLError, TimeoutError):
        return None
    if not results:
        return None
    first = results[0]
    return {"average": first.get("averageUserRating"), "count": first.get("userRatingCount", 0)}


def sales_days(days: int = 14) -> dict:
    """Daily Sales and Trends summaries: first downloads, redownloads, subscriptions and proceeds (USD rows)."""
    vendor = asc_config().get("ASC_VENDOR_NUMBER")
    if not vendor:
        return {"missing": "vendor number (ASC_VENDOR_NUMBER in ~/.appstoreconnect/config)"}
    rows = []
    today = now().date()
    for back in range(days, 0, -1):
        day = today - dt.timedelta(days=back)
        query = urllib.parse.urlencode(
            {
                "filter[frequency]": "DAILY",
                "filter[reportType]": "SALES",
                "filter[reportSubType]": "SUMMARY",
                "filter[vendorNumber]": vendor,
                "filter[version]": "1_1",
                "filter[reportDate]": day.isoformat(),
            }
        )
        entry = {"day": day.isoformat(), "downloads": 0, "redownloads": 0, "subscriptions": 0, "proceeds_usd": 0.0}
        try:
            body = asc_get(f"/v1/salesReports?{query}", role="sales", accept="application/a-gzip")
        except urllib.error.HTTPError as error:
            if error.code == 404:  # no sales that day, or the report is not out yet
                entry["report"] = "none"
                rows.append(entry)
                continue
            raise
        for line in csv.DictReader(io.StringIO(gzip.decompress(body).decode()), delimiter="\t"):
            if line.get("Apple Identifier") != APP_ID and line.get("Parent Identifier") != APP_SKU:
                continue  # another Softroni app
            kind = line.get("Product Type Identifier", "")
            units = int(float(line.get("Units") or 0))
            if kind in ("1", "1F", "1T"):
                entry["downloads"] += units
            elif kind in ("3", "3F", "3T"):
                entry["redownloads"] += units
            elif kind.startswith("IA") or kind.startswith("FI"):
                entry["subscriptions"] += units
            if line.get("Currency of Proceeds") == "USD":
                entry["proceeds_usd"] += units * float(line.get("Developer Proceeds") or 0)
        entry["proceeds_usd"] = round(entry["proceeds_usd"], 2)
        rows.append(entry)
    return {"days": rows}


# ---------------------------------------------------------------- Apple Ads and Superwall (through the superwall CLI)


def superwall(*args: str):
    result = subprocess.run(["superwall", *args, "--json"], capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"superwall {' '.join(args)}: {result.stderr.strip()[:300]}")
    return json.loads(result.stdout)


def apple_ads(days: int = 14) -> dict:
    campaigns = [
        campaign
        for campaign in superwall("asa", "campaigns", "list", "--app", ASA_VIA_APP)["data"]
        if str(campaign.get("adamId")) == APP_ID and not campaign.get("deleted")
    ]
    if not campaigns:
        return {"campaigns": [], "days": []}
    today = now().date()
    start = (today - dt.timedelta(days=days)).isoformat()
    end = today.isoformat()
    report = superwall(
        "asa", "reports", "campaigns", "--app", ASA_VIA_APP, "--start", start, "--end", end, "--granularity", "DAILY"
    )
    rows = report["data"]["reportingDataResponse"]["row"]
    by_campaign, by_day = {}, {}
    for row in rows:
        meta = row.get("metadata", {})
        if str(meta.get("adamId", APP_ID)) != APP_ID:
            continue
        totals = by_campaign.setdefault(meta.get("campaignId"), {"spend": 0.0, "installs": 0, "taps": 0})
        for day in row.get("granularity", []):
            spend = float(day.get("localSpend", {}).get("amount") or 0)
            installs = int(day.get("totalInstalls") or 0)
            totals["spend"] += spend
            totals["installs"] += installs
            totals["taps"] += int(day.get("taps") or 0)
            daily = by_day.setdefault(day["date"], {"day": day["date"], "spend": 0.0, "installs": 0})
            daily["spend"] += spend
            daily["installs"] += installs
    out = []
    for campaign in campaigns:
        totals = by_campaign.get(campaign["id"], {"spend": 0.0, "installs": 0, "taps": 0})
        out.append(
            {
                "id": campaign["id"],
                "name": campaign["name"],
                "status": campaign.get("displayStatus") or campaign.get("status"),
                "dailyBudget": float((campaign.get("dailyBudgetAmount") or {}).get("amount") or 0),
                "spend": round(totals["spend"], 2),
                "installs": totals["installs"],
                "taps": totals["taps"],
            }
        )
    return {"campaigns": out, "days": [by_day[key] for key in sorted(by_day)]}


def experiments() -> list[dict]:
    names = {paywall["id"]: paywall["name"] for paywall in superwall("paywalls", "list")}
    found = []
    for campaign in superwall("campaigns", "list"):
        if campaign.get("application_id") != SUPERWALL_APP or campaign.get("archived"):
            continue
        if campaign.get("description") == "Example Campaign":
            continue
        for audience in campaign.get("audiences", []):
            if not audience.get("enabled"):
                continue
            variants = [
                {
                    "name": names.get(variant["paywall"], "Holdout" if variant["type"] == "holdout" else variant["paywall"]),
                    "variantId": variant["id"],
                    "share": variant["percentage"],
                }
                for variant in audience.get("variants", [])
                if variant["percentage"] > 0
            ]
            found.append(
                {
                    "name": campaign["description"],
                    "campaignId": campaign["id"],
                    "placement": ", ".join(p["event_name"] for p in campaign.get("placements", []) if p.get("enabled")),
                    "status": "running" if len(variants) > 1 else "one variant",
                    "variants": variants,
                }
            )
    return found


# ---------------------------------------------------------------- commands


def collect() -> dict:
    facts = {"collected": now().isoformat(), "errors": []}

    def attempt(name, work):
        try:
            facts[name] = work()
        except Exception as error:  # a source that fails is reported, and the rest still run
            facts[name] = None
            facts["errors"].append(f"{name}: {error}")

    attempt("versions", app_versions)
    attempt("submission", latest_submission)
    attempt("reviews", customer_reviews)
    attempt("rating", store_rating)
    attempt("sales", sales_days)
    attempt("ads", apple_ads)
    attempt("experiments", experiments)
    write_json("facts.json", facts)
    return facts


def check() -> list[dict]:
    """What changed since the last check: the version's state, and reviews not seen before."""
    state = read_json("state.json", {})
    changes = []
    versions = app_versions()
    for slot in ("live", "pending"):
        entry = versions[slot]
        key = f"{entry['version']} ({entry['build']})" if entry else None
        seen = state.get(slot) or {}
        if entry and (seen.get("key") != key or seen.get("code") != entry["code"]):
            changes.append({"kind": "version", "slot": slot, "version": key, "from": seen.get("code"), "to": entry["code"]})
            state[slot] = {"key": key, "code": entry["code"], "since": now().isoformat()}
        elif not entry and seen:
            changes.append({"kind": "version", "slot": slot, "version": seen.get("key"), "from": seen.get("code"), "to": None})
            state[slot] = None
    known = set(state.get("reviews", []))
    for review in customer_reviews(limit=50):
        if review["id"] not in known:
            changes.append({"kind": "review", **review})
            known.add(review["id"])
    state["reviews"] = sorted(known)
    state["checked"] = now().isoformat()
    write_json("state.json", state)
    return changes


def append_log(text: str, kind: str | None = None) -> None:
    if len(text) > 140:
        print(f"today.py: that log line is {len(text)} characters; keep them under 120 (docs/ops/README.md)", file=sys.stderr)
    entry = {"at": now().isoformat(), "text": text}
    if kind in LOG_KINDS:
        entry["kind"] = kind
    elif kind:
        print(f"today.py: {kind!r} is not a log kind ({', '.join(sorted(LOG_KINDS))}); logged without one", file=sys.stderr)
    OPS.mkdir(parents=True, exist_ok=True)
    with open(OPS / "log.jsonl", "a") as log:
        log.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_log(limit: int = 40) -> list[dict]:
    try:
        lines = (OPS / "log.jsonl").read_text().splitlines()
    except FileNotFoundError:
        return []
    entries = [json.loads(line) for line in lines if line.strip()]
    return list(reversed(entries))[:limit]


def build(entry: dict | None, since: str | None) -> dict | None:
    if not entry:
        return None
    label, tone = STATES.get(entry["code"], (entry["code"].replace("_", " ").capitalize(), "neutral"))
    return {
        "version": entry["version"],
        "build": entry["build"],
        "state": label,
        "tone": tone,
        "since": since,
        "code": entry["code"],
        "phased": entry.get("phased"),
    }


def seen_since(state: dict, slot: str, entry: dict | None) -> str | None:
    """When `check` first saw this version in this state; None if what it saw was another version or state."""
    seen = state.get(slot) or {}
    if not entry or seen.get("key") != f"{entry['version']} ({entry['build']})" or seen.get("code") != entry["code"]:
        return None
    return seen.get("since")


def short_day(day: str) -> str:
    """2026-09-29 as "Sep 29"; anything else as it came (a report's date format is the report's)."""
    try:
        date = dt.date.fromisoformat(str(day)[:10])
    except ValueError:
        return str(day)
    return f"{date:%b} {date.day}"


def publish() -> dict:
    facts = read_json("facts.json", {})
    notes = read_json("notes.json", {})
    pending = notes.pop("addLog", None)
    if pending:
        for line in [pending] if isinstance(pending, (str, dict)) else pending:
            if isinstance(line, dict):
                append_log(str(line.get("text", "")), line.get("kind"))
            else:
                append_log(str(line))
        write_json("notes.json", notes)
    state = read_json("state.json", {})
    versions = facts.get("versions") or {}
    submission = facts.get("submission") or {}
    # The App Store's state as it is now, so the page never lags a submission or an approval made
    # since the last collect. Two quick calls; without them, the last collect's answer stands.
    try:
        versions, submission = app_versions(), latest_submission() or {}
    except Exception as error:
        print(f"today.py: App Store Connect not reached ({error}); versions as of the last collect", file=sys.stderr)

    pending = versions.get("pending")
    pending_since = seen_since(state, "pending", pending)
    if pending and pending["code"] == "WAITING_FOR_REVIEW" and submission.get("submitted"):
        pending_since = submission["submitted"]
    live_since = seen_since(state, "live", versions.get("live"))

    numbers = []
    sales = facts.get("sales") or {}
    if sales.get("days"):
        days = sales["days"]
        last = days[-1]
        numbers.append(
            {
                "label": "Installs",
                "value": str(last["downloads"]),
                "period": short_day(last["day"]),
                "detail": f"14 days: {sum(day['downloads'] for day in days)}",
                "series": [{"day": day["day"], "value": day["downloads"]} for day in days],
                "source": "App Store",
            }
        )
        numbers.append(
            {
                "label": "Proceeds",
                "value": f"${last['proceeds_usd']:.2f}",
                "period": short_day(last["day"]),
                "detail": f"14 days: ${sum(day['proceeds_usd'] for day in days):.2f}",
                "series": [{"day": day["day"], "value": day["proceeds_usd"]} for day in days],
                "source": "App Store",
            }
        )
    ads = facts.get("ads") or {}
    if ads.get("days"):
        numbers.append(
            {
                "label": "Ad spend",
                "value": f"${ads['days'][-1]['spend']:.2f}",
                "period": short_day(ads["days"][-1]["day"]),
                "detail": f"14 days: ${sum(day['spend'] for day in ads['days']):.2f}",
                "series": [{"day": day["day"], "value": round(day["spend"], 2)} for day in ads["days"]],
                "source": "Apple Ads",
            }
        )
    # Claude's numbers (PostHog, reasoned ones) come after, and replace a collected one of the same label.
    own = {number["label"]: number for number in notes.get("numbers", [])}
    numbers = [own.pop(number["label"], number) for number in numbers] + list(own.values())

    experiment_notes = {item["name"]: item for item in notes.get("experiments", [])}
    tests = []
    for experiment in facts.get("experiments") or []:
        extra = experiment_notes.get(experiment["name"], {})
        results = {variant["name"]: variant for variant in extra.get("variants", [])}
        tests.append(
            {
                "name": experiment["name"],
                "placement": experiment["placement"],
                "status": extra.get("status", experiment["status"]),
                "note": extra.get("note"),
                "variants": [{**variant, **results.get(variant["name"], {})} for variant in experiment["variants"]],
            }
        )

    ads_notes = notes.get("ads") or {}
    ads_block = None
    if ads or ads_notes:
        campaigns = ads.get("campaigns", [])
        spent = round(sum(campaign["spend"] for campaign in campaigns), 2) if campaigns else ads_notes.get("spentToDate", 0)
        ads_block = {
            "state": ads_notes.get("state") or ("running" if any(c["status"] == "RUNNING" for c in campaigns) else "off"),
            "note": ads_notes.get("note"),
            "dailyCap": ads_notes.get("dailyCap", round(sum(c["dailyBudget"] for c in campaigns), 2) if campaigns else None),
            "spentToDate": ads_notes.get("spentToDate", spent),
            "earnedToDate": ads_notes.get("earnedToDate"),
            "spendCeiling": ads_notes.get("spendCeiling"),
            "campaigns": [
                {
                    "name": campaign["name"],
                    "status": campaign["status"].lower().replace("_", " "),
                    "spend": campaign["spend"],
                    "installs": campaign["installs"],
                    "costPerInstall": round(campaign["spend"] / campaign["installs"], 2) if campaign["installs"] else None,
                }
                for campaign in campaigns
            ],
        }

    reviews = facts.get("reviews")
    rating = facts.get("rating") or {}
    reviews_block = (
        {
            "average": rating.get("average"),
            "count": rating.get("count") or len(reviews or []),
            "latest": [
                {key: review[key] for key in ("date", "rating", "title", "body", "territory", "replied")}
                for review in (reviews or [])[:6]
            ],
        }
        if reviews is not None
        else None
    )

    errors = facts.get("errors") or []
    updated = now()
    status = {
        "updated": updated.isoformat(),
        "headline": notes.get("headline") or "No headline yet.",
        "app": {"live": build(versions.get("live"), live_since), "inReview": build(pending, pending_since)},
        "numbers": numbers,
        "funnel": notes.get("funnel"),
        "needsYou": notes.get("needsYou", []),
        "working": notes.get("working", [])
        + [{"title": "A source failed in the last collect", "detail": error, "state": "doing"} for error in errors],
        "log": read_log(),
        "experiments": tests,
        "ads": ads_block,
        "reviews": reviews_block,
        "links": notes.get("links")
        or [
            {"label": "PostHog dashboard", "url": POSTHOG_DASHBOARD},
            {"label": "App Store Connect", "url": f"https://appstoreconnect.apple.com/apps/{APP_ID}/distribution"},
            {"label": "Superwall", "url": "https://superwall.com/applications/56531"},
            {"label": "Apple Ads", "url": "https://app-ads.apple.com/cm/app/20605790/report/campaigns"},
        ],
        "next": notes.get("next"),
        "upcoming": notes.get("upcoming", []),
    }
    write_json("status.json", status)
    (OPS / "history").mkdir(exist_ok=True)
    write_json(f"history/{updated.date().isoformat()}.json", status)
    if (OPS / "log.jsonl").exists():
        (OPS / "history" / "log.jsonl").write_text((OPS / "log.jsonl").read_text())
    return status


def archive() -> str:
    """Commits the history folder on its own branch and pushes it. Touches nothing on main."""
    history = OPS / "history"
    if not (history / ".git").exists():
        return f"{history} is not the ops-history worktree; nothing archived"
    git = lambda *args: subprocess.run(["git", "-C", str(history), *args], capture_output=True, text=True)  # noqa: E731
    git("add", "-A")
    if git("diff", "--cached", "--quiet").returncode == 0:
        return "history already archived"
    git("commit", "-q", "-m", f"History to {now().date().isoformat()}")
    pushed = git("push", "-q", "-u", "origin", "ops-history")
    return "history archived and pushed" if pushed.returncode == 0 else f"committed; push failed: {pushed.stderr.strip()}"


def show() -> None:
    status = read_json("status.json", None)
    if not status:
        print("No status yet. Run collect, write notes.json, then publish.")
        return
    print(f"Updated {status['updated']}\n{status['headline']}\n")
    for slot, label in (("live", "On sale"), ("inReview", "With Apple")):
        entry = status["app"].get(slot)
        print(f"{label}: {entry['version']} ({entry['build']}) {entry['state']}" if entry else f"{label}: none")
    for title, items in (("Needs you", status["needsYou"]), ("Working", status["working"])):
        print(f"\n{title}:")
        for item in items:
            print(f"  - [{item.get('state', '')}] {item['title']}" + (f": {item['detail']}" if item.get("detail") else ""))
    upcoming = ([status["next"]] if status.get("next") else []) + status.get("upcoming", [])
    if upcoming:
        print("\nComing up:")
        for event in upcoming:
            print(f"  {event['at']}  {event['what']}")
    print("\nLog:")
    for entry in status["log"][:10]:
        print(f"  {entry['at']}  {entry['text']}")


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else "show"
    if command == "collect":
        facts = collect()
        print(json.dumps({key: facts[key] for key in facts if key != "reviews"}, indent=2)[:6000])
        print(f"\n{len(facts.get('reviews') or [])} reviews read; errors: {facts['errors'] or 'none'}")
    elif command == "check":
        changes = check()
        print(json.dumps(changes, indent=2, ensure_ascii=False) if changes else "no changes")
    elif command == "publish":
        status = publish()
        print(f"published {OPS / 'status.json'} ({status['updated']})")
    elif command == "log":
        words, kind = argv[2:], None
        if words[:1] == ["--kind"]:
            kind, words = (words[1] if len(words) > 1 else None), words[2:]
        if not words:
            print('usage: today.py log [--kind release|review|ads|tests|social|build|money|learners|check] "what happened"', file=sys.stderr)
            return 2
        append_log(" ".join(words), kind)
        if (OPS / "status.json").exists():
            publish()
        print("logged")
    elif command == "show":
        show()
    elif command == "archive":
        print(archive())
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
