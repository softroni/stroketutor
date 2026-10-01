#!/usr/bin/env python3
"""Paper Coach acquisition: App Store page views, Get taps and downloads, per source, campaign and referrer.

    python3 docs/ops/acquisition.py                                 # every granularity, the last 10 days
    python3 docs/ops/acquisition.py --granularity WEEKLY            # one granularity: DAILY, WEEKLY or MONTHLY
    python3 docs/ops/acquisition.py --granularity WEEKLY --days 28  # the weeks out in the last 28 days
    python3 docs/ops/acquisition.py --json                          # the JSON instead of the summary

Reads App Store Connect's analytics reports for app 6816231257 (report request aab01b37…, ONGOING) with the
Sales and Reports key, read-only, and replaces .studio/ops/acquisition.json in the main checkout, the folder
today.py writes, whichever worktree runs it. Nothing else is written: the file is derived data, and Apple
keeps the history.

The reports read:

    App Downloads Standard and Detailed                          first-time downloads, redownloads
    App Store Discovery and Engagement Standard and Detailed     page views, Get taps
    App Store Purchases Detailed                                 purchases, proceeds in USD

What the file holds, per granularity (DAILY, WEEKLY, MONTHLY) and per Date (the day, the week's Monday, the
month's first):

    total, sourceTypes   from the Standard reports, which Apple never thresholds or noises
    campaigns            per `ct=` campaign, from the Detailed reports ("(none)": no campaign)
    referrers            per Source Type and Source Info, for App referrer and Web referrer
    platforms            campaigns added up by their prefix: pinterest*, tiktok*, … (social-plan.md,
                         *Knowing what works*)
    hidden               per metric, the Standard total minus the sum of the Detailed rows, and its share
    provisional          the last 3 days of daily data, which Apple may still restate

How Apple delivers them (README.md, *Lesson videos on social*):

- An instance (one processingDate) restates earlier Dates until they are complete. For each Date only the
  rows of the newest instance count; instances are never added together.
- Detailed rows from fewer than 5 users or devices are left out, and the rest carry noise of about ±2: a
  campaign missing here is unknown, not 0, and `hidden` can come out below 0.
- Weekly reports come out on Fridays, for Monday to Sunday before; monthly ones on the 5th. Daily data is
  the dates of the last --days; weekly and monthly, the reports out in the last --days, and always the
  newest, so a daily run keeps the last week and month in the file.

Standard library only, plus PyJWT through today.py. Tests, offline: python3 -B -m unittest discover -s docs/ops
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import sys
import urllib.parse
import urllib.request
from typing import Iterator

sys.dont_write_bytecode = True  # importing today.py must leave no __pycache__ in the main checkout
import today  # noqa: E402  where .studio/ops is, the Sales key's tokens, write_json

API = "https://api.appstoreconnect.apple.com"
REQUEST_ID = "aab01b37-1c1b-4b92-8334-446f08ebae4a"  # Paper Coach's ONGOING analytics report request
APP_ID = today.APP_ID
FILE = "acquisition.json"
GRANULARITIES = ("DAILY", "WEEKLY", "MONTHLY")
PROVISIONAL_DAYS = 3  # Apple completes downloads within 2 days, discovery and engagement within 3

# The reports, by the names Apple gives them (their ids are r<N>-<request>: r3, r4, r14, r15 and r13).
REPORTS = {
    "downloadsStandard": "App Downloads Standard",
    "downloads": "App Downloads Detailed",
    "discoveryStandard": "App Store Discovery and Engagement Standard",
    "discovery": "App Store Discovery and Engagement Detailed",
    "purchases": "App Store Purchases Detailed",
}
STANDARD = ("downloadsStandard", "discoveryStandard")
DETAILED = ("downloads", "discovery", "purchases")

METRICS = ("pageViews", "getTaps", "firstDownloads", "redownloads", "purchases", "proceedsUsd")
COMPARED = ("pageViews", "getTaps", "firstDownloads", "redownloads")  # in both the Standard and the Detailed reports
PAGES = ("product page", "store sheet")  # the app's own page; not its privacy, version history or media pages
REFERRERS = ("app referrer", "web referrer")
NONE = "(none)"

# A platform's campaigns all start with its name: Pinterest is pinterest, pinterest-steps, pinterest-news and
# pinterest-profile. X's start with "x-", so that no other word lands there.
PLATFORMS = {
    "pinterest": "pinterest",
    "tiktok": "tiktok",
    "instagram": "instagram",
    "facebook": "facebook",
    "youtube": "youtube",
    "threads": "threads",
    "x": "x-",
    "app-share": "app-share",
}


# ---------------------------------------------------------------- App Store Connect


def api_pages(path: str) -> Iterator[list[dict]]:
    """Each page of a list, following links.next, read with the Sales and Reports key."""
    while path:
        page = today.asc_get(path.removeprefix(API), role="sales")
        yield page.get("data", [])
        path = (page.get("links") or {}).get("next")


def api_all(path: str) -> list[dict]:
    return [item for page in api_pages(path) for item in page]


def download(url: str) -> bytes:
    """A segment's pre-signed URL: it takes no Authorization header and expires in 300 seconds."""
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()


