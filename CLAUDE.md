# Paper Coach

## Operations (agreed with the creator, 2026-09-27)

Claude runs Paper Coach day to day; [docs/ops/README.md](docs/ops/README.md) is the runbook, and every session
follows it. In short:

- **Claude ships on its own:** fixes for Apple rejections and for bugs users reported (App Store reviews, or anything
  the creator passes on), and for serious crashes seen in the data (at launch, in the player, while buying). Build,
  submit with phased release, and say what was done.
- **Claude never builds or submits a feature release unless the creator asks.** New features, unreported bugs and
  performance are the creator's, in their own sessions; Claude only suggests them. Prices, trials and new products are
  always the creator's decision.
- A fix starts from what is on sale (`release/<version>` worktree), never from `main`, so unfinished work never ships.
- **Tag every build Apple approves** as `<version>(<build>)`, e.g. `1.0(2)`, and push the tag. Only approved builds.
- Claude also runs the Superwall A/B tests, Apple Ads (budget rule in the runbook), review replies, ASO and PostHog,
  and after anything worth telling runs `python3 docs/ops/today.py log "…"`, which updates the Studio **Today** page.
- **Never delete past daily data**: `.studio/ops/history` (branch `ops-history`) and `log.jsonl` only grow.

**Planning or building features?** Read [docs/next-builds.md](docs/next-builds.md) first: the ranked list of what to
build next for revenue, with specs, and the numbers behind the order.

## App Store screenshots

A standing instruction from the creator, for every session: keep the App Store screenshots in step with the app, and
put them in App Store Connect whenever a release is prepared. How to do both is in
[docs/app-store/marketing/README.md](docs/app-store/marketing/README.md).

**When a change alters what one of these screens shows, update its screenshots as part of the same work.** Take the
affected screens again on both simulators (iPhone and iPad), render, look at every changed PNG at full size, and
commit the captures and `out/` with the change.

| Shot | Headline | Harness screen | Mostly drawn by (under `PaperCoach/`) |
|------|----------|----------------|---------------------------------------|
| 1 | Learn to draw step by step | `player-awaiting` | `Features/Player/` |
| 2 | Draw what you love | `paths` | `Features/Home/PathsView.swift` |
| 3 | Keep every drawing | `sketchbook-filled` | `Features/Sketchbook/` |
| 4 | Finish it in full color | `player-last@burger` | `Features/Player/` |
| 5 | Watch a line, then draw it | `preview-default@rocket` | `Features/Home/LessonPreviewView.swift` |
| 6 | Start simple, then level up | `path-default` | `Features/Home/PathDetailView.swift` |
| 7 | A finished picture in minutes | `completion-default@sailboat` | `Features/Completion/CompletionView.swift` |
| 8 | Pick up where you left off | `home-progress` | `Features/Home/HomeView.swift` |

These also reach the screenshots: `Design/` (theme, shared components), `App/MainTabs.swift` (tab bar, iPad sidebar),
`App/DebugScreenHarness.swift`, and in `shared/` the catalog and the drawings of the lessons shown (palm tree, burger,
rocket, sailboat). A change nobody would see on these screens needs no new screenshots.

Shot 1 stays as designed (the palm tree, the photo of a hand drawing it, the layout): the creator asked for it to be
left unchanged. If the player changes, take its phone screen again with the same lesson and step, nothing more.

**When a release is prepared for submission** (a new version in App Store Connect with its build, before it goes to
review), make sure the renders match the build, then run `python3 docs/app-store/marketing/upload.py --apply` without
asking first, and say what it changed. It only uploads the sets that differ from `out/`, waits for Apple to process
them, and never touches a version in review or on sale.
