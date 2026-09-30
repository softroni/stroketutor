# Paper Coach on App Store Connect

The record and its copy, as set on 2026-09-25 through the App Store Connect API (see
`~/.claude/CLAUDE.md` for the key and helper). Everything below is en-US; the app has one locale.

| Item | Value |
|---|---|
| App | Paper Coach: Learn to Draw, Apple ID `6816231257` |
| Bundle ID | `com.softroni.papercoach` (team PLQFG9VC25, In-App Purchase capability on) |
| SKU | `papercouch` (set when the record was made, during the Paper Couch naming; App Store Connect cannot change a SKU, and nobody sees it) |
| Version | 1.0, state Prepare for Submission, release after approval |
| Price | Free, base territory United States |
| Categories | Education, then Graphics & Design |
| Age rating | nothing declared (4+); not in the Kids category |
| Content rights | does not use third-party content |
| Copyright | 2026 Softroni LLC |
| Privacy policy | https://softroni.com/privacy-policy |
| Support / marketing | https://softroni.com/support · https://softroni.com |
| Subscription group | Paper Coach Premium (`22413930`), shown in the app as "Paper Coach" |
| Yearly | `com.softroni.papercoach.premium.yearly` (`6816231377`), $29.99 from 2026-10-02 ($19.99 before; existing subscribers keep it), 1-week free trial, Family Sharing, level 1 |
| Weekly | `com.softroni.papercoach.premium.weekly` (`6816231413`), $3.99 from 2026-10-02 ($1.99 before; existing subscribers keep it), no offer, Family Sharing, level 2 |

## Done through the API (2026-09-25)

- Privacy policy URL, categories, age rating, description, promotional text, support and marketing URLs, copyright,
  content rights, price (Free).
- Both subscriptions: en-US display name and description, the group's en-US name, and the paywall as the App Store
  review screenshot. Both products read **Ready to Submit**.
- Six iPhone 6.9" screenshots (1320 × 2868, plain simulator captures from the debug harness, in
  `docs/app-store/screenshots/`): Home, the player, a path, Lessons, the sketchbook and completion. Framed art can
  replace them later.

## Still to do by hand

The API refused these, or has no endpoint for them, in the order a first submission needs them:

1. **Availability.** Pricing and Availability › set all territories (the other Softroni apps sell in all 175).
2. **App Review information** on the 1.0 page: contact Zakaria Chowdhury, apps@softroni.com and the team phone
   number from the GeoBlitz listing; no sign-in required; paste the notes below.