def report_ids() -> dict[str, str | None]:
    found = api_all(f"/v1/analyticsReportRequests/{REQUEST_ID}/reports?limit=200")
    by_name = {item["attributes"]["name"].lower(): item["id"] for item in found}
    return {key: by_name.get(name.lower()) for key, name in REPORTS.items()}


def instances(report_id: str, granularity: str) -> list[dict]:
    query = urllib.parse.urlencode({"filter[granularity]": granularity, "limit": 200})
    return api_all(f"/v1/analyticsReports/{report_id}/instances?{query}")


def instance_rows(instance_id: str) -> list[dict]:
    """Every row of every segment of an instance. Each page's segments are fetched as soon as the page
    arrives, before their links expire."""
    rows = []
    for page in api_pages(f"/v1/analyticsReportInstances/{instance_id}/segments"):
        for segment in page:
            attributes = segment["attributes"]
            raw = download(attributes["url"])
            if attributes.get("checksum") and hashlib.md5(raw).hexdigest() != attributes["checksum"]:
                raise RuntimeError(f"segment {segment['id']}: checksum does not match")
            rows += parse_segment(raw)
    return rows


# ---------------------------------------------------------------- reading the reports


def parse_segment(raw: bytes) -> list[dict]:
    """A segment: gzip'd, tab-separated, with a header of its own. Column names come back in lower case."""
    text = gzip.decompress(raw).decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text), delimiter="\t", quoting=csv.QUOTE_NONE)
    header = [name.strip().lower() for name in next(reader, [])]
    return [dict(zip(header, (value.strip() for value in line))) for line in reader if any(line)]


def chosen(found: list[dict], granularity: str, since: dt.date) -> list[dict]:
    """The instances to read: those processed since `since`; for weekly and monthly reports, at least the newest."""
    found = sorted(found, key=lambda item: item["attributes"]["processingDate"])
    recent = [item for item in found if item["attributes"]["processingDate"][:10] >= since.isoformat()]
    if not recent and granularity != "DAILY":
        recent = found[-1:]
    return recent


def newest_by_date(batches: list[tuple[str, list[dict]]]) -> dict[str, tuple[str, list[dict]]]:
    """Date -> (processingDate, rows) of Paper Coach's rows, from the newest instance that has the Date.

    A later instance restates earlier Dates until they are complete, so rows of one Date from two instances
    are never added up (Apple, *Data completeness and corrections*). Of two with the same processingDate, the
    one listed later wins."""
    newest: dict[str, tuple[str, list[dict]]] = {}
    for processed, rows in sorted(batches, key=lambda batch: batch[0]):
        by_date: dict[str, list[dict]] = {}
        for row in rows:
            if row.get("app apple identifier") == APP_ID:
                by_date.setdefault(row.get("date", ""), []).append(row)
        for date, dated in by_date.items():
            if date not in newest or processed >= newest[date][0]:
                newest[date] = (processed, dated)
    return newest


