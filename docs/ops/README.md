# Running Paper Coach

Since 2026-09-27 Claude runs Paper Coach day to day: it watches how learners use the app, keeps the
paywall A/B tests and Apple Ads going, answers reviews, and fixes and ships what Apple rejects or
learners report. Kevin builds features. This file is the agreement and the runbook; every session and
every scheduled run follows it.

## Who does what

**Claude, on its own, and says so in the log and the daily summary:**

- **Apple rejections:** read the message, fix the app, the metadata or the review notes, and resubmit
  the same day.
- **Bugs a user reported** (an App Store review, or anything Kevin passes on): fix, ship a 1.0.x, and
  submit it without asking. A **serious crash seen in the data** counts as reported: at launch, in the
  drawing player, or while buying. Smaller crashes go to Kevin with a diagnosis.
- **Crash and hang reports** (MetricKit to PostHog, from 1.0.1): read every day, symbolicate, and
  sort them by the rule above.
- **App Store reviews:** reply to every written review within a day (see *Replying to reviews*).
- **Paywall A/B tests (Superwall):** add and remove variants, change the splits, end a test and keep
  the winner, all by the rules under *A/B tests*.
- **Apple Ads:** keywords, bids, excluded keywords, pausing, the daily cap and the countries, by the
  budget rule under *Apple Ads*.
- **ASO:** promotional text at any time. Keywords, subtitle and description go out with the next
  version Claude submits.
- **PostHog:** dashboards, insights, cohorts, alerts.
- **The Studio Today page** and the daily summary.

**Kevin, in his own sessions:** new features, bugs nobody reported, and performance work. Claude only
*suggests* these, in the summary or under "Needs you". **Claude never builds or submits a feature
release unless Kevin asks.**

**Always Kevin's decision:** prices, trial length, new products or subscription groups, the app name
and icon, and anything that changes what Premium includes.

## A day

| When (Central) | What | How |
|---|---|---|
| 08:00 | **Daily check** and summary | scheduled task `paper-coach-daily` |
| 12:00, 16:00, 20:00, 00:00 | **Heartbeat**: review state, new reviews | scheduled task `paper-coach-heartbeat` |
| whenever something happens | a log line, the page republished | `today.py log "…"` in a session; a scheduled run adds to `addLog` in `notes.json` instead |

The tasks run on this Mac (`m4-1`, which never sleeps) while the Claude app is open; a run that was
due while it was closed happens on the next launch. When one finishes it notifies the session that
created it, which passes anything urgent to Kevin's phone.

**The daily check:**

