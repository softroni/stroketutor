# Social plan: lesson videos for downloads

Agreed with Kevin on 2026-09-30. **The goal is App Store downloads over time**, not followers for their own sake.
How posting works day to day (the tool, settings, the record) is in [README.md](README.md), *Lesson videos on
social*, and the studio-cli skill, *Posting lesson videos*. This file is the plan and **its build status: any
session picks up from the checklist at the end**, and ticks it off in the same commit as the work.

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
unpublished; the morning check sees that and asks Kevin to publish it in the app.

**Threads in detail.** Instagram's text network: the same video, a shorter caption with no hashtags (Threads takes
one topic tag instead), and the App Store link right in the post, where it can be tapped. Low effort, so it stays
daily; the four-week review says whether it earns its place.

**Why Pinterest first:** it is the only platform where every post is one tap from the App Store, "how to draw" is
one of its biggest categories, and a pin keeps being found through search for months. TikTok and Reels bring bigger
bursts of views, but a download there takes bio → link → App Store.

## A day

- **17:00 Central** (launch agent): the next lesson's draw-along to every platform; the step pin scheduled for 21:00.
- **Next morning, the daily check:** read how the post did, re-post a platform that failed, log it on Today.
- **Weekly (Monday's daily check):** Upload-Post analytics per post; subjects that do well (vehicles, food, space…)
  move up by listing lessons in `docs/ops/social-up-next.txt`, which `social next` posts before the queue.
- **Optional, from Kevin, once a week:** 15–20 s filmed on a phone of a hand drawing on paper beside the app. Real
  hands on real paper tend to convert better than animation. Posted to TikTok and Reels with `social post --video`.

## Schedule

Started 2026-09-30 (Upload-Post Basic, monthly). Times are Central. The daily check keeps these in "dates coming
up" on the Today page and does what each says on the day.

| When | What | Who |
|---|---|---|
| Every day 17:00, from Thu 2026-10-01 | The next lesson's video to every connected platform; its step pin on Pinterest at 21:00 | launch agent |
| Every day 08:00 | Check the last post, post once more to a platform that failed, accounts to connect | daily check |
| Mondays, from 2026-10-05 | `social stats --days 7`: views per platform on Today; subjects that do well move up | daily check |
| The day 1.1 goes on sale | `social announce` with the best Around Town lesson; its ten lessons join the queue | daily check |
| 2026-10-28 | Four-week review: downloads per campaign and views per platform, written under *Log* | daily check |
| 2026-10-30 | Upload-Post renews monthly ($24) | automatic |
| 2026-11-23 | The two-month write-up under *Log*, and "monthly → yearly, or stop?" under Needs you | daily check |
| Before 2026-11-30 | Kevin decides; the plan renews that day | Kevin |

The queue posts lesson 1 of every path first, so the first ten days are Pine Tree, Watermelon Slice, Sun, Donut,
Cube, School Bus, Sailboat, Hot Air Balloon, Rocket and Rolling Hills; then lesson 2 of every path, and lesson 3:
all thirty free lessons by about 2026-10-30, the Premium ones after. `social queue` shows it as it stands.

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

- **One App Store link per platform** (`…?pt=<provider token>&ct=pinterest`), so App Store Connect → Analytics →
  Sources shows downloads per platform. Needs Softroni's provider token (App Store Connect → Analytics → campaign
  link generator) in `APP_STORE_PROVIDER_TOKEN` in `~/.config/upload-post/config`; until then links carry none.
  The bios should use the same tagged link, for `ct=tiktok`, `ct=instagram`, `ct=x`.
- **After four weeks:** downloads per 1,000 views per platform. Double what works, drop what doesn't (X first).
- **Expect** two or three quiet weeks while new accounts earn trust; the daily rhythm matters more than any post.

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
- [ ] TikTok bio link: the account is now a Business account; TikTok's business verification (submitted
  2026-09-30, up to three days) comes first. Then Edit profile → Links:
  `https://apps.apple.com/app/apple-store/id6816231257?pt=128560181&ct=tiktok-bio&mt=8`.
- [ ] YouTube "made for kids" and the AI label: defaults stand (no; TikTok only) unless Kevin says otherwise.

To build (Claude):

- [x] Up-next list: `docs/ops/social-up-next.txt` posted before the queue.
- [x] Campaign links: `ct=<platform>` on every App Store link once `APP_STORE_PROVIDER_TOKEN` is set.
- [x] Step pin: a tall image of every step, rendered by the Studio (`social pin <id>` to look at it).
- [x] Pinterest boards per path, made on first use; the step pin scheduled four hours after the video.
- [x] Speed draw: a short video of the whole picture drawn fast, then the ending.
- [x] `social announce`: release news to every platform with a caption written for the release.
- [x] Runbook and skill updated for all of the above.

Then (Claude, once the plan and TikTok are on):

- [x] Install the launch agent (2026-09-30; first run 2026-10-01 17:00). The daily check of 2026-10-02 looks at
  the first real post on each platform.
- [ ] Week 4: first review of downloads per platform, written below.

## Log

- 2026-09-28: pipeline built; private YouTube Short and Facebook draft worked.
- 2026-09-30: 1.0 on sale; the queue now reads the version on sale (`1.0(2)`, 100 lessons). Plan agreed.
- 2026-09-30: built the up-next list, campaign links, step pins with a board per path, the speed draw and
  `social announce`. Nothing posted publicly yet: waiting on the paid plan and TikTok.
- 2026-09-30: provider token in the settings; campaign links in every profile but TikTok's (verification pending).
- 2026-09-30: Basic monthly; launch agent installed; the daily check now runs the morning social steps
  (README.md, *Lesson videos on social*); `social stats` reads views per post for the Monday numbers.
- 2026-09-30: TikTok and Threads connected; Threads added to every post, with its own link (`ct=threads`).
- 2026-09-30: Upload-Post monthly for two months, then yearly if it brings downloads (not yearly up front).
