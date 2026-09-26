# Release prep for Paper Couch 1.0, 2026-09-26 (overnight)

The creator asked, at 01:25 CDT before going to sleep: check the screenshot layouts, review the app and the App Store
Connect page, make sure PostHog and Superwall carry enough events to measure Apple Ads and learner behaviour, upload
a build and leave version 1.0 ready to submit. The creator first meant to press Submit; in the morning they asked for it to be submitted once everything checked out.

This file is the checklist and the log. A session that picks the work up continues from the first unchecked item.

## Checklist

- [x] 1. Screenshots: every one of the 16 checked at full size (docs/app-store/marketing/README.md)
- [x] 2. App review: release build, tests, Info.plist, privacy manifest, debug-only code, flows on the simulator
- [x] 3. Analytics: event audit (PostHog + Superwall), Apple Ads attribution added
- [x] 4. Build: version/build number, archive, upload, processing, attached to 1.0
- [x] 5. App Store Connect: screenshots (iPhone 6.9", iPad 13"), review details, availability, everything else
      the 1.0 page needs short of Submit
- [x] 6. Handoff: what was done, what is left for the creator

## Log

- 01:30 Screenshots: all 16 checked at half size and the risky spots (Dynamic Island, device corners) at full size.
  Fixed: battery showed the charging bolt (now a plain full battery), and iPadOS 26's window resize handle in the
  iPad captures' bottom-right corner (capture.sh now covers it with the background beside it). No text is cut off
  and no sticker covers a headline or a key control.
- 01:33 App review: 284 tests green before any change; no TODO/FIXME or print; debug code (harness, debug
  menus) all behind `#if DEBUG`; Info.plist has camera and add-to-Photos strings, export compliance NO,
  `UIRequiresFullScreen` so the iPad's three orientations pass validation; icon present; privacy manifest matched
  App Privacy. ASC: version 1.0 in Prepare for Submission, no build yet, no App Review details, **no availability
  set** (the app is in no territory), iPhone 6.7/6.9 set holds the six plain captures, no iPad set, both
  subscriptions Ready to Submit, age rating 4+.
- 01:41 Analytics (item 3). Added:
  - `AppleAdsAttribution` (AdServices, no ATT): asks Apple once per install which campaign, ad group and keyword
    led to it, retries 404s, gives up after 5 launches, keeps the answer. `install_attributed` once; `asa_*` keys
    (same names as GeoBlitz) on `app_opened`, `ob_finished`, `purchase_attempted`, `offer_finished`,
    `superwall_transaction_complete`, `superwall_free_trial_start`, and on a 13+ learner's PostHog person.
    Apple's sample answer (TestFlight, Xcode builds) is tagged `asa_test_payload`.
  - `app_opened` on every launch and return from the background, with `first_open`, `narration_on`,
    `reminder_on`, `save_to_photos_on`: installs, retention and settings use per campaign.
  - Privacy manifest: Advertising Data (linked, analytics, not tracking), as GeoBlitz declares.
  - 12 new tests (`AppleAdsAttributionTests`), 296 green. Checked live: `app_opened` reached PostHog from the
    simulator (`build: debug`); the simulator has no AdServices token, so `install_attributed` shows up only on a
    device.
  Already there and kept: onboarding beats and age, paths and lessons (started, completed, left at step, saved,
  wished for), the Premium way (crown taps, offer screens, purchase outcomes) and Superwall's paywall and
  transaction events for 13+.
