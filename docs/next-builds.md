# What to build next, for revenue

Written 2026-09-27, from Kevin and Claude's review of the plan to make Paper Coach profitable. **A session that
plans or builds features reads this first.** Features are built in Kevin's sessions (docs/ops/README.md); this is the
ranked list of what earns most, with enough of a spec to start. When an item ships, mark it done with the commit and
the version. Claude updates *The numbers* as real data arrives.

## The numbers behind it

| | Today | Why it matters |
|---|---|---|
| Yearly plan | **$29.99** from 2026-10-02 ($19.99 before), 7-day free trial | about **$25.50** a year after Apple's cut (Small Business Program) |
| Weekly plan | **$3.99** from 2026-10-02 ($1.99 before), no trial | the anchor; some buy it, most shouldn't |
| Cost of an install from Apple Ads | unknown; GeoBlitz paid **$1.61** on its one German day, and drawing in the US is more crowded (Simply Draw has 784k ratings) | assume **$1.50–3** until Paper Coach's own numbers replace it |
| Ads pay for themselves when | one in about **13** ad installs becomes a yearly subscriber (at $2 an install; one in 8 at $19.99) | hard, but within reach of a good funnel |

At $19.99 the ads were unlikely to pay for themselves, and the budget rule (spend only what the ads earn back) would
have stopped them after the first $150. So from 2026-10-02 the prices are $29.99 a year and $3.99 a week (Kevin's
call, 2026-09-30, from what the category charges: Drawing Desk $39.99–49.99 a year, ArtWorkout $29.99–69.99, Simply
Draw about $60–120). The price, and who the offer reaches, still matter more than paywall wording. Hence the order
below.

## 1. Premium recognises any product in its subscription group (small, do first)

