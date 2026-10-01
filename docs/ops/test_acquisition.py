"""acquisition.py's reading and adding up, offline, on a small fixture shaped like Apple's files.

    python3 -B -m unittest discover -s docs/ops
"""

from __future__ import annotations

import codecs
import contextlib
import datetime as dt
import gzip
import hashlib
import io
import json
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True
import acquisition  # noqa: E402
import today  # noqa: E402

APP = acquisition.APP_ID
AS_OF = dt.date(2026, 10, 1)
DAY = "2026-09-29"


def row(*values) -> str:
    return "\t".join(str(value) for value in values)


def ours(*values, date: str = DAY) -> str:
    """A row of Paper Coach's: Date, App Name and App Apple Identifier, then the values."""
    return row(date, "Paper Coach", APP, *values)


def tsv(header: str, *rows: str) -> list[dict]:
    """Rows as acquisition.parse_segment returns them."""
    return acquisition.parse_segment(gzip.compress(("\n".join([header, *rows]) + "\n").encode()))


# The columns of Apple's files, a few left out.
FIRST = ("Date", "App Name", "App Apple Identifier")
DOWNLOADS_STANDARD = row(*FIRST, "Download Type", "Device", "Source Type", "Page Type", "Territory", "Counts")
DOWNLOADS = row(
    *FIRST, "Download Type", "Device", "Source Type", "Source Info", "Campaign", "Page Type", "Territory", "Counts"
)
DISCOVERY_STANDARD = row(
    *FIRST, "Event", "Page Type", "Source Type", "Engagement Type", "Territory", "Counts", "Unique Counts"
)
DISCOVERY = row(
    *FIRST,
    "Event",
    "Page Type",
    "Source Type",
    "Source Info",
    "Campaign",
    "Engagement Type",
    "Territory",
    "Counts",
    "Unique Counts",
)
PURCHASES = row(
    *FIRST,
    "Purchase Type",
    "Source Type",
    "Source Info",
    "Campaign",
    "Territory",
    "Purchases",
    "Proceeds in USD",
    "Sales in USD",
    "Paying Users",
)

# One day in every report. The Standard reports count everything; the Detailed ones only what Apple did not
# hold back, so their sums fall short of the totals. Apple's spelling of values varies; so does this.
ONE_DAY = {
    "downloadsStandard": tsv(
        DOWNLOADS_STANDARD,
        ours("First-time download", "iPhone", "App Store browse", "No page", "US", 1),
        ours("First-time Download", "iPhone", "Web referrer", "Product page", "US", 2),
        ours("first-time download", "iPad", "App referrer", "Store sheet", "GB", 1),
        ours("Redownload", "iPhone", "App Store browse", "No page", "US", 1),
        ours("Manual update", "iPhone", "App Store browse", "No page", "US", 7),
    ),
    "discoveryStandard": tsv(
        DISCOVERY_STANDARD,
        ours("Page view", "Product page", "Web referrer", "", "US", 6, 5),
        ours("Page view", "Product page", "App Store browse", "", "US", 4, 4),
        ours("Page view", "App privacy", "App Store browse", "", "US", 3, 3),
        ours("Impression", "No page", "App Store search", "", "US", 50, 40),
        ours("Tap", "Product page", "App Store browse", "Get", "US", 5, 5),
    ),
    "downloads": tsv(
        DOWNLOADS,
        ours("First-time download", "iPhone", "Web referrer", "softroni.com", "Pinterest", "Product page", "US", 1),
        ours("First-time download", "iPhone", "Web referrer", "SOFTRONI.COM", "pinterest", "Product page", "US", 1),
        ours("Redownload", "iPhone", "App Store browse", "", "", "No page", "US", 1),
    ),
    "discovery": tsv(
        DISCOVERY,
        ours("Page view", "Store sheet", "App referrer", "TikTok", "tiktok-bio", "", "US", 4, 4),
        ours("Tap", "Store sheet", "App referrer", "TikTok", "tiktok-bio", "Get", "US", 2, 2),
        ours("Page view", "Product page", "Web referrer", "softroni.com", "x-bio", "", "US", 2, 2),
        ours("Page view", "Product page", "App referrer", "Messages", "app-share-saved", "", "US", 1, 1),
        ours("Page view", "Product page", "Web referrer", "example.com", "xylophone", "", "US", 1, 1),
        ours("Impression", "No page", "App referrer", "TikTok", "tiktok-bio", "", "US", 30, 20),
    ),
    "purchases": tsv(
        PURCHASES,
        ours("In-app purchases", "Web referrer", "softroni.com", "pinterest", "US", 1, 20.99, 29.99, 1),
    ),
}


