# Social plan: lesson videos for downloads

Agreed with Kevin on 2026-09-30. **The goal is App Store downloads over time**, not followers for their own sake.
How posting works day to day (the tool, settings, the record) is in [README.md](README.md), *Lesson videos on
social*, and the studio-cli skill, *Posting lesson videos*. This file is the plan and **its build status: any
session picks up from the checklist at the end**, and ticks it off in the same commit as the work.

## Picking this up

Nothing here needs a session to keep going. On this Mac (`m4-1`):

- **17:00** the launch agent `com.softroni.papercoach-social` posts the day's lesson (`social next --log`); no
  Claude involved. Installed from [com.softroni.papercoach-social.plist](com.softroni.papercoach-social.plist).
- **17:45** the Claude routine **Paper Coach: Social** checks it, fixes what failed, and does the Monday numbers,
  release news and the dates in *Schedule*. Its prompt is [routines/paper-coach-social.md](routines/paper-coach-social.md);
  the copy the app runs is `~/.claude/scheduled-tasks/paper-coach-social/SKILL.md` (keep the two the same).
- **When that check finishes** it wakes the pinned session **Paper Coach Social Monitor** (Kevin's wish, 2026-10-01).
  That session reads the run (its summary, and its transcript when something failed or looks off) and settles what
  the run couldn't:
  - **A failed or missing run:** the cause, if it is ours (the routine's prompt, in both copies, or the Studio's
    social code). It doesn't redo the run's steps, since the midnight check covers a day the run missed.
  - **A platform that keeps failing:** the cause, fixed or reported.
  - **Captions or the order:** changed when the numbers say so.

  It tells Kevin only what is new and needs him, never what the run already sent; on a quiet evening it says so in
  one line. A routine notifies one session; to move this to another, that session calls `update_scheduled_task`
  for `paper-coach-social` with `notifyOnCompletion: true`.
- **00:00** the daily check does the same on a day the social routine didn't log "Social check:".
- What needs Kevin reaches him as a push notification and under "Needs you" on Today.

To see where things stand: the Studio's **Social** page (`#/social`: every post with its links, and *Coming up*),
`npm run studio -- social check | queue | status` in `web/`, the Today log, and the checklist below.

Outside the repo, on purpose: `~/.config/upload-post/config` (the Upload-Post key, never committed; the other
settings in it are the profile `softroni`, the Facebook Page `1323162717550492`, the provider token `128560181`),
the installed copies of the launch agent and the routine, and `.studio/social/posts.jsonl` (the full record; every
finished post's links are also on the `ops-history` branch, `social/posts.jsonl`). On a new Mac: put the key and
those settings back in the config file, copy and load the launch agent (README.md, *Lesson videos on social*),
recreate the routine from its prompt (daily 5:45 PM, this folder, Bypass permissions), and run `social check`.

## What we post

Every lesson in the version on sale gives, from the Studio, with no one filming anything:

- **The draw-along** (`lessons video`, about a minute): the finished picture, every step with Lina's voice, and
  Paper Coach with the App Store badge at the end.
- **The speed draw** (about 20 s, `lessons video --speed`): the whole picture drawn in 8 s, then the ending. Short videos get watched to the
  end and replayed, which the platforms reward.
- **The step pin** (`social pin <id>`): every step on one 1000 × 1500 image in the path's color (the classic "how
  to draw" picture Pinterest is full of), with the lesson's name and Paper Coach.

## Per platform

| Platform | Priority | How often | What | The link |
|---|---|---|---|---|
| **Pinterest** | 1 | 2 a day | The draw-along as a video pin at 17:00, the step pin of the same lesson at 21:00, on a board per path ("Paper Coach: Plants"…) | **On every pin**, straight to the App Store |
| **TikTok** | 2 | 1 a day; 2 (add the speed draw) once something takes off | The draw-along | Bio |
| **YouTube Shorts** | 3 | 1 a day | The draw-along, "How to draw a ___ step by step #shorts" | Description, channel |
| **Instagram Reels** | 4 | 1 a day, plus 1–2 step posts a week | The draw-along | Bio |
| **Facebook Reels** | 5 | 1 a day | The draw-along (Facebook skews to parents who draw with their kids) | Description |
| **Threads** | 6 | 1 a day | The draw-along with a short caption, topic tag "Drawing" (Threads' one tag a post, for reach beyond followers) | **In the post** (`ct=threads`) and the bio |
| **X** | 7 | 1 a day | The draw-along, for presence | None (Upload-Post strips links) |

**TikTok in detail.** Public, marked as promoting Softroni's own app ("Promotional content", which TikTok asks for)
and as AI-generated (Lina's voice is synthetic). The caption is the export's: what we draw, the path, "link in bio",
seven tags. TikTok judges a new account by watch time, so the first weeks are about posting every day, not
about any one video. Once a video clearly takes off (several times the views of the rest), add its speed draw at
12:00 as a second daily post (`social post <id> --speed --platforms tiktok`) and post that subject's lessons
sooner (`social-up-next.txt`). When TikTok's daily cap is hit it puts the video in the account's inbox,
unpublished; the midnight check sees that and asks Kevin to publish it in the app.

**Threads in detail.** Instagram's text network: the same video, a shorter caption with no hashtags (Threads takes
one topic tag instead), and the App Store link right in the post, where it can be tapped. Low effort, so it stays
daily; the four-week review says whether it earns its place.

**Why Pinterest first:** it is the only platform where every post is one tap from the App Store, "how to draw" is
one of its biggest categories, and a pin keeps being found through search for months. TikTok and Reels bring bigger
bursts of views, but a download there takes bio → link → App Store.

## A day

- **17:00 Central** (launch agent): the next lesson's draw-along to every platform; the step pin scheduled for 21:00.
- **At midnight, the daily check:** read how the post did, re-post a platform that failed, log it on Today.
- **Weekly (Monday's daily check):** Upload-Post analytics per post; subjects that do well (vehicles, food, space…)
  move up by listing lessons in `docs/ops/social-up-next.txt`, which `social next` posts before the queue.
- **Optional, from Kevin, once a week:** 15–20 s filmed on a phone of a hand drawing on paper beside the app. Real
  hands on real paper tend to convert better than animation. Posted to TikTok and Reels with `social post --video`.

## Decisions

- **2026-09-30, Kevin: Premium lessons are posted too, not only the free ones.** The most eye-catching drawings
  (pirate ship, solar system, bonsai, ramen bowl, monster truck, volcano, waterfall) are Premium, while the free
  lessons, the first three of each path, are the simplest (cube, cone, sun, cloud). Watching a lesson isn't what
  people pay for; drawing it themselves with the app, one line at a time, and the whole library is. So a Premium
  video is an advertisement for Premium. How:
  - **Alternate a free lesson and a Premium one, day by day**, from 2026-10-02 (2026-10-01 stays Watermelon
    Slice). A free day says "draw this one now, free"; a Premium day brings the reach and shows what's beyond.
  - **Premium in path order, like the app** (Kevin, 2026-10-01): lesson 4 of every path, then lesson 5, and so
    on, so the feed levels up as the app does and a viewer meets a lesson where it sits. (The first version put
    the most eye-catching first: Pirate Ship, Solar System…; a lesson that does well can still be moved up in
    `docs/ops/social-premium-first.txt`.)
  - **Every Premium post says so plainly**: "Lesson 7 of the On the Water path, in Paper Coach Premium. The app
    is free to download, with 30 free lessons." The video's last words already say "free to download" for a
    Premium lesson; the captions and pins match, so nobody downloads for a lesson and finds it locked unwarned.
  - **Measured** by the Monday numbers (views on Premium days against free days) and PostHog's trials and
    purchases over the weeks; the ratio is revisited at the 2026-10-28 review.

## Schedule

Started 2026-09-30 (Upload-Post Basic, monthly); the first post went out that night at 23:12. Times are Central. The daily check keeps these in "dates coming
up" on the Today page and does what each says on the day.

| When | What | Who |
|---|---|---|
| Every day 17:00, from Thu 2026-10-01 | The next lesson's video to every connected platform; its step pin on Pinterest at 21:00 | launch agent |
| Every day 00:00 | Check the day's post, post once more to a platform that failed, accounts to connect; `acquisition.py` for the App Store's daily totals | daily check |
| Every day, after the post | `social snapshot`: every number per post and account into `metrics.jsonl` | social check |
| Mondays, from 2026-10-05 | `social scorecard`: views, hold, taps per platform on Today; subjects that do well move up | social check |
| Fridays, from 2026-10-09 | App Store Connect's weekly report: page views and downloads per campaign (`acquisition.py`) | social check |
| 2026-10-05 | E1: the new opening becomes the default (*Growth*) | Claude |
| 2026-10-13 | E1 read | Claude |
| 2026-10-14 | E2 starts: the speed draw on TikTok and Reels on B days | Claude |
| 2026-10-15 | E4: winter boards and pins | Claude |
| 2026-10-21 | Seasonal pin numbers to Kevin, for the Christmas-lessons question | Claude |
| 2026-11-05 | October's monthly report from App Store Connect: the first downloads per platform (`acquisition.py`) | Claude |
| 2026-11-12 | Six-week wrap-up of *Growth*, written under *Log* | Claude |
| The day 1.1 goes on sale | `social announce` with the best Around Town lesson; its ten lessons join the queue | daily check |
| 2026-10-28 | Four-week review: downloads per campaign and views per platform, written under *Log*. October's monthly report comes only on Nov 5, so the weekly ones: `acquisition.py --granularity WEEKLY --days 28` | daily check |
| 2026-10-30 | Upload-Post renews monthly ($24) | automatic |
| 2026-11-23 | The two-month write-up under *Log*, and "monthly → yearly, or stop?" under Needs you | daily check |
| Before 2026-11-30 | Kevin decides; the plan renews that day | Kevin |

The order (*Decisions*): `docs/ops/social-up-next.txt` first (Watermelon Slice on 2026-10-01), then a free lesson
and a Premium one by turns, never the same path two days running. Both go in path order: free lessons 1, 2 and 3 of
every path, Premium lessons 4, 5, 6… of every path (anything listed in `social-premium-first.txt` first). So:
Mushroom (Oct 2), Sun, Cherries, Donut, Rain Cloud, Cube, Boba Tea, School Bus… `social queue` and the Studio's
Social page (*Coming up*) show it as it stands.

## Release news

Lessons are the everyday posts; news is for moments worth telling, **at most two or three a month**:

- **A version goes on sale with something people would want** (new lessons, a new path, a new way to draw): the
  day it is live, one announcement to every platform: the speed draw of the best new lesson, with a caption that
  says what's new ("10 new lessons: draw your town, from a bus stop to a skyline"). `social announce`.
- **A new path's lessons** join the daily queue by themselves once their version is on sale (the queue reads the
  catalog of the tagged build on sale).
- **Seasonal:** October, December and summer lessons (a pumpkin, a snowman, an ice-cream stand) would give timely
  posts that get searched a lot. That is new content, so it is Kevin's call; Claude suggests it under "Needs you".
- **Not news:** bug-fix releases, prices, sales numbers. Never announce a version before it is on sale.

## Knowing what works

- **A campaign on every link** (`…?pt=<provider token>&ct=pinterest`), so App Store Connect → Analytics → Sources
  shows where downloads came from. The provider token is `APP_STORE_PROVIDER_TOKEN` in `~/.config/upload-post/config`.
  Posts carry the platform's name (the step pin `pinterest-steps`, release news `<platform>-news`), and each profile
  has its own campaign behind its short softroni.com link (the table under *Checklist*). So **a platform's downloads
  are every campaign starting with its name**: Pinterest is `pinterest`, `pinterest-steps`, `pinterest-news` and
  `pinterest-profile`. TikTok, Instagram and X posts carry no link, so theirs are the profile's alone (`tiktok-bio`…).
- **Apple hides small numbers:** a campaign row under 5 downloads (or 5 devices) is left out, so per-platform
  downloads stay mostly hidden for weeks. Until they show, steer by taps (*Growth*, below).
- **Expect** two or three quiet weeks while new accounts earn trust; the daily rhythm matters more than any post.

## Growth: Claude as social media manager

Since 2026-10-01 (Kevin): Claude runs social to grow the app. It measures what works on each platform, down to
link taps, decides what to post next, and experiments. **Claude decides** formats, openings, captions, tags, timing,
cadence, the order within Kevin's rules (*Decisions*), and the measurement. **Kevin decides** money (paid boosts,
plans, add-ons), new lessons or other new app content, account settings and connections, and anything filmed or
posted under his name. Every change goes in the Today log; a test is written here before it starts. The research
behind this section (2026-10-01): Upload-Post's analytics, App Store Connect's reports, link counting, what the
Studio can make, what works for drawing content, and who the audience is.

### What we steer by

- **Goal: first-time downloads from social per week.** App Store Connect's detailed reports by campaign prefix:
  weekly (out Fridays) and monthly (out on the 5th). A hidden row is unknown, not 0. Beside them, the daily App
  referrer + Web referrer total, which Apple never hides.
- **Steering number until downloads show: taps toward the App Store per week.** That is Pinterest's
  `outbound_clicks`, plus the profile-link tap counter once it is live (PostHog `social_link_opened`,
  `traffic = human`). TikTok `bio_link_clicks`, Instagram `profile_links_taps` and Threads `link_clicks` (Threads
  may no longer count) cross-check the counter; they count the same taps, so they are never added on top.
- **Per post, at a fixed age** (72 hours; Pinterest 14 and 28 days; YouTube 7 and 28 days): views; on TikTok the
  share still watching at 3 s and profile views per 1,000 views; saves and shares where reported.
- **Where it comes from:** `social snapshot` keeps every number Upload-Post gives, per post and per account, in
  `.studio/social/metrics.jsonl`; `social scorecard` adds it up for Mondays.
- **The App Store's side:** `python3 docs/ops/acquisition.py` (README.md, *Lesson videos on social*) writes
  `.studio/ops/acquisition.json`: page views, Get taps and downloads by source every day in the daily check (Apple's
  totals; the last 3 days provisional), per campaign, platform and referrer from the weekly report on Fridays
  (social check), and the monthly on the 5th. `--granularity WEEKLY --days 28` for the four-week review. Its
  `hidden` says how much of each total the campaign rows leave out.

**Day 1 (Pine Tree, read 2026-10-01):** Facebook 305 views, TikTok 41, Threads 12, Instagram 10, X 3, YouTube 2,
Pinterest 0 (a personal account, which gets no numbers). On TikTok 40% were still watching at 1 s, 10% at 4 s and
2% from 7 s; nobody watched to the end, and nobody tapped the bio link. The first second is the first problem.

### Rules for deciding

- **Fair comparisons.** Compare within one platform, at a fixed age, by medians, never by means, and never before
  against after. Test arms alternate in 2-day blocks (AABB), so each gets a free day and a Premium day.
- **At most three tests at once,** and only on numbers with volume (TikTok views and hold now; Pinterest once it
  reports). Anything else is a change made without a test.
- **Counts** (taps, clicks, follows): decide after at least 10 in all. The winner needs 8 of 10, 9 of 12, 12 of 16
  or 14 of 20 for wording, design or timing. Dropping a format, or anything that costs Kevin time, needs 9 of 10,
  10 of 12, 12 of 16 or 15 of 20, or the same result twice. An inconclusive test runs once more, then the cheaper
  arm stays.
- **Ratios** (hold, saves per reach): the unit is the post. At least 6 posts per arm with 30 or more views each; a
  win is at least 1.25× pooled and 7 of 8 pairs.
- **Floors, so noise triggers nothing:** a breakout is at least 5× the platform's last-14-post median *and* at least
  1,000 views. "Views but no taps" needs 10,000 views or 100 profile views with 0 taps. A stop rule ("median down
  50%") needs the same floor. 0 taps in N views puts the rate below 3 in N.
- **A breakout, within 24 hours:** its speed draw at the next 12:00 on TikTok; its path's next lesson one place up
  in `social-up-next.txt`, keeping free and Premium by turns and never the same path two days running; a fresh pin
  of it; ask Kevin to pin it on the TikTok profile.
- **Account health first:** Pinterest at most 3 new pins a day until it has shown impressions for 2–3 weeks
  without a warning; nothing aimed at children (no "for kids" on YouTube, no children on screen); every Premium post
  says Premium.

### Running and next

Changes made without a test:
- **2026-10-01:** TikTok and Instagram get our caption. Until then Upload-Post gave them the YouTube title: no
  "link in bio", no tags, no Premium line.
- **From 2026-10-02 to 04:**
  - Captions open with what people search ("How to draw a mushroom: 6 easy steps"), with 5 tags (Instagram counts
    only 5).
  - YouTube Shorts say "The app's link is on our channel" instead of a link nobody can tap.
  - Facebook: check whether a Reel's description link can be tapped; if not, the link goes in a first comment.

Tests:

| # | What | Where | When | Read | Bar |
|---|---|---|---|---|---|
| E1 | **Opening:** the finished picture and "How to draw a X · N easy steps" on screen from 0 s, then the drawing with no blank fade; the app's name moves to the end | Every video; read on TikTok | Default from Oct 5, with 4 posts against 4 of the old opening (AABB, Oct 5–12) as a guardrail | Oct 13 | Back to the old opening only if the 3-s hold is clearly worse |
| E2 | **Length:** on B days TikTok and Reels get the 20-s speed draw at 17:00, the others the draw-along | TikTok, Instagram | Oct 14–27, AABB | Oct 28 | Median 72-h views, and profile views per 1,000, by the rules above |
| E3 | **Library pins:** earlier lessons as new pins, 1 a day, then 2–3, never the same design twice, `ct=pinterest` | Pinterest | Once the business account shows impressions | Oct 28, Nov 12 | Weekly outbound clicks rise, and impressions per new pin don't halve |
| E4 | **Winter, posted early:** winter boards and pins (snowflake, gift box, star, mug, the pine tree as a winter tree), inside the day's pins | Pinterest | From Oct 15 | Oct 21, Nov 12 | Seasonal pins 1.5× same-age pins: keep through December. These numbers go to Kevin for the Christmas-lessons question |

**Later, if the numbers call for them:**
- a pinned first comment on TikTok
- step carousels (TikTok photo mode, Instagram)
- "pick the next drawing" polls on Threads
- long "draw with me" YouTube videos, only once a Short breaks out or the channel passes about 100 subscribers (they
  risk a "made for kids" relabel)

**Not now:** "Day N" numbering, mystery openings, posting-time tests (no hourly data yet), paid boosts, X's link
add-on.

### Needs Kevin

**Now:**
1. Switch Pinterest to a free business account. Pinterest gives personal accounts no analytics, so every pin reads
   0. Then check that Upload-Post still posts.
2. A yes on the website wording for the tap counter. It is drafted, not live.
3. The AI label. Claude recommends labelling on Instagram and Facebook as well as TikTok, since Meta asks for it on
   realistic synthetic voices. YouTube can stay unlabelled.

**After the first scorecard (Oct 5):**
- Bios ("One easy drawing a day…") and the display name ("Paper Coach by Softroni").
- Reconnect YouTube in Upload-Post: its watch time comes back "unavailable".
- A standing yes for comment replies within set rules.
- Christmas lessons, decided by about Oct 20, with the first seasonal pin numbers on Oct 21.
- A "Where did you hear about Paper Coach?" question in onboarding: a feature, for the release after 1.1, and the
  only way past Apple's hidden small numbers.

## Cost

Upload-Post Basic, **monthly ($24) for the first two months**, then yearly ($192, $16 a month) if social is
bringing downloads (decided with Kevin on 2026-09-30). If it works, that costs $16 more than yearly from the start;
if it doesn't, $48 instead of $192. Two months rather than the four-week review, because new accounts are often
quiet for their first weeks. Basic has no upload limit, so ~90 uploads a month are fine. TikTok needs it: TikTok
lets only audited apps post publicly, and won't audit a tool for posting to your own accounts.

**The decision (about 2026-11-30):** downloads per platform in App Store Connect (the `ct=` campaigns) and
Upload-Post's views. Claude writes it up under *Log* and puts it in Needs you; staying, going yearly or stopping is
Kevin's call.

## Checklist

Waiting on Kevin:

- [x] Upload-Post Basic, monthly, from 2026-09-30.
- [x] TikTok (softroni.app) and Threads (softroniapps) connected to the `softroni` profile (2026-09-30).
- [x] Threads bio link (`ct=threads-bio`), 2026-09-30.
- [ ] About 2026-11-30: monthly → yearly, or stop (see *Cost*).
- [x] Provider token for campaign links: `128560181`, in `APP_STORE_PROVIDER_TOKEN` (2026-09-30).
- [x] Campaign links in the profiles of Instagram, X, YouTube, Facebook and Pinterest (`<platform>-bio`,
  `youtube-channel`, `facebook-page`, `pinterest-profile`).
- [x] TikTok: business verification approved and the bio link in (`ct=tiktok-bio`), 2026-10-01.
- [x] Short profile links on softroni.com (2026-10-01). Each platform has its own, forwarding to its own campaign,
  so App Store Connect still counts downloads per platform; one link shared by all would lump them together.
  They are one-line redirect pages in the softroni.com repo (`~/dev/softroni.com`, GitHub Pages):

  | Profile | Short link | Campaign |
  |---|---|---|
  | TikTok | softroni.com/t/papercoach | `tiktok-bio` |
  | Threads | softroni.com/th/papercoach | `threads-bio` |
  | X | softroni.com/x/papercoach | `x-bio` |
  | Instagram | softroni.com/i/papercoach | `instagram-bio` |
  | Facebook | softroni.com/f/papercoach | `facebook-page` |
  | YouTube | softroni.com/y/papercoach | `youtube-channel` |
  | Pinterest | softroni.com/p/papercoach | `pinterest-profile` |

  Kevin's naming (2026-10-01): a platform's letters, then the app, so another Softroni app gets its own
  (`softroni.com/t/geoblitz`); plain `softroni.com/papercoach` stays free for an app page like the others have.
  Each is `<letters>/papercoach.html`. (The first ones, `softroni.com/draw` and `<letter>/draw`, were removed on
  2026-10-01 once every profile had moved over.)

  Never point a profile at another platform's link, and keep each page's campaign if its target ever changes.
- [ ] YouTube "made for kids" and the AI label: defaults stand (no; TikTok only) unless Kevin says otherwise.

To build (Claude):

- [x] Up-next list: `docs/ops/social-up-next.txt` posted before the queue.
- [x] Campaign links: `ct=<platform>` on every App Store link once `APP_STORE_PROVIDER_TOKEN` is set.
- [x] Step pin: a tall image of every step, rendered by the Studio (`social pin <id>` to look at it).
- [x] Pinterest boards per path, made on first use; the step pin scheduled four hours after the video.
- [x] Speed draw: a short video of the whole picture drawn fast, then the ending.
- [x] `social announce`: release news to every platform with a caption written for the release.
- [x] Runbook and skill updated for all of the above.
- [x] Free and Premium by turns from 2026-10-02 (`stillToPost` in web/server/social/queue.ts, which the daily
  job and the Social page share; Premium in `social-premium-first.txt`'s order), and "in Paper Coach Premium. The
  app is free to download, with 30 free lessons" in every Premium post and pin (2026-09-30).
- [x] The Studio's Social page (`#/social`): every post day by day with its links, and *Coming up* (2026-09-30).

Then (Claude, once the plan and TikTok are on):

- [x] Install the launch agent (2026-09-30; first run 2026-10-01 17:00). The daily check of 2026-10-02 looks at
  the first real post on each platform.
- [ ] Week 4: first review of downloads per platform, written below.

Growth (Claude, from 2026-10-01; *Growth* says why):

- [x] TikTok and Instagram get our caption, not the YouTube title (2026-10-01).
- [x] `social snapshot`: every number Upload-Post gives, per post and per account, daily into `metrics.jsonl`
  (mirrored to `ops-history`); Pinterest's clicks and TikTok's retention kept, not dropped (2026-10-01).
- [x] `social scorecard` for Mondays (2026-10-01).
- [ ] The social check runs `social snapshot` every day and `social scorecard` on Mondays, in both copies of its
  prompt (it still runs `social stats`).
- [x] App Store Connect acquisition pull: daily totals by source, weekly and monthly per campaign (`acquisition.py`,
  2026-10-01).
- [ ] Tap counter on the seven profile links: drafted; live once Kevin says yes to the website wording.
- [ ] Captions that open with the search phrase, 5 tags, the YouTube line, the Facebook link check. (Board names
  stay: renaming one in code would make a second board, since `boardFor` matches by name.)
- [ ] E1, the new opening, default from Oct 5.

## Log

- 2026-09-28: pipeline built; private YouTube Short and Facebook draft worked.
- 2026-09-30: 1.0 on sale; the queue now reads the version on sale (`1.0(2)`, 100 lessons). Plan agreed.
- 2026-09-30: built the up-next list, campaign links, step pins with a board per path, the speed draw and
  `social announce`. Nothing posted publicly yet: waiting on the paid plan and TikTok.
- 2026-09-30: provider token in the settings; campaign links in every profile but TikTok's (verification pending).
- 2026-09-30: Basic monthly; launch agent installed; the daily check now runs the morning social steps
  (README.md, *Lesson videos on social*); `social stats` reads views per post for the Monday numbers.
- 2026-09-30: TikTok and Threads connected; Threads added to every post, with its own link (`ct=threads`).
- 2026-09-30: first real post (Pine Tree, all seven platforms, 23:12). Post links kept on `ops-history`; the Social
  page; the social check routine (17:45); Premium lessons in by turns from 2026-10-02 (Kevin's decision).
- 2026-09-30: Upload-Post monthly for two months, then yearly if it brings downloads (not yearly up front).
- 2026-10-01: Claude made social media manager (*Growth*). Day 1: 373 views, mostly Facebook; TikTok viewers gone
  within seconds. TikTok and Instagram had shown the YouTube title instead of our caption: fixed before Watermelon.
- 2026-10-01: `acquisition.py` reads App Store Connect's acquisition reports. First day (Sep 30): 2 first downloads,
  6 page views, 4 of them from an app; no campaign rows yet.
- 2026-10-01: built `social snapshot` (every number per post and account into `metrics.jsonl`, copied to
  `ops-history`) and `social scorecard`; `social stats` counts replies and reactions, and links pins to the pin.