def number(row: dict, column: str) -> float:
    try:
        return float(row.get(column) or 0)
    except ValueError:
        return 0


def measures(report: str, row: dict) -> dict[str, float]:
    """What one row adds up to. Values are compared in lower case: the files say "First-time download"
    and "No page" where Apple's documentation says "First-time Download" and "No Page"."""
    if report in ("downloads", "downloadsStandard"):
        kind = row.get("download type", "").lower()
        metric = {"first-time download": "firstDownloads", "redownload": "redownloads"}.get(kind)
        return {metric: number(row, "counts")} if metric else {}  # updates and restores are not acquisition
    if report in ("discovery", "discoveryStandard"):
        event = row.get("event", "").lower()
        if event == "page view" and row.get("page type", "").lower() in PAGES:
            return {"pageViews": number(row, "counts")}
        if event == "tap" and row.get("engagement type", "").lower() == "get":
            return {"getTaps": number(row, "counts")}
        return {}
    if report == "purchases":  # a refund is a negative purchase
        return {"purchases": number(row, "purchases"), "proceedsUsd": number(row, "proceeds in usd")}
    return {}


def label(value: str | None) -> str:
    value = (value or "").strip()
    return NONE if value.lower() in ("", "null", "none") else value


def rounded(sums: dict[str, float], metrics: tuple[str, ...]) -> dict[str, float]:
    """Counts as whole numbers (Apple's are), dollars to the cent; 0 for a metric with no rows."""
    return {metric: round(sums.get(metric, 0), 2 if metric == "proceedsUsd" else None) for metric in metrics}


def tally(entries: list[tuple[tuple[str, ...], dict]], fields: tuple[str, ...], metrics: tuple[str, ...]) -> list[dict]:
    """Metrics added up per key, most first-time downloads first. A key's words are compared in lower case and
    shown as first seen; a key with nothing of ours (impressions only, say) is left out."""
    groups: dict[tuple[str, ...], tuple[tuple[str, ...], dict]] = {}
    for key, values in entries:
        if not values:
            continue
        _, sums = groups.setdefault(tuple(part.lower() for part in key), (key, {}))
        for metric, value in values.items():
            sums[metric] = sums.get(metric, 0) + value
    rows = [{**dict(zip(fields, key)), **rounded(sums, metrics)} for key, sums in groups.values()]
    return sorted(rows, key=lambda row: (-row["firstDownloads"], -row["pageViews"], [row[f].lower() for f in fields]))


def platform_of(campaign: str) -> str | None:
    word = campaign.lower()
    for name, prefix in PLATFORMS.items():
        if word == name or word.startswith(prefix):
            return name
    return None


def period_end(granularity: str, start: dt.date) -> dt.date:
    if granularity == "WEEKLY":
        return start + dt.timedelta(days=6)
    if granularity == "MONTHLY":
        return (start.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)
    return start


