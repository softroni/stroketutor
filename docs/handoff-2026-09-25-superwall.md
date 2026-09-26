# Handoff: Superwall A/B paywalls (2026-09-25, moved from the laptop)

Work in progress on branch `wip/superwall-paywalls`. Everything below was mid-flight when the laptop shut down;
the Swift and `superwall/` files are a snapshot taken while two agents were still editing them, so expect
unfinished code that may not build yet.

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

## Plan still to do

**Progress (2026-09-25, evening, on the desktop):** step 1 is done except one check. The build was fixed
(`StoreKit.Product`, since SuperwallKit has a `Product` too), 31 tests were added (`RemotePaywallsTests`, 273
pass), and the privacy manifest, listing and review note, and README M10 "Superwall" were written. On a simulator an
18+ launch started Superwall with no attribution call. Later that evening the last check passed too: on the simulator
`settings_premium` came back as a holdout skip ("No Superwall paywall for settings_premium: … part of a holdout") and
the native paywall took its place. Step 1 is done. Both editor paywalls are still empty drafts (version 0), so step 2
starts from scratch.

1. Finish the Swift integration (`PaperCoach/App/SuperwallPaywalls.swift`, `RemotePaywalls.swift`, `OfferFlow`,
   `AppRoot`, SPM package in the project): build, run all tests, native fallback, privacy manifest
   (`PrivacyInfo.xcprivacy`), listing/review-note privacy text, README M10 "Superwall" section.
2. Finish the editor paywalls: Premium (single page + plans drawer) and Premium Gift (gift page → paywall page).
   Reference design: the native paywall screenshots and `PaywallView.swift` / `OfferSupport.swift`.
3. Attach paywalls to campaigns: Onboarding offer = Premium 50% / Premium Gift 50%, no holdout;
   In-app Premium = Premium 100%, no holdout. Publish only after reviewing screenshots of both trial states.
4. Once beta access arrives, push the code paywalls in `superwall/` and switch the campaigns to them.
5. Then PostHog: an `AnalyticsSink` that honors the age tiers; privacy label; Declared Age Range API (Texas).

## To set up on the new machine

- `git fetch && git checkout wip/superwall-paywalls`
- `superwall login` (apps@softroni.com); `export SUPERWALL_CHANNEL=next` for the framework commands;
  `cd superwall && bun install` (or npm install).
- Recreate `~/.superwall-cli/.env` with `SUPERWALL_API_KEY=sk_…` (copy the key from Superwall Settings → Keys, or
  make a new one) so the editor agent can use `sw-editor.sh expose --open --wait`.
- `superwall skills -y` to install the Superwall agent skills (superwall-editor, superwall-framework, …).