def metrics(**values) -> dict:
    return {**dict.fromkeys(acquisition.METRICS, 0), **values}


def first_download(date: str, count: int, source: str = "App Store browse", app: str = APP) -> str:
    return row(date, "Paper Coach", app, "First-time download", "iPhone", source, "", "", "No page", "US", count)


class Reading(unittest.TestCase):
    def test_a_segment_is_gzip_tsv_with_its_own_header(self):
        text = (
            "Date\tApp Apple Identifier\tPage Title\tCounts\n"
            '2026-09-30\t6816231257\t"Back to school" page\t3\n'
            "2026-09-30\t6816231257\tDefault product page\t 2 \n\n"
        )
        rows = acquisition.parse_segment(gzip.compress(codecs.BOM_UTF8 + text.encode()))
        self.assertEqual(len(rows), 2)
        self.assertEqual(
            rows[0], {"date": "2026-09-30", "app apple identifier": APP, "page title": '"Back to school" page', "counts": "3"}
        )
        self.assertEqual(rows[1]["counts"], "2")

    def test_the_newest_instance_of_a_date_wins_and_instances_are_never_added(self):
        older = tsv(DOWNLOADS, first_download("2026-09-28", 1), first_download("2026-09-29", 1))
        newer = tsv(DOWNLOADS, first_download("2026-09-29", 3), first_download("2026-09-30", 9, app="999"))
        newest = acquisition.newest_by_date([("2026-10-01", newer), ("2026-09-30", older)])
        self.assertEqual(sorted(newest), ["2026-09-28", "2026-09-29"])  # another app's 2026-09-30 is not ours
        self.assertEqual(newest["2026-09-28"][0], "2026-09-30")
        self.assertEqual(newest["2026-09-29"][0], "2026-10-01")
        self.assertEqual([line["counts"] for line in newest["2026-09-29"][1]], ["3"])

    def test_values_are_compared_in_any_case(self):
        measures = acquisition.measures
        self.assertEqual(measures("downloads", {"download type": "FIRST-TIME DOWNLOAD", "counts": "2"}), {"firstDownloads": 2})
        self.assertEqual(measures("downloadsStandard", {"download type": "Auto-update", "counts": "2"}), {})
        self.assertEqual(measures("discovery", {"event": "PAGE VIEW", "page type": "Store Sheet", "counts": "4"}), {"pageViews": 4})
        self.assertEqual(measures("discovery", {"event": "Page view", "page type": "Media view", "counts": "4"}), {})
        self.assertEqual(measures("discovery", {"event": "tap", "engagement type": "GET", "counts": "1"}), {"getTaps": 1})
        self.assertEqual(measures("discovery", {"event": "Tap", "engagement type": "Open", "counts": "1"}), {})
        refund = measures("purchases", {"purchases": "-1", "proceeds in usd": "-20.99"})
        self.assertEqual(refund, {"purchases": -1, "proceedsUsd": -20.99})

    def test_platforms_are_campaign_prefixes(self):
        self.assertEqual(acquisition.platform_of("pinterest-steps"), "pinterest")
        self.assertEqual(acquisition.platform_of("TikTok-Bio"), "tiktok")
        self.assertEqual(acquisition.platform_of("x-bio"), "x")
        self.assertEqual(acquisition.platform_of("app-share-sketchbook-bar"), "app-share")
        self.assertIsNone(acquisition.platform_of("xylophone"))
        self.assertIsNone(acquisition.platform_of("(none)"))

    def test_which_instances_are_read(self):
        def instance(day):
            return {"id": day, "attributes": {"processingDate": day}}

        found = [instance("2026-09-18"), instance("2026-09-30"), instance("2026-09-25")]
        since = dt.date(2026, 9, 26)
        self.assertEqual([item["id"] for item in acquisition.chosen(found, "DAILY", since)], ["2026-09-30"])
        old = found[:1] + found[2:]
        self.assertEqual(acquisition.chosen(old, "DAILY", since), [])
        self.assertEqual([item["id"] for item in acquisition.chosen(old, "WEEKLY", since)], ["2026-09-25"])  # the newest
        self.assertEqual(acquisition.chosen([], "MONTHLY", since), [])