def period(granularity: str, date: str, rows: dict[str, list[dict]], processed: dict[str, str], as_of: dt.date) -> dict:
    """One Date of one granularity: the Standard totals, the Detailed rows by campaign, referrer and platform,
    and how much of the total the Detailed rows leave out."""
    standard = [(report, row) for report in STANDARD for row in rows.get(report, [])]
    detailed = [(report, row) for report in DETAILED for row in rows.get(report, [])]

    totals: dict[str, float] = {}
    for report, row in standard:
        for metric, value in measures(report, row).items():
            totals[metric] = totals.get(metric, 0) + value
    total = rounded(totals, COMPARED)
    source_types = tally(
        [((label(row.get("source type")),), measures(report, row)) for report, row in standard],
        ("sourceType",),
        COMPARED,
    )

    campaigns = tally(
        [((label(row.get("campaign")).lower(),), measures(report, row)) for report, row in detailed],
        ("campaign",),
        METRICS,
    )
    referrers = tally(
        [
            ((label(row.get("source type")), label(row.get("source info"))), measures(report, row))
            for report, row in detailed
            if row.get("source type", "").lower() in REFERRERS
        ],
        ("sourceType", "sourceInfo"),
        METRICS,
    )
    platforms = []
    for name in PLATFORMS:
        mine = [campaign for campaign in campaigns if platform_of(campaign["campaign"]) == name]
        if mine:
            sums = {metric: sum(campaign[metric] for campaign in mine) for metric in METRICS}
            names = [campaign["campaign"] for campaign in mine]
            platforms.append({"platform": name, "campaigns": names, **rounded(sums, METRICS)})

    hidden = {}
    for metric in COMPARED:
        seen = sum(campaign[metric] for campaign in campaigns)
        share = (total[metric] - seen) / total[metric] if total[metric] else None
        hidden[metric] = {
            "standard": total[metric],
            "detailed": seen,
            "hidden": total[metric] - seen,
            "share": round(share, 2) if share is not None else None,
        }

    try:
        start = dt.date.fromisoformat(date)
    except ValueError:  # not a date: kept as it came, never provisional
        start = None
    return {
        "date": date,
        "end": period_end(granularity, start).isoformat() if start else date,
        "provisional": bool(start and granularity == "DAILY" and start >= as_of - dt.timedelta(days=PROVISIONAL_DAYS)),
        "processed": {report: processed[report] for report in REPORTS if report in processed},
        "total": total,
        "sourceTypes": source_types,
        "hidden": hidden,
        "campaigns": campaigns,
        "platforms": platforms,
        "referrers": referrers,
    }


# ---------------------------------------------------------------- the pull


def collect(days: int, granularities: tuple[str, ...], as_of: dt.date) -> dict:
    since = as_of - dt.timedelta(days=days)
    result = {
        "collected": today.now().isoformat(),
        "app": APP_ID,
        "request": REQUEST_ID,
        "days": days,
        "since": since.isoformat(),
        "reports": {},
        "periods": {},
        "errors": [],
    }
    ids = report_ids()
    for report, report_id in ids.items():
        result["reports"][report] = {"name": REPORTS[report], "id": report_id}
        if not report_id:
            result["errors"].append(f"{REPORTS[report]}: not in report request {REQUEST_ID}")
    for granularity in granularities:
        dated: dict[str, dict[str, list[dict]]] = {}  # Date -> report -> rows
        processed: dict[str, dict[str, str]] = {}  # Date -> report -> the processingDate its rows come from
        for report, report_id in ids.items():
            if not report_id:
                continue
            try:
                picked = chosen(instances(report_id, granularity), granularity, since)
                batches = [(item["attributes"]["processingDate"][:10], instance_rows(item["id"])) for item in picked]
                newest = newest_by_date(batches)
            except Exception as error:  # a report that fails is reported, and the rest still run
                result["errors"].append(f"{REPORTS[report]}, {granularity.lower()}: {error}")
                continue
            result["reports"][report][granularity] = [item["attributes"]["processingDate"][:10] for item in picked]
            for date, (when, rows) in newest.items():
                if granularity == "DAILY" and date < since.isoformat():
                    continue
                dated.setdefault(date, {})[report] = rows
                processed.setdefault(date, {})[report] = when
        result["periods"][granularity] = [
            period(granularity, date, dated[date], processed[date], as_of) for date in sorted(dated)
        ]
    return result


# ---------------------------------------------------------------- the summary


def heading(granularity: str, date: str) -> str:
    if granularity == "WEEKLY":
        return f"Week of {today.short_day(date)}"
    if granularity == "MONTHLY":
        try:
            return f"{dt.date.fromisoformat(date):%B %Y}"
        except ValueError:
            return date
    return today.short_day(date)


