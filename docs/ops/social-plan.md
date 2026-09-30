# Social plan: lesson videos for downloads

Agreed with Kevin on 2026-09-30. **The goal is App Store downloads over time**, not followers for their own sake.
How posting works day to day (the tool, settings, the record) is in [README.md](README.md), *Lesson videos on
social*, and the studio-cli skill, *Posting lesson videos*. This file is the plan and **its build status: any
session picks up from the checklist at the end**, and ticks it off in the same commit as the work.

## What we post

Every lesson in the version on sale gives, from the Studio, with no one filming anything:

- **The draw-along** (`lessons video`, about a minute): the finished picture, every step with Lina's voice, and
  Paper Coach with the App Store badge at the end.
- **The speed draw** (about 15 s): the whole picture drawn fast, then the ending. Short videos get watched to the
  end and replayed, which the platforms reward.
- **The step pin**: every step on one tall image (the classic "how to draw" picture Pinterest is full of), with
  the lesson's name and Paper Coach.

## Per platform

| Platform | Priority | How often | What | The link |
|---|---|---|---|---|
| **Pinterest** | 1 | 2 a day | The draw-along as a video pin at 17:00, the step pin of the same lesson at 21:00, on a board per path ("Paper Coach: Plants"…) | **On every pin**, straight to the App Store |
| **TikTok** | 2 | 1 a day; 2 (add the speed draw) once something takes off | The draw-along | Bio |
| **YouTube Shorts** | 3 | 1 a day | The draw-along, "How to draw a ___ step by step #shorts" | Description, channel |
| **Instagram Reels** | 4 | 1 a day, plus 1–2 step posts a week | The draw-along | Bio |
| **Facebook Reels** | 5 | 1 a day | The draw-along (Facebook skews to parents who draw with their kids) | Description |
| **X** | 6 | 1 a day | The draw-along, for presence | None (Upload-Post strips links) |

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

Upload-Post Basic, yearly (about $192). About 90 uploads a month is well inside it. TikTok needs it.

## Checklist

Waiting on Kevin:

- [ ] Buy Upload-Post Basic (yearly) and connect TikTok to the `softroni` profile.
- [ ] Provider token for campaign links (see *Knowing what works*).
- [ ] Bio links on TikTok, Instagram and X to the App Store (tagged links once the token is in).
- [ ] YouTube "made for kids" and the AI label: defaults stand (no; TikTok only) unless Kevin says otherwise.

To build (Claude):

- [x] Up-next list: `docs/ops/social-up-next.txt` posted before the queue.
- [x] Campaign links: `ct=<platform>` on every App Store link once `APP_STORE_PROVIDER_TOKEN` is set.
- [ ] Step pin: a tall image of every step, rendered by the Studio (`social pin <id>` to look at it).
- [ ] Pinterest boards per path, made on first use; the step pin scheduled four hours after the video.
- [ ] Speed draw: a short video of the whole picture drawn fast, then the ending.
- [ ] `social announce`: release news to every platform with a caption written for the release.
- [ ] Runbook and skill updated for all of the above.

Then (Claude, once the plan and TikTok are on):

- [ ] Install the launch agent (README.md, *Lesson videos on social*) and watch the first real post on each platform.
- [ ] Week 4: first review of downloads per platform, written below.

## Log

- 2026-09-28: pipeline built; private YouTube Short and Facebook draft worked.
- 2026-09-30: 1.0 on sale; the queue now reads the version on sale (`1.0(2)`, 100 lessons). Plan agreed.