class AddingUp(unittest.TestCase):
    def setUp(self):
        self.day = acquisition.period("DAILY", DAY, ONE_DAY, {"downloadsStandard": "2026-10-01"}, AS_OF)

    def test_totals_by_source_type_come_from_the_standard_reports(self):
        self.assertEqual(self.day["total"], {"pageViews": 10, "getTaps": 5, "firstDownloads": 4, "redownloads": 1})
        by_type = {source["sourceType"]: source for source in self.day["sourceTypes"]}
        self.assertEqual(list(by_type), ["Web referrer", "App Store browse", "App referrer"])  # most downloads first
        self.assertEqual(
            by_type["App Store browse"],
            {"sourceType": "App Store browse", "pageViews": 4, "getTaps": 5, "firstDownloads": 1, "redownloads": 1},
        )
        self.assertNotIn("App Store search", by_type)  # impressions only: nothing it counts

    def test_campaigns_from_the_detailed_reports(self):
        campaigns = {campaign["campaign"]: campaign for campaign in self.day["campaigns"]}
        self.assertEqual(
            campaigns["pinterest"], {"campaign": "pinterest", **metrics(firstDownloads=2, purchases=1, proceedsUsd=20.99)}
        )
        self.assertEqual(campaigns["(none)"], {"campaign": "(none)", **metrics(redownloads=1)})
        self.assertEqual(campaigns["tiktok-bio"], {"campaign": "tiktok-bio", **metrics(pageViews=4, getTaps=2)})
        self.assertEqual(self.day["campaigns"][0]["campaign"], "pinterest")

    def test_referrers_are_app_and_web_only(self):
        self.assertEqual(
            [(referrer["sourceType"], referrer["sourceInfo"]) for referrer in self.day["referrers"]],
            [
                ("Web referrer", "softroni.com"),
                ("App referrer", "TikTok"),
                ("App referrer", "Messages"),
                ("Web referrer", "example.com"),
            ],
        )
        self.assertEqual(
            self.day["referrers"][0],
            {
                "sourceType": "Web referrer",
                "sourceInfo": "softroni.com",
                **metrics(pageViews=2, firstDownloads=2, purchases=1, proceedsUsd=20.99),
            },
        )

    def test_platforms_add_up_their_campaigns(self):
        platforms = self.day["platforms"]
        self.assertEqual([platform["platform"] for platform in platforms], ["pinterest", "tiktok", "x", "app-share"])
        self.assertEqual(platforms[0]["campaigns"], ["pinterest"])
        self.assertEqual(platforms[1], {"platform": "tiktok", "campaigns": ["tiktok-bio"], **metrics(pageViews=4, getTaps=2)})

    def test_hidden_is_the_standard_total_less_the_detailed_rows(self):
        hidden = self.day["hidden"]
        self.assertEqual(hidden["firstDownloads"], {"standard": 4, "detailed": 2, "hidden": 2, "share": 0.5})
        self.assertEqual(hidden["pageViews"], {"standard": 10, "detailed": 8, "hidden": 2, "share": 0.2})
        self.assertEqual(hidden["redownloads"], {"standard": 1, "detailed": 1, "hidden": 0, "share": 0.0})
        nothing = acquisition.period("DAILY", DAY, {}, {}, AS_OF)["hidden"]["firstDownloads"]
        self.assertEqual(nothing, {"standard": 0, "detailed": 0, "hidden": 0, "share": None})

    def test_the_last_three_days_are_provisional(self):
        for date, provisional in (("2026-09-27", False), ("2026-09-28", True), ("2026-09-30", True)):
            self.assertEqual(acquisition.period("DAILY", date, {}, {}, AS_OF)["provisional"], provisional, date)
        week = acquisition.period("WEEKLY", "2026-09-28", {}, {}, AS_OF)
        self.assertEqual((week["end"], week["provisional"]), ("2026-10-04", False))  # weekly and monthly come complete
        self.assertEqual(acquisition.period("MONTHLY", "2026-02-01", {}, {}, AS_OF)["end"], "2026-02-28")