def listing(rows: list[dict], name, limit: int = 5) -> str:
    parts = [
        f"{name(row)} {row['pageViews']} views, {row['getTaps']} Get, {row['firstDownloads']} downloads"
        + (f", {row['purchases']} bought" if row["purchases"] else "")
        for row in rows[:limit]
    ]
    return "; ".join(parts) + (f"; and {len(rows) - limit} more" if len(rows) > limit else "")


def summary(result: dict) -> str:
    lines = [f"App Store acquisition, Paper Coach, read {result['collected'][:16].replace('T', ' ')}"]
    titles = {
        "DAILY": f"Daily since {today.short_day(result['since'])} (* provisional)",
        "WEEKLY": "Weekly, Monday to Sunday (out on Fridays)",
        "MONTHLY": "Monthly (out on the 5th)",
    }
    for granularity, periods in result["periods"].items():
        if not periods:
            lines.append(f"{titles[granularity]}: no report out yet.")
            continue
        lines.append(f"{titles[granularity]}:")
        for entry in periods:
            total, hidden = entry["total"], entry["hidden"]
            links = sum(
                source["firstDownloads"] for source in entry["sourceTypes"] if source["sourceType"].lower() in REFERRERS
            )
            sources = ", ".join(
                f"{source['sourceType']} {source['firstDownloads']}"
                for source in entry["sourceTypes"]
                if source["firstDownloads"]
            )
            lines.append(
                f"  {heading(granularity, entry['date'])}{'*' if entry['provisional'] else ''}: "
                f"{total['firstDownloads']} first downloads, {total['redownloads']} redownloads, "
                f"{total['pageViews']} page views, {total['getTaps']} Get taps"
                + (f" ({sources})" if sources else "")
            )
            lines.append(
                f"    from links (app and web referrers): {links} downloads; not in campaign rows: "
                f"{hidden['firstDownloads']['hidden']} of {total['firstDownloads']} downloads, "
                f"{hidden['pageViews']['hidden']} of {total['pageViews']} page views"
            )
            if entry["platforms"]:
                lines.append("    platforms: " + listing(entry["platforms"], lambda row: row["platform"]))
            named = [campaign for campaign in entry["campaigns"] if campaign["campaign"] != NONE]
            if named and granularity != "DAILY":
                lines.append("    campaigns: " + listing(named, lambda row: row["campaign"]))
            if entry["referrers"] and granularity != "DAILY":
                lines.append("    referrers: " + listing(entry["referrers"], lambda row: row["sourceInfo"]))
    for error in result["errors"]:
        lines.append(f"Error: {error}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="acquisition.py",
        description="Paper Coach's App Store page views, Get taps and downloads per source, campaign and referrer, "
        f"into {today.OPS / FILE}.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=10,
        help="daily: the dates of the last N days; weekly and monthly: the reports out in the last N days, "
        "and always the newest (default 10)",
    )
    parser.add_argument(
        "--granularity",
        type=str.upper,
        choices=[*GRANULARITIES, "ALL"],
        default="ALL",
        metavar="DAILY|WEEKLY|MONTHLY|all",
        help="which reports to read (default all)",
    )
    parser.add_argument("--json", action="store_true", help="print the JSON written, instead of the summary")
    args = parser.parse_args(argv)
    if args.days < 1:
        parser.error("--days must be at least 1")
    granularities = GRANULARITIES if args.granularity == "ALL" else (args.granularity,)
    try:
        result = collect(args.days, granularities, today.now().date())
    except Exception as error:  # App Store Connect not reached: the last file stays as it was
        print(f"acquisition.py: App Store Connect not read ({error}); {FILE} left as it was", file=sys.stderr)
        return 1
    today.write_json(FILE, result)
    print(json.dumps(result, indent=2, ensure_ascii=False) if args.json else summary(result))
    if not args.json:
        print(f"\nWritten to {today.OPS / FILE}")
    return 1 if result["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