1. `python3 docs/ops/today.py check`, then `collect`. Read `facts.json`'s errors first.
2. PostHog (MCP, project 629055): run the dashboard
   [Paper Coach: how it's going](https://us.posthog.com/project/629055/dashboard/2140277)
   (`dashboard-insights-run 2140277`) and read every tile. Look for crashes (`app_crashed`,
   `app_hung`), a drop anywhere in the onboarding funnel, and a lesson with a low share finished.
3. Act by *Who does what*: a rejection, a reported bug or a serious crash comes first.
4. Reviews: reply to anything unanswered.
5. A/B tests and Apple Ads: apply their rules; record every change in the log.
6. Write `.studio/ops/notes.json` (headline, needsYou, working, PostHog numbers, experiment results,
   ads notes, next run), then `today.py publish` and `today.py archive`.
7. Finish with a summary of at most five lines: what changed, what Claude did, and what needs Kevin.

**The heartbeat** runs `today.py check` and stops there if nothing changed. A rejection, an approval
or a new review is handled the same way the daily check would handle it.

## The Today page and its files

`http://m4-1.tail958ea4.ts.net:5173/#/today` (tailnet only). The page reads `.studio/ops/` in the
main checkout, whichever worktree ran the script:

| File | Written by | What |
|---|---|---|
| `facts.json` | `collect` | App Store Connect versions and review, reviews, rating, sales, Apple Ads, Superwall tests |
| `notes.json` | Claude, by hand | headline, `needsYou`, `working`, `numbers` (PostHog), experiment and ads notes, `next` |
| `log.jsonl` | `log` | one line per thing done, never edited or deleted |
| `state.json` | `check` | what the last check saw, to tell what changed |
| `status.json` | `publish` | what the page shows (`web/src/studio/today.ts` has the shape) |
| `history/` | `publish`, `archive` | a worktree of the branch **`ops-history`**: each day's status as it stood at its end, and `log.jsonl`. **Never delete anything here.** `archive` pushes it to GitHub; the page shows any day at `#/today/YYYY-MM-DD` |

**Scheduled runs and approvals.** An unattended run stops whenever a command doesn't match an approval exactly,
so the scheduled tasks read files with the Read tool, run only `today.py check`, `collect`, `publish` and `archive`
(exactly as written), and log by adding lines to `addLog` in `notes.json`, which `publish` moves into
`log.jsonl`. Anything else (a fix, an ads change) may wait for Kevin's approval; the run says so in its summary.

`notes.json` numbers replace a collected number of the same label. Keep the headline to two
sentences, and "Needs you" to what only Kevin can do.

## Shipping a fix

1. **Start from what is on sale**, not from `main`, so Kevin's unfinished work never ships:
   `git worktree add ../stroketutor-release-<version> -b release/<version> '<version>(<build>)'`,
   using the tag of the version on sale. Before the first approval there is no tag: branch from the
   commit the build in review was archived from (1.0 (2) is `afa25bc`; `release/1.0.1` already is).
2. Fix, add a test that fails without the fix, and run the whole suite. Bump `MARKETING_VERSION`
   (1.0.x) and `CURRENT_PROJECT_VERSION`.
3. Take the App Store screenshots again if the fix changes what one of them shows (CLAUDE.md).
4. Archive Release into Xcode's standard folder (`~/Library/Developer/Xcode/Archives`), where it
   stays: its dSYM is what symbolicates crash reports. Export with manual signing and the profile
   **Paper Coach App Store**. The App Manager key can't use cloud signing
   (`docs/handoff-2026-09-26-release.md`). Upload with the App Manager key.
5. App Store Connect: create the version, attach the build, and write "What's new" in plain words.
   Check that App Privacy still matches `PaperCoach/PrivacyInfo.xcprivacy` (there is no API for App
   Privacy; if it needs a new row, that goes under "Needs you" before submitting). Turn **phased
   release** on. Submit through a review submission.
6. Merge the release branch into `main` and push both.
7. **When Apple approves a build**, tag its commit `<version>(<build>)`, for example `1.0(2)`, and
   push the tag. Only approved builds are tagged.
8. If Kevin has a version of his own open in App Store Connect (Apple allows one at a time), ask him
   before touching it.

**A rejection:** the message is in App Store Connect's review details (open it in Chrome if the API
doesn't carry it). Fix what it names, answer in the review notes, resubmit, and log it. Anything
already learned about Apple's rules lives in `docs/app-store/listing.md`.

**Symbolicating a crash:** `app_frame` is `PaperCoach+0x<offset>`. With the archive of the build that
crashed (`crashed_app_build`):

```bash
DSYM=~/Library/Developer/Xcode/Archives/<date>/<archive>.xcarchive/dSYMs/PaperCoach.app.dSYM
atos -arch arm64 -o "$DSYM/Contents/Resources/DWARF/PaperCoach" -l 0x100000000 0x$(printf '%x' $((0x100000000 + 0x<offset>)))
```

## A/B tests

- Superwall runs them, for learners 13 and over only. Children see the app's own paywall, which no
  test reaches; changing that is app work, so it is a proposal to Kevin.
- **Judge by purchases (and trials that turn paid) per paywall open**, never by taps.
- **Keep a test running** until every variant has at least 300 opens, *and* either Superwall's
  campaign analysis gives one variant a 95% chance to be best, or one variant has at least twice the
  purchases per open of another with at least 20 purchases between them. Then keep the winner at
  100% and start the next test.
- The onboarding test starts with three designs. Once each has about 150 opens, drop any variant
  clearly behind, so the others learn faster.
- Test big differences first (layout, a gift page or none, plans up front or behind a drawer)
  before wording.
- **Every paywall obeys Apple's billed-amount rule** (Guideline 3.1.2(c)): the amount billed is the
  most prominent price, and the buy button names it. The Superwall handoff's decisions still hold:
  "Continue with free lessons" on every page, no hidden exit, nothing from Drawing Desk's playbook.
- **Never put a product on a paywall that the build on sale doesn't count as Premium**
  (`PremiumStore.ProductID.all` until docs/next-builds.md item 1 ships): the buyer would be charged and get nothing.
- Record every change in the log with its reason.

## Apple Ads

- Through Superwall's proxy: `superwall asa … --app 54792` (GeoBlitz's connection reaches the
  Softroni LLC org, 20605790, pay as you go). Paper Coach is adam id `6816231257`; Apple Ads can't see
  it until it is on sale.
- **Start:** US only, **$10 a day** across the campaigns, the day 1.0 is approved, as
  [apple-ads-plan.md](apple-ads-plan.md) lays out.
- **Budget rule:** total ad spend stays at or below **$150 plus the proceeds from learners the ads
  brought** (after Apple's cut). Until trials have had time to turn paid, count a trial at the
  trial-to-paid rate actually seen, or not at all while there is none.
- **Move the daily cap by at most 25% a week.** Raise it while the last 14 days of ads paid for
  themselves; lower it when they didn't. When the ceiling is reached, stop until proceeds catch up.
- Pause a keyword that has spent $15 with no trial or purchase; add search terms that don't fit as
  excluded keywords. New English-speaking storefronts once the US pays for itself.
- PostHog: `install_attributed` and the `asa_*` keys on onboarding, trial and purchase events join
  installs to keywords (filter out `asa_test_payload`).

## Replying to reviews

- Warm, short and specific to what the person wrote, signed "the Paper Coach team". Thank them for
  a good review in a sentence, not a paragraph.
- A problem: say what we're doing about it, never a date. Once a fix ships, edit the reply to say so.
- Children use the app: never ask for an email, a name or any personal detail in a reply.
- Never argue, never offer refunds (Apple handles those; point to reportaproblem.apple.com).

## Where everything is

| What | Where |
|---|---|
| App Store Connect | app `6816231257`, SKU `papercouch`, team PLQFG9VC25; keys in `~/.appstoreconnect/config` (App Manager, and Sales and Reports) |
| App Store analytics reports | request `aab01b37-1c1b-4b92-8334-446f08ebae4a` (Sales key reads it) |
| Superwall | project 42098, app 56531; campaigns Onboarding offer 109312, In-app Premium 109313 |
| PostHog | project 629055; dashboard 2140277 |
| Apple Ads | org 20605790, through `superwall asa --app 54792` |
| Handoffs | `docs/handoff-2026-09-25-superwall.md`, `docs/handoff-2026-09-26-release.md` |
