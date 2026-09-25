# Paper Couch on App Store Connect

The record and its copy, as set on 2026-09-25 through the App Store Connect API (see
`~/.claude/CLAUDE.md` for the key and helper). Everything below is en-US; the app has one locale.

| Item | Value |
|---|---|
| App | Paper Couch: Learn to Draw, Apple ID `6816231257` |
| Bundle ID | `com.softroni.papercoach` (team PLQFG9VC25, In-App Purchase capability on) |
| SKU | `papercouch` |
| Version | 1.0, state Prepare for Submission, release after approval |
| Price | Free, base territory United States |
| Categories | Education, then Graphics & Design |
| Age rating | nothing declared (4+); not in the Kids category |
| Content rights | does not use third-party content |
| Copyright | 2026 Softroni LLC |
| Privacy policy | https://softroni.com/privacy-policy |
| Support / marketing | https://softroni.com/support · https://softroni.com |
| Subscription group | Paper Couch Premium (`22413930`), shown in the app as "Paper Couch" |
| Yearly | `com.softroni.papercoach.premium.yearly` (`6816231377`), $19.99, 1-week free trial, Family Sharing, level 1 |
| Weekly | `com.softroni.papercoach.premium.weekly` (`6816231413`), $1.99, no offer, Family Sharing, level 2 |

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
3. **App Privacy.** Answer "Data Not Collected". The app has no analytics sink, no account, and the sketchbook
   photos stay on the device (`PaperCoach/PrivacyInfo.xcprivacy` says the same).
4. **iPad 13" screenshots** (2064 × 2752), required while the target includes iPad. On the iPadOS 26 simulator the app
   opens in a window smaller than the screen, so the captures came out with black around them; either decide how
   the app should behave in iPad windowing, or make it iPhone-only (`TARGETED_DEVICE_FAMILY = 1`), which drops the
   requirement.
5. **A build.** Archive from Xcode with the PaperCoach scheme, upload, wait for processing, pick it on the 1.0 page.
   Export compliance is already answered in `Info.plist` (`ITSAppUsesNonExemptEncryption` = NO), and the privacy
   manifest ships in the bundle.
6. **Try the purchase flow on a device against the sandbox** before submitting (README, M10).
7. Submit the app and both subscriptions together in one review submission.

## App Review notes (paste into "Notes")

```
Paper Couch 1.0 requires no account or sign-in. Everything is on the device: the lessons ship in the bundle, the camera is used only when the learner chooses to photograph a finished drawing, and that photo is kept in the app's own sketchbook (and saved to Photos only while the "Also save to Photos" switch is on). No analytics or third-party SDK is included; nothing is sent off the device.

WHAT THE APP DOES
The phone is a drawing instructor for real pen and paper. Each lesson animates one line, then waits until the learner taps "I drew it". There are 10 paths of 10 lessons. Lessons 1-3 of every path are free; lessons 4-10 wear a gold crown and need Premium.

ONBOARDING AND AGE
Onboarding asks who is drawing and for an age band. Under 13 or "Prefer not to say" is treated as a child: crowns say "Ask a grown-up" and the price sits behind a parental check (a sum written in words, or the app's PIN if one was set). 13 and over gets the ordinary flow. To reach the paywall directly, choose 18+ during onboarding.

REACHING THE PAYWALL
On a fresh install the guided first run leads through the first lesson, the sketchbook, "More coming", "7 days free" and the reminder promise to the paywall. Afterwards: Settings > Premium, or tap any crowned lesson. The one way past the paywall without buying is the link "Continue with free lessons".

PRODUCTS (subscription group "Paper Couch Premium", both Family Sharing)
- com.softroni.papercoach.premium.yearly: auto-renewing, $19.99 per year; eligible new subscribers get the displayed 7-day free trial. This is the recommended plan, shown first.
- com.softroni.papercoach.premium.weekly: auto-renewing, $1.99 per week; no introductory offer; under "View more plans".
All displayed prices come from StoreKit. The paywall shows the billed amount as the largest pricing element, names the price on the purchase button, states the trial length and the price charged after it, and carries Restore Purchases, Terms of Use (Apple's standard EULA) and the Privacy Policy. Restore is also in Settings.
```

## Listing copy (already on the record)

**Name** (26/30): Paper Couch: Learn to Draw
**Subtitle** (30/30): Easy Line Drawing Step by Step
**Keywords** (99/100): lessons,sketching,tutorial,mindful,pencil,drawings,how,beginner,sketch,art,simple,guide,pen,adult
**Promotional text** (150/170): Draw real pictures on real paper. Lina shows one line at a time, then waits while you draw it. Every path starts free, and Premium opens all 100 lessons.

**Description**

```
Paper Couch turns your phone into a patient drawing teacher for real pen and paper.

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
No tablet, no stylus, no talent required. Paper Couch is for anyone who says "I can't draw": kids, teens and adults. Lessons take five to ten minutes and end with something you made.

FREE AND PREMIUM
Every path is open, and the first three lessons of each path are free. Paper Couch Premium unlocks every lesson on every path:
• Yearly: $19.99 per year, with a 7-day free trial for new subscribers
• Weekly: $1.99 per week
Both plans can be shared with your family through Family Sharing.

Payment is charged to your Apple Account when you confirm the purchase, or when the free trial ends. The subscription renews automatically unless it is canceled at least 24 hours before the end of the current period. You can manage or cancel it in your Apple Account settings at any time. Any unused part of a free trial is forfeited when you buy a subscription.

Privacy Policy: https://softroni.com/privacy-policy
Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

YOUR DRAWINGS STAY YOURS
Paper Couch needs no account. Lessons live on your phone, your photos stay in the app's sketchbook, and nothing is sent anywhere.
```

**Subscriptions** (display name ≤ 30, description ≤ 45; they match `PaperCoach.storekit`)

| Product | Display name | Description |
|---|---|---|
| yearly | Premium Yearly | Every lesson on every path. Free first week. |
| weekly | Premium Weekly | Every lesson on every path, billed weekly. |

The description's prices must be kept in step with App Store Connect if the price ever changes; the paywall itself
reads prices from StoreKit.
