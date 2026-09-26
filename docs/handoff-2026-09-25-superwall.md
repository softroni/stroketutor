# Handoff: Superwall A/B paywalls (2026-09-25, moved from the laptop)

Started on branch `wip/superwall-paywalls`, merged to `main` on 2026-09-25 once it built and all 273 tests passed.
Everything below was mid-flight when the laptop shut down; the progress notes under "Plan still to do" say what has
been finished since.

## Already done and on `main`

- `a9a248d` Premium: simpler paywalls with a dated free week, reminder after the trial starts (drawer → paywall,
  More coming → paywall, trial-started screen, child drawer rewording). 242 tests green.
- README: audience is every age (kids under 10 to adults over 60), not "intended primarily for kids".

## Decisions (keep them)

- Never copy Drawing Desk's mechanics (no-exit intro screens on every tap, trial or per-month headline over the
  billed price, price-less CTA, exit hidden behind "View more plans"). Billed amount is always the largest pricing
  element; every page keeps "Continue with free lessons".
- Superwall runs only for 13+ learners. `register()` without a `feature:` closure (a skip — holdout, no audience
  match — would otherwise unlock Premium). No holdout on the premium placements. Child tier stays fully native.
- Configure Superwall at most once, only when a 13+ learner is active, with `eventTrackingBehavior = .none` at
  configure (suppresses the install-attribution fingerprint call), `.all` for 13+ after configure, `.none` for a
  child. Never identify, never send age/tier as attributes.
- PurchaseController over the existing StoreKit 2 `PremiumStore`; keep `subscriptionStatus` in sync. Native
  `PaywallView` is the fallback on error/skip/timeout. The app keeps its own trial reminder (no Superwall
  trial-reminder notification on any paywall).

## Superwall account state

- Org 27045 renamed to **Softroni**. Project 42098, iOS app 56531, public key `pk_hy9KyoEgHdfiSBAq7ZVLN`,
  entitlement `premium`, products yearly (678741) and weekly (678742).
- Public Beta on for the app: Flows, Editor Agents, Campaign Analysis, Web Checkout.
- Campaigns (created by CLI): **Onboarding offer** 109312 → placement `onboarding_offer`;
  **In-app Premium** 109313 → `premium_lesson`, `settings_premium`. Both still 100% holdout (the app falls back to
  the native paywall on a skip). Leave "Example Campaign" 109295 alone.
- Editor paywalls created by the user: **Premium** 271754 and **Premium Gift** 271755 (a Flow). An agent was
  designing them in the browser editor when the laptop died; check their state in the dashboard.
- `POST /v2/paywalls` returns 500 ("Failed to store paywall URL…"); create paywalls in the dashboard instead.
- Paywalls-as-code (`superwall/`, framework, `SUPERWALL_CHANNEL=next`) can't push yet: "Superwall for Agents is in
  private beta". The user is emailing support@superwall.com for org-wide access.

## Where it stands (2026-09-26)

Steps 1, 2, 3 and 5 of the original plan are done; step 4 waits on Superwall. Details below, newest last.

### Swift integration (step 1): done

The build was fixed (`StoreKit.Product`, since SuperwallKit has a `Product` too) and `RemotePaywallsTests` added. An
18+ launch starts Superwall with no attribution call, and while a campaign was all holdout, `settings_premium` fell
back to the native paywall as designed.

### Editor paywalls (step 2): done, published

The user renamed them on 2026-09-26. Campaigns point at the IDs, so names can change freely.

| Name | ID | Products | Layout |
|---|---|---|---|
| Paywall 1 | 271754 | `yearly`, `weekly` | One page like `PaywallView`: art, price, free-week timeline (benefits when there is no free week), buy yearly, "View more plans" drawer (Yearly/Weekly, buys the selected plan) |
| Flow 1 | 271755 | `primary` (yearly), `secondary` (weekly) | Gift page (Lina with a gift, price, "Continue" buys nothing) → the Paywall 1 page |
| Paywall 2 | 271784 | `yearly`, `weekly` | Plans up front: headline, both plans as cards on the page (Yearly preselected), no drawer |
| Flow 2 | 271786 | `yearly`, `weekly` | "What Premium unlocks" (no price, no trial claim, "See plans") → the Paywall 2 page |