class FakeAppStoreConnect:
    """Answers today.asc_get and acquisition.download: each instance is one gzip'd segment of DOWNLOADS rows."""

    def __init__(self, reports: dict[str, str], instances: dict[tuple[str, str], list[tuple[str, list[str]]]]):
        self.paths, self.files = {}, {}
        listed = [{"id": rid, "attributes": {"name": name}} for name, rid in reports.items()]
        base = f"/v1/analyticsReportRequests/{acquisition.REQUEST_ID}/reports?limit=200"
        self.paths[base] = {"data": listed[:2], "links": {"next": acquisition.API + base + "&cursor=2"}}  # two pages
        self.paths[base + "&cursor=2"] = {"data": listed[2:], "links": {}}
        for rid in reports.values():
            for granularity in acquisition.GRANULARITIES:
                found = instances.get((rid, granularity), [])
                query = f"filter%5Bgranularity%5D={granularity}&limit=200"
                self.paths[f"/v1/analyticsReports/{rid}/instances?{query}"] = {
                    "data": [{"id": f"{rid}-{granularity}-{day}", "attributes": {"processingDate": day}} for day, _ in found]
                }
                for day, rows in found:
                    url = f"https://s3.example/{rid}-{granularity}-{day}.gz"
                    self.files[url] = gzip.compress(("\n".join([DOWNLOADS, *rows]) + "\n").encode())
                    checksum = hashlib.md5(self.files[url]).hexdigest()
                    self.paths[f"/v1/analyticsReportInstances/{rid}-{granularity}-{day}/segments"] = {
                        "data": [{"id": "s1", "attributes": {"url": url, "checksum": checksum}}]
                    }

    def asc_get(self, path, role="manager", accept="application/json"):
        assert role == "sales" and path.startswith("/v1/"), path
        return self.paths[path]

    def download(self, url):
        return self.files[url]