3. **App Privacy.** ✅ Published 2026-09-26 as below. No longer "Data Not Collected": Superwall serves the paywall to learners 13 and over (README,
   M10 "Superwall"). Declare these types, **none used for tracking** and linked only where marked, as
   `PaperCoach/PrivacyInfo.xcprivacy` does:
   - Purchases › **Purchase History**: Analytics, App Functionality.
   - Usage Data › **Product Interaction** (paywall views and taps; with PostHog, the lessons opened, finished and
     kept): Analytics, **linked** (for 13 and over the events carry the profile's random id).
   - Identifiers › **User ID** (that random profile id, PostHog, 13 and over only): Analytics, **linked**.
   - Identifiers › **Device ID** (the vendor identifier, IDFV): Analytics, App Functionality.
   - Location › **Coarse Location** (country, region and city from the IP address, Superwall; and from the release
     after 1.1, the Region set in the phone's Settings on every PostHog event, `device_region`): Analytics, App
     Functionality, **linked** from that release (a 13+ learner's events carry their id). Changed in the privacy
     manifest 2026-09-30; **App Privacy on App Store Connect needs this row switched to linked by hand** (there is
     no API for it) before the build with it is submitted.
   - Usage Data › **Advertising Data** (Apple Ads attribution: the campaign, ad group and keyword ids AdServices
     returns, sent to PostHog): Analytics, **linked** (on a 13+ learner's person), not tracking. Added to the
     privacy manifest 2026-09-26 with `AppleAdsAttribution`; **App Privacy on App Store Connect still needs this
     row added by hand** (there is no API for it) before the build with it is submitted.
   - Diagnostics › **Crash Data** and **Performance Data** (MetricKit's crash and hang reports, sent to PostHog
     under an id made for each report): App Functionality, **not linked**, not tracking. Added to the privacy
     manifest 2026-09-27 with `CrashReporter` (1.0.1); **App Privacy needs both rows added by hand** before 1.0.1
     is submitted.

   Superwall's own guide asks only for Purchase History
   (https://superwall.com/docs/ios/guides/app-privacy-nutrition-labels); the other three are what its requests
   carried when checked on 2026-09-25 (the vendor id and the IP-derived location on every request, paywall
   events once tracking is on). The app has no account, never identifies anyone to Superwall, and the sketchbook
   photos stay on the device.
4. **iPad 13" screenshots** (2064 × 2752), required while the target includes iPad. Framed and captioned sets for
   both the iPhone 6.9" and the iPad 13" are ready in `marketing/out/` (see `marketing/README.md`), 2026-09-26, and
   are not uploaded yet; the iPhone set replaces the six plain captures on the record. On a fresh iPad Pro 13-inch
   (M5) simulator (iOS 26.5) the app opened full screen, so the black border seen earlier came from that
   simulator's windowing mode.
5. **A build.** Archive from Xcode with the PaperCoach scheme, upload, wait for processing, pick it on the 1.0 page.
   Export compliance is already answered in `Info.plist` (`ITSAppUsesNonExemptEncryption` = NO), and the privacy
   manifest ships in the bundle.
6. **Try the purchase flow on a device against the sandbox** before submitting (README, M10).
7. Submit the app and both subscriptions together in one review submission.

## App Review notes (paste into "Notes")

```
Paper Coach 1.0 requires no account or sign-in. The learner's work stays on the device: lessons ship in the bundle, the camera is used only when the learner chooses to photograph a finished drawing, and that photo stays in the app's sketchbook (saved to Photos only while "Also save to Photos" is on). The one third-party SDK is Superwall (SuperwallKit), which serves the paywall to learners 13 and over; it never runs for a learner under 13 or who chose "Prefer not to say", is never told who anyone is, and does no install attribution or tracking. The app sends its own usage events (lessons, onboarding and paywall steps), keyed by a random id and never a name, to PostHog without an SDK: for a learner under 13 the id lasts one launch and no profile is kept; no location is derived from the connection and IP addresses are discarded; each event carries only the Region chosen in the phone's Settings (such as "US"). Once per install the app asks Apple's AdServices framework which Apple Ads campaign, if any, led to the install: Apple's own attribution, with no advertising identifier and no App Tracking Transparency request. Purchases always go through StoreKit.

WHAT THE APP DOES
The phone is a drawing instructor for real pen and paper. Each lesson animates one line, then waits until the learner taps "I drew it". There are 10 paths of 10 lessons. Lessons 1-3 of every path are free; lessons 4-10 wear a gold crown and need Premium.

ONBOARDING AND AGE
Onboarding asks who is drawing and for an age band. Under 13 or "Prefer not to say" is treated as a child: a crowned lesson opens "This part is for a grown-up" instead of a price, and the paywall sits behind a parental check (a sum written in words, or the app's PIN if one was set). 13 and over gets the ordinary flow. To reach the paywall directly, choose 18+ during onboarding.

REACHING THE PAYWALL
On a fresh install the guided first run leads through the first lesson, the sketchbook and "More coming" to the paywall. Afterwards: Settings > Premium, or tap any crowned lesson. The one way past the paywall without buying is the link "Continue with free lessons", right under the purchase button. When a purchase starts the free trial, one screen confirms the dates (the reminder two days before the trial ends, and the day billing starts) and, only if notification permission was never asked, its single "Continue" button shows the system prompt. In the sandbox, where the 7-day trial lasts a few minutes, the reminder's day has already passed, so that screen names only when billing starts and asks for no permission.

PRODUCTS (subscription group "Paper Coach Premium", both Family Sharing)
- com.softroni.papercoach.premium.yearly: auto-renewing, $29.99 per year; eligible new subscribers get the displayed 7-day free trial. This is the recommended plan, shown first.
- com.softroni.papercoach.premium.weekly: auto-renewing, $3.99 per week; no introductory offer; under "View more plans".
All displayed prices come from StoreKit. The paywall shows the billed amount as the largest pricing element, names the price on the purchase button, states the trial length and the price charged after it, and carries Restore Purchases, Terms of Use (Apple's standard EULA) and the Privacy Policy. Restore is also in Settings.

SUPERWALL PAYWALLS (learners 13 and over)
While we compare designs, Superwall may show one of four paywalls instead of the one above: (1) one page like the app's own, with the weekly plan under "View more plans"; (2) both plans as cards on one page; (3) a gift page showing the price, whose "Continue" buys nothing, then design 1; (4) a "What Premium unlocks" page with no price, then design 2. Onboarding shows 1, 3 or 4; Settings > Premium and crowned lessons show 1 or 2. Every page with a price follows the rules above, and every page has "Continue with free lessons", Restore, Terms of Use and the Privacy Policy. If Superwall does not answer within a few seconds, the app's own paywall appears.
```


## Subscription review notes (set 2026-09-26 through the API)

**Yearly** (`6816231377`):

```
Premium Yearly, $29.99 per year: the recommended plan, shown first on every paywall. Eligible new subscribers get a 7-day free trial, and the screen after the purchase confirms the day billing starts. To reach a paywall: on a fresh install choose 18+ during onboarding and follow the first run to the offer; afterwards use Settings > Premium, or tap a crowned lesson and then "See Premium". Learners 13 and over may get one of four Superwall paywall designs (listed in the app's review notes); every one reads prices from StoreKit, names the billed price on its buy button, and shows "Continue with free lessons", Restore, Terms of Use and the Privacy Policy. For a learner under 13 the paywall sits behind "For grown-ups" and a parental check (a sum written in words).
```

**Weekly** (`6816231413`):

```
Premium Weekly, $3.99 per week, no introductory offer. On the app's own paywall and in Superwall designs 1 and 3 it is under "View more plans"; designs 2 and 4 show both plans as cards. To reach a paywall: on a fresh install choose 18+ during onboarding and follow the first run to the offer; afterwards use Settings > Premium, or tap a crowned lesson and then "See Premium". Learners 13 and over may get one of four Superwall paywall designs (listed in the app's review notes); every one reads prices from StoreKit, names the billed price on its buy button, and shows "Continue with free lessons", Restore, Terms of Use and the Privacy Policy. For a learner under 13 the paywall sits behind "For grown-ups" and a parental check (a sum written in words).
```

## 1.1 (drafted 2026-09-30; goes on the record when 1.1 is cut, then this section replaces the ones above)

**What's new**

```
• A new path, Around Town: ten lessons, from a shop front and a phone box to a canal bridge and a corner café.
• Photographed your drawing in dim light? Choose Original, Bright or Scan.
• Change a kept page's light and corners any time in your sketchbook.
• See how long each drawing really took, and the screen stays awake while you draw.
• Every path has its own color.
• Premium Lifetime: one payment, no renewal. And "Redeem a code" in Settings.
• Layouts that make better use of the iPad.
```

**Promotional text** (167/170): Draw real pictures on real paper. Lina shows one line at a time, then waits while you draw it. New: Around Town. Every path starts free; Premium opens all 110 lessons.

**Keywords** (100/100): lessons,sketching,tutorial,urban,pencil,drawings,how,beginner,sketch,art,simple,guide,pen,adult,kids
("mindful" out; "urban" pairs with "sketching", and "kids" with "drawings" and "lessons".)

**Description**: the one below under *Listing copy*, with these changes, and still no price:

```
• 110 lessons on 11 paths: Plants, Fruits, Sky & Weather, Forms, Wheels, On the Water, In the Air, Space, Landscape, Food & Treats, and Around Town
• A sketchbook: photograph your finished drawing, even in dim light (Original, Bright or Scan), keep it beside the lesson on your phone only, and fix its light and corners later

FREE AND PREMIUM
Every path is open, and the first three lessons of each path are free. Paper Coach Premium unlocks every lesson on every path:
• Yearly, with a 7-day free trial for new subscribers
• Weekly
• Lifetime: one payment, no renewal
Every plan can be shared with your family through Family Sharing.

Payment is charged to your Apple Account when you confirm the purchase, or when the free trial ends. Yearly and Weekly renew automatically unless canceled at least 24 hours before the end of the current period; you can manage or cancel them in your Apple Account settings at any time. Any unused part of a free trial is forfeited when you buy a subscription. Lifetime is a one-time purchase.
```

**App Review notes** (the 1.0 notes above, with these changes):
- First paragraph, after the PostHog sentence: "From 1.1 the app also sends crash and hang reports from Apple's MetricKit to PostHog, each under a random id of
  its own, linked to no learner (App Privacy: Crash Data and Performance Data, not linked, App Functionality)."
- WHAT THE APP DOES: "There are 11 paths of 10 lessons."
- PRODUCTS: add "- com.softroni.papercoach.premium.lifetime: non-consumable, $99.99, one payment, Family Sharing. The third row
  under "View more plans" on the app's own paywall. To see it: choose an age under 13 during onboarding, tap a crowned
  lesson, "This part is for a grown-up", answer the check, then "View more plans" on the grown-up's paywall.
  Settings > Premium > "Redeem a code" opens Apple's offer-code sheet (behind the same check for a child)."
  (If Lifetime is added to the Superwall designs before submitting, say which.)
- New paragraph, RATINGS: "After a learner 13 or over finishes a third drawing, and never in the first session, the app may
  ask for a rating through StoreKit's requestReview, at most once per version. Never for a learner under 13."

**Subscription review notes** (both): replace "or tap a crowned lesson and then "See Premium"" with "or tap a crowned
lesson"; replace "behind "For grown-ups" and a parental check" with "behind "This part is for a grown-up" and a parental
check".

**Lifetime review note** (`6817900719`), with a screenshot of the plans sheet showing it:

```
Premium Lifetime, $99.99, one payment with no renewal, Family Sharing. It unlocks the same Premium as the subscriptions: every lesson on every path. It is the third row under "View more plans" on the app's own paywall; to reach it, choose an age under 13 during onboarding, tap a crowned lesson, "This part is for a grown-up", answer the parental check (a sum written in words), then "View more plans". It can also be redeemed with an offer code through Settings > Premium > "Redeem a code". Its price comes from StoreKit and is the largest price in its row, named on the buy button.
```

## Listing copy (already on the record)

**Name** (26/30): Paper Coach: Learn to Draw
**Subtitle** (30/30): Easy Line Drawing Step by Step
**Keywords** (99/100): lessons,sketching,tutorial,mindful,pencil,drawings,how,beginner,sketch,art,simple,guide,pen,adult
**Promotional text** (150/170): Draw real pictures on real paper. Lina shows one line at a time, then waits while you draw it. Every path starts free, and Premium opens all 100 lessons.

**Description** (never name a price here: the App Store lists the plans' prices itself, and a description can't be
edited once its version is on sale, so 1.0's "$19.99" and "$1.99" went stale when prices rose on 2026-10-02)

```
Paper Coach turns your phone into a patient drawing teacher for real pen and paper.

Pick a picture. Lina, your coach, draws one line on the screen and then waits. You copy that line onto your page and tap "I drew it". Nothing moves on until you do. Step by step, the picture appears on your paper, in your own hand.

WHAT YOU GET
• 100 lessons on 10 paths: Plants, Fruits, Sky & Weather, Forms, Wheels, On the Water, In the Air, Space, Landscape, and Food & Treats
• Three levels, Starter, Core and Advanced, so the first lessons are simple and the later ones build on them
• Every step is shown as a moving line, so you can see where it starts, where it goes and where it stops
• Lina narrates each step, and you can turn her voice off
• Turn the phone sideways for wide pictures
• A sketchbook: photograph your finished drawing and keep it beside the lesson, on your phone only
• Profiles for everyone in the family, each with their own progress and sketchbook
• A gentle practice reminder, if you want one

MADE FOR BEGINNERS
No tablet, no stylus, no talent required. Paper Coach is for anyone who says "I can't draw": kids, teens and adults. Lessons take five to ten minutes and end with something you made.

FREE AND PREMIUM
Every path is open, and the first three lessons of each path are free. Paper Coach Premium unlocks every lesson on every path:
• Yearly, with a 7-day free trial for new subscribers
• Weekly
Both plans can be shared with your family through Family Sharing.

Payment is charged to your Apple Account when you confirm the purchase, or when the free trial ends. The subscription renews automatically unless it is canceled at least 24 hours before the end of the current period. You can manage or cancel it in your Apple Account settings at any time. Any unused part of a free trial is forfeited when you buy a subscription.

Privacy Policy: https://softroni.com/privacy-policy
Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

YOUR DRAWINGS STAY YOURS
Paper Coach needs no account. Lessons live on your phone, and your photos stay in the app's sketchbook.
```

The last line read "…, and nothing is sent anywhere." on the record as filled on 2026-09-25. With Superwall that is no
longer true for learners 13 and over; the record was changed to this shorter line on 2026-09-26.

**Subscriptions** (display name ≤ 30, description ≤ 45; they match `PaperCoach.storekit`)

| Product | Display name | Description |
|---|---|---|
| yearly | Premium Yearly | Every lesson on every path. Free first week. |
| weekly | Premium Weekly | Every lesson on every path, billed weekly. |

The description's prices must be kept in step with App Store Connect if the price ever changes; the paywall itself
reads prices from StoreKit.