**Built 2026-09-30, not shipped:** on `main` in `508ec63`, for 1.1. Until 1.1 is on sale, 1.0 (2) still counts only
the two ids, so item 2 still waits. What was built: Premium's group id is stored (`PremiumStore.subscriptionGroupID`,
22413930, checked against App Store Connect), and the two plans' ids still count too; `Plan(_ product:)` reads the
renewal period; "Your free week has started" now names the price of the product the week began on (it named
Yearly's). Tests in `PremiumGroupTests`, on plain values: `SKTestSession` fails under `xcodebuild` here.

**Why:** a price test needs new products. Today `PremiumStore.refreshEntitlements()` counts only the two ids in
`PremiumStore.ProductID.all`, so a subscriber to a new product (a $39.99 yearly, say) **would be charged and still see
the crowns**. Nothing may sell a new product until a build with this change is on sale.

**Build:**
- Grant Premium for any verified, unrevoked transaction whose `subscriptionGroupID` is Premium's group (read the id
  from a loaded product's `subscription?.subscriptionGroupID`, or store it), not for a fixed list of ids.
- `PremiumStore.Plan(productId:)` maps any yearly product to `.yearly` and any weekly one to `.weekly` (by the
  product's subscription period), so `purchase_attempted` keeps reporting the plan.
- Trial wording keeps reading the product's own introductory offer; nothing assumes $19.99 or 7 days beyond
  `trialDays`.
- Tests: a transaction for an unknown product in the group unlocks Premium; one outside the group does not; plan
  mapping by period.

**Done when:** the build is on sale. Claude then may create price-test products (item 2), once Kevin agrees the prices.

## 2. A price test (Kevin sets the prices; after item 1 is on sale)

**Why:** the biggest lever on whether ads can pay, and on revenue from every learner who does subscribe.

**Plan:**
- Kevin picks the prices. Suggested: yearly **$39.99** (and perhaps $49.99) against today's $29.99, each with the
  same 7-day free trial, in the same subscription group (new product ids such as `…premium.yearly.b`).
- Claude adds them in App Store Connect, submits them with the next version, and runs the test in Superwall (13+
  learners): one paywall design, two or three prices, equal shares.
- **Judge by revenue per paywall open over at least 14 days**, so trials have time to turn paid (Apple's subscription
  event report, read by `docs/ops/today.py`). Not by trial starts: a lower price always wins on trials.
- The app's own paywall (children's grown-ups) keeps $29.99 until the test has a winner; then the winner goes there
  too, as an app change.

## 3. The grown-up's door, where a grown-up is likely to be (medium)

**Why:** children can't buy; their grown-ups do. Children are probably most learners, and their offer sits behind the
grown-up gate ("This part is for a grown-up", then the parental check), which no test reaches.

**The rule that stays** (README › Premium › *Children*): a child never sees a price, and **nothing asks a child to go
and get, or persuade, a grown-up.** Every idea below addresses the adult directly, behind the parental check, and is
easy for a child to ignore.

**Build:**
- **Setup.** When onboarding's age answer is a child's, the person answering is often the parent holding the phone.
  After the child's first finished drawing, where the first run would lead a 13+ learner to the paywall, show a
  quiet card addressed to the adult ("For the grown-up who set this up") → the parental check → the grown-up's
  paywall (`GrownUpPaywallView`, already showing the child's drawing and wish list). Skipping it continues exactly as
  today.
- **The sketchbook.** Grown-ups look at the drawings. Give the sketchbook a small "For grown-ups" entry to the
  grown-up gate, the same door a child's tap on a crowned lesson opens.
- **Measure it:** `offer_screen_viewed` with a new `entry` value for each door, so the dashboard shows which door
  leads to purchases.

## 4. Ask 13+ learners for a rating (small)

**Built 2026-09-30, not shipped:** on `main`, for 1.1. What was built: `RatingPromptPolicy`
(`PaperCoach/App/RatingPrompt.swift`) decides, and `CompletionView` asks two seconds after the page lands (leaving
the screen first cancels it). A lesson drawn again counts as another finished drawing; a session is a launch or a
return from the background, and the first is the one the learner was added in; "once per version" is per device,
since a rating belongs to the Apple account. Tests in `RatingPromptTests`. How to read its effect:
docs/ops/README.md › *Rating prompt*.

**Why:** a new app with no ratings loses people in search results and in ads. The Settings row that opens the
review page is there, but almost nobody goes looking for it.

**Build:**
- After a learner 13 or over finishes a drawing, from their third finished drawing on and never in their first
  session, call StoreKit's `requestReview`. At most once per app version; iOS itself limits it further.
- Never for the child tier.
- Event: `rating_prompt_requested`, so the prompt's effect on ratings can be read against App Store Connect.

## 5. Premium Lifetime, and redeeming a code in the app (medium, in 1.1)

**Why:** Kevin wants friends and family to have Premium for good. Subscription offer codes stop at a year free, but
since iOS 18.4 (back-deployed to 16.3) offer codes also work for one-time purchases, so a **Lifetime** product plus
free one-time codes does it. Lifetime is also a plan anyone can buy. Decided with Kevin 2026-09-30.

**The product** (Kevin creates it in App Store Connect; it is submitted with 1.1):
- Non-consumable `com.softroni.papercoach.premium.lifetime`, **$99.99** (US base, Apple's equivalents elsewhere),
  Family Sharing on, display name "Paper Coach Premium Lifetime", description "Every lesson on every path, for good."

**Build:**
- `PremiumStore` loads Lifetime with the two plans, and a verified, unrevoked Lifetime transaction (a non-consumable
  in `Transaction.currentEntitlements`, bought or from a code, own or family-shared) grants Premium, alongside any
  product of the subscription group (item 1). `Plan.lifetime`; `purchase_attempted` reports `plan: lifetime`.
  Restore finds it. Nothing about the trial or its reminder applies to it.
- **The plans sheet** ("View more plans", on `PaywallView` and `GrownUpPaywallView`) gets a third row, below Yearly
  and Weekly: "Lifetime", the billed amount as its largest price ("$99.99", "one payment, no renewal"), and a buy
  button that names it ("Buy for $99.99"). Never preselected, never on the main page: Yearly stays the plan the
  paywall sells. Every price from StoreKit; nothing typed in.
- **Settings › Premium › "Redeem a code"**: StoreKit's `offerCodeRedemption(isPresented:)`, then refresh the
  entitlements. For the child tier it sits behind the parental check, like every other way to Premium. Event
  `offer_code_sheet_opened`; a Premium that arrives by code is recognisable by `transaction.offer?.type == .code`
  (event `premium_from_code`, with the plan).
- `PaperCoach.storekit` gets the non-consumable at $99.99, so Xcode runs and the harness show it.
- Tests: Lifetime grants Premium (own and family-shared); a revoked one doesn't; plan mapping; the plans sheet lists
  three plans with Yearly selected; the redeem row is behind the check for a child.
- Superwall's four designs are left as they are (Claude may add Lifetime to them later); App Review finds Lifetime on
  the app's own plans sheet, which the review notes will name.

**Then (Claude, after 1.1 is approved):** Kevin creates a free one-time offer code for Lifetime ("Friends & Family"),
downloads the codes, and Claude turns them into one redeem link per person.

## What Claude does meanwhile (no app change)

- Custom product pages: one for parents (children drawing, the parental check, no ads) and one for adults (calm
  sketching). Apple Ads' kids keywords point at the first, the rest at the second.
- Reads Apple's subscription event report daily: trials started, trials turned paid, renewals, refunds.
- Cuts the onboarding A/B test to two designs as soon as one is clearly behind: there is too little traffic for three.
- Keywords and promotional text with every release (docs/ops/README.md).

## Order (decided 2026-09-30)

**1.1 carries items 1, 4 and 5**, with Urban's Café and everything on `main` since 1.0 (2); it is cut once all of
them are merged (item 1 is: `508ec63`). The plan and its checklist: [docs/releases/1.1.md](releases/1.1.md). The price test (2) starts as soon as
1.1 is on sale. Item 3 goes in the build after.