class Pulling(unittest.TestCase):
    def pull(self, fake, granularities=acquisition.GRANULARITIES):
        with mock.patch.object(today, "asc_get", fake.asc_get), mock.patch.object(acquisition, "download", fake.download):
            return acquisition.collect(10, granularities, AS_OF)

    def test_a_pull_reads_the_newest_rows_of_each_date(self):
        names = list(acquisition.REPORTS.values())[:4]  # no App Store Purchases Detailed in this request
        fake = FakeAppStoreConnect(
            dict(zip(names, ["r3", "r4", "r14", "r15"])),
            {
                ("r3", "DAILY"): [
                    ("2026-09-30", [first_download("2026-09-15", 9), first_download("2026-09-29", 1)]),
                    ("2026-10-01", [first_download("2026-09-29", 2), first_download("2026-09-30", 1, "App Store search")]),
                ],
                ("r3", "WEEKLY"): [
                    ("2026-09-18", [first_download("2026-09-07", 5)]),
                    ("2026-09-25", [first_download("2026-09-14", 7)]),
                ],
            },
        )
        result = self.pull(fake)
        daily = {entry["date"]: entry for entry in result["periods"]["DAILY"]}
        self.assertEqual(list(daily), ["2026-09-29", "2026-09-30"])  # 2026-09-15 is before the 10 days
        self.assertEqual(daily["2026-09-29"]["total"]["firstDownloads"], 2)  # the newer instance's 2, not 1 + 2
        self.assertEqual(daily["2026-09-29"]["processed"], {"downloadsStandard": "2026-10-01"})
        self.assertTrue(daily["2026-09-30"]["provisional"])
        self.assertEqual([entry["date"] for entry in result["periods"]["WEEKLY"]], ["2026-09-14"])  # the newest week
        self.assertEqual(result["periods"]["MONTHLY"], [])
        self.assertEqual(result["reports"]["downloadsStandard"]["DAILY"], ["2026-09-30", "2026-10-01"])
        self.assertEqual(result["errors"], [f"App Store Purchases Detailed: not in report request {acquisition.REQUEST_ID}"])
        json.dumps(result)  # it can be written

    def test_a_report_that_fails_is_reported_and_the_rest_still_run(self):
        fake = FakeAppStoreConnect(
            {name: f"r{index}" for index, name in enumerate(acquisition.REPORTS.values())},
            {
                ("r0", "DAILY"): [("2026-10-01", [first_download("2026-09-30", 1)])],
                ("r1", "DAILY"): [("2026-10-01", [])],
            },
        )
        fake.files["https://s3.example/r1-DAILY-2026-10-01.gz"] = b"changed in transit"
        result = self.pull(fake, granularities=("DAILY",))
        self.assertEqual(result["errors"], ["App Downloads Detailed, daily: segment s1: checksum does not match"])
        self.assertEqual(result["periods"]["DAILY"][0]["total"]["firstDownloads"], 1)


class Output(unittest.TestCase):
    def result(self):
        return {
            "collected": "2026-10-01T13:00:00-05:00",
            "since": "2026-09-21",
            "periods": {
                "DAILY": [acquisition.period("DAILY", DAY, ONE_DAY, {}, AS_OF)],
                "WEEKLY": [acquisition.period("WEEKLY", "2026-09-28", ONE_DAY, {}, AS_OF)],
                "MONTHLY": [],
            },
            "errors": [],
        }

    def test_the_summary_says_what_came_and_what_is_hidden(self):
        text = acquisition.summary(self.result())
        self.assertIn("Sep 29*: 4 first downloads, 1 redownloads, 10 page views, 5 Get taps", text)
        self.assertIn("not in campaign rows: 2 of 4 downloads, 2 of 10 page views", text)
        self.assertIn("Week of Sep 28:", text)
        self.assertIn("pinterest 0 views, 0 Get, 2 downloads, 1 bought", text)
        self.assertIn("Monthly (out on the 5th): no report out yet.", text)
        self.assertLess(len(text.splitlines()), 20)

    def test_main_writes_the_file_and_prints_json(self):
        written = {}
        with mock.patch.object(acquisition, "collect", return_value=self.result()) as collect, mock.patch.object(
            today, "write_json", side_effect=lambda name, value: written.update({name: value})
        ), contextlib.redirect_stdout(io.StringIO()) as out:
            code = acquisition.main(["--granularity", "weekly", "--days", "28", "--json"])
        self.assertEqual(code, 0)
        self.assertEqual(collect.call_args.args[:2], (28, ("WEEKLY",)))
        self.assertEqual(list(written), ["acquisition.json"])
        self.assertEqual(json.loads(out.getvalue()), written["acquisition.json"])


if __name__ == "__main__":
    unittest.main()