- 01:43 Committed on branch `release/1.0` (not pushed, not merged): `80bf06d` screenshots, `38ff9f1` analytics.
- 01:45 App Store Connect, through the API:
  - App Review details on 1.0: Zakaria Chowdhury, apps@softroni.com, the GeoBlitz phone number, no sign-in, and
    the notes from listing.md (now also saying the app uses AdServices and asks for no ATT). 3,861 of 4,000 chars.
  - Availability: all 175 territories, new territories on, like GeoBlitz. It had none.
  - Screenshots: the six plain iPhone captures replaced by the eight framed ones (6.9" set), and the eight iPad 13"
    ones added. All sixteen processed (COMPLETE).
  - Checked and already fine: name, subtitle, description, keywords, promotional text, support and marketing URLs,
    privacy policy URL, categories (Education, Graphics & Design), age rating 4+ with every new question answered,
    content rights, price Free, both subscriptions Ready to Submit.
- 01:47 Build: archived Release 1.0 (1). The first export failed ("Cloud signing permission error", no profile):
  the App Manager key cannot use cloud-managed certificates. Created the profile **Paper Couch App Store**
  (IOS_APP_STORE, the Apple Distribution certificate in this Mac's keychain, serial 294BEF…, expires
  2027-02-21) through the API, installed it, exported with manual signing and uploaded: "Upload succeeded".
- 01:49 Build 1.0 (1) processed: VALID, no non-exempt encryption, minimum iOS 17.0. Attached to version 1.0, which
  stays in Prepare for Submission. No review submission was created.

## For the creator in the morning

Everything else on the 1.0 page is filled. Before pressing **Add for Review › Submit to App Review**:

1. **App Privacy › add Usage Data › Advertising Data**: used for Analytics, linked to the user, not used for
   tracking. Build 1 sends Apple Ads attribution to PostHog, and there is no API for App Privacy.
2. **On the 1.0 page, "In-App Purchases and Subscriptions": select Premium Yearly and Premium Weekly**, so the
   first subscriptions go to review with the app (both are Ready to Submit).
3. Recommended: try the purchase flow on a phone (README, M10). Neither Paper Couch nor GeoBlitz has a TestFlight
   group; TestFlight › Internal Testing › "+" › add yourself, and build 1 is there.
4. **Privacy policy**: its Apple Ads section names only GeoBlitz (resolved by Superwall). Paper Couch asks Apple
   directly and is not named anywhere. A task was queued to draft the change in `~/dev/softroni.com`, whose local
   copy is behind the live page, so reconcile before editing.
5. Merge `release/1.0` into `main` (build 1 is commit `38ff9f1`; the later commits are docs only) and push.

Optional:
- Age rating "Parental Controls" is answered No; the PIN and the grown-up check could count as Yes. It does not
  change the 4+ rating.
- Superwall can also chart revenue by Apple Ads keyword if Apple Search Ads is connected for Paper Couch (app
  56531) in its dashboard, as it is for GeoBlitz, but it would only see 13+ learners. PostHog already has every
  tier.

## Reading Apple Ads in PostHog once ads run

- Installs by campaign: `install_attributed`, broken down by `asa_campaign_id` / `asa_keyword_id`
  (`asa_attribution` false is organic).
- Conversion: `ob_finished`, `offer_finished` and `purchase_attempted` (outcome `purchased`, plan) carry the same
  keys, for every age tier; a 13+ learner's person carries them too, so retention by campaign works for them.
- Always filter out `build = debug` and `asa_test_payload = true` (Apple's sample answer in TestFlight and Xcode
  builds). Keyword and campaign names come from the Apple Ads API (`superwall asa keywords …`, or GeoBlitz's
  `scripts/asa/weekly_report.py`, which joins on `keywordId`).

## Morning, 2026-09-26: submitted

- The creator added App Privacy's Advertising Data row and pressed "Add for Review" on the subscriptions, which put
  only the **subscription group version** into a draft review submission.
- 6.5" iPhone screenshots are not needed: App Store Connect asks for them only when there is no 6.9" set.
- Review notes now name the four Superwall designs and where each appears (3,953 of 4,000 chars), and both
  subscriptions carry review notes (how to reach a paywall, the designs, the parental check). Both are in
  listing.md.
- Submitting the draft failed at first: "This is a new subscription group, you need to submit at least one
  subscription first", and `POST /v1/subscriptionSubmissions` refuses a first subscription ("must be submitted
  at the same time as an app version"). What works (API spec 4.5): add each **subscription version**
  (`GET /v1/subscriptions/{id}?include=versions`) as a `reviewSubmissionItems` row with the `subscriptionVersion`
  relationship, next to the `appStoreVersion` and the `subscriptionGroupVersion`, then `PATCH` the submission
  `submitted: true`.
- **Submitted 2026-09-26 12:27 UTC** (submission `ff6bd494-…`): version 1.0 with build 1, the group, Premium
  Yearly and Premium Weekly. All three read Waiting for Review. Release is automatic after approval.