Every page switches its free-week wording on `products.hasIntroductoryOffer`, names the billed price on its buy button,
and has Restore, Terms of Use, Privacy and "Continue with free lessons" (close). The reminder row says "2 days before it
ends" (`PremiumStore.reminderDaysBeforeTrialEnds`); the billing row uses the product's `trialPeriodEndDate`. "Save 80%"
is typed in (true for US prices). Every page was checked in screenshots (the user sent the three the agent could not
capture).

Editor gotchas: `write_html` turns horizontal rows into CSS grids sized to their content, so set `display:flex` on them
afterwards; composite art works best as one inline SVG (a remote PNG drew blank in screenshots); `get_children` lists
children unsorted, `get_subtree` shows the real `index` order; screenshots only work while the editor tab is in front
(a phone tab that sleeps drops the session: `session_not_ready`, and needs a fresh pairing code). One CLI state folder
per paywall (`SUPERWALL_STATE_DIR`) lets several stay attached at once.

### Campaigns (step 3): live since 2026-09-26

The user set these in the dashboard (the agent's session was not permitted to change live campaigns):

| Campaign | Placements | Variants | Holdout |
|---|---|---|---|
| Onboarding offer 109312 | `onboarding_offer` | Paywall 1 34%, Flow 1 33%, Flow 2 33% | 0% |
| In-app Premium 109313 | `premium_lesson`, `settings_premium` | Paywall 1 50%, Paywall 2 50% | 0% |

No audience filter: the app itself starts Superwall only for learners 13 and over. Checked on the "PC Review" simulator:
Settings › Premium got Paywall 2 from Superwall with StoreKit prices and the free-week wording. Superwall keeps a user
in the variant first assigned, so a test device that met a placement while it was all holdout keeps getting the native
paywall ("PC Superwall" simulator); reinstall the app to reset it.

### PostHog (step 5): done, except the Declared Age Range API

`PostHogSink` (`PaperCoach/App/PostHogSink.swift`, no SDK) posts `Analytics` events to PostHog project 629055 (US
cloud) in batches. Children's events carry a per-launch id and build no person; 13+ use the profile's random id. Every
event sets `$geoip_disable`, and the project has "Discard client IP data" on. Tests and screenshot launches send
nothing; debug builds send with `build: debug`. New drawing events for every tier, to learn what learners want to draw:
`path_opened`, `lesson_started`, `lesson_completed`, `lesson_left` (step reached), `drawing_saved`,
`wish_list_changed`. The first live event arrived with no IP stored.

### App Store Connect: done this session

- The 1.0 description's last line now reads "Lessons live on your phone, and your photos stay in the app's
  sketchbook."
- App Privacy is published as `docs/app-store/listing.md` lists it: linked (User ID, Product Interaction) and not
  linked (Device ID, Purchase History, Coarse Location), all for analytics, none for tracking.

## Still to do

0. **Publish Paywall 1 and Flow 1** in the Superwall editor: their "Paper Coach Premium" text (renamed 2026-09-26)
   is saved in the drafts but not live until published.
1. **The privacy policy page** (https://softroni.com/privacy-policy.html, the link the app opens) should name
   Superwall and PostHog and say what each receives, matching App Privacy. The user's to change; not checked yet.
2. **Code paywalls:** once Superwall grants "Superwall for Agents" beta access (the user will say), push the code
   paywalls in `superwall/` and decide whether they replace the editor ones in the campaigns.
3. **A PostHog dashboard, "What learners draw",** once real events exist: lessons started and completed by path and
   by age group (child versus 13+), where `lesson_left` happens by step, the most wished-for Premium lessons, and
   `drawing_saved` by lesson. Exclude `build = debug`.
4. **Paywall results:** once a build is live, compare the variants per campaign (Superwall analytics, and the
   `superwall_*` events in PostHog).
5. **Declared Age Range API** (Texas), not started.
6. The first-submission items in `docs/app-store/listing.md` › "Still to do by hand": availability, App Review
   contact, iPad screenshots or iPhone-only, a build.

## To set up on the new machine

- Everything is on `main` (the branch `wip/superwall-paywalls` was fast-forwarded into it).
- `superwall login` (apps@softroni.com); `export SUPERWALL_CHANNEL=next` for the framework commands;
  `cd superwall && bun install` (or npm install).
- Recreate `~/.superwall-cli/.env` with `SUPERWALL_API_KEY=sk_…` (copy the key from Superwall Settings → Keys, or
  make a new one) so the editor agent can use `sw-editor.sh expose --open --wait`.
- `superwall skills -y` to install the Superwall agent skills (superwall-editor, superwall-framework, …).
