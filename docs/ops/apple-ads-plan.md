# Apple Ads: the launch plan

## Current setup (2026-10-01, Claude as ads and sales manager)

The launch bids below won no auctions: in the first 16 hours the 24 exact keywords had 0 impressions at
$0.50–1.00, while US drawing searches clear at about $1.50–2.75 a tap; only Discovery's broad match showed (132
impressions, 0 taps, $0 spent). So on Oct 1:

| Campaign | Daily | Bids |
|---|---|---|
| PC - US - Category | $8 | learn to draw $2.25 · how to draw $2.00 · drawing lessons, draw step by step, step by step drawing, learn drawing, drawing for beginners, sketching for beginners $1.75 · how to draw app $1.75 (moved from Competitors) · learn to draw for adults, drawing for adults $1.50 (new) · easy drawing, drawing tutorial, draw easy, how to draw easy $1.40 · how to draw for kids, drawing for kids $1.20 (a probe) |
| PC - US - Discovery | $4 | broad learn to draw, drawing lessons, how to draw $0.90; Search Match at the $0.60 default; "ve" and the two new adult terms excluded |
| PC - US - Brand | $1 | $0.50 (almost nobody searches the name yet) |
| PC - US - Competitors | paused | rivals with 240k–788k ratings, median $3.26 a tap: the worst value for an app with none |

$13 a day in all, inside the $150 learning budget (rules: [README.md](README.md) › *Apple Ads*). An impression-share
report (73149732) was requested for Sep 30–Oct 1. The table below is the launch plan, kept as history.

Written 2026-09-27, before 1.0 was approved. Carried out the day Apple approves 1.0 (the heartbeat or the
daily check that sees `READY_FOR_SALE`). The rules that govern it afterwards are in
[README.md](README.md) › *Apple Ads*.

## Before creating anything

1. The app is on sale: `python3 docs/ops/today.py check` shows the live version as `READY_FOR_SALE`.
2. Apple Ads can see it: `superwall asa apps eligibility 6816231257 --app 54792` answers (a 404 means
   not yet; try again at the next run).
3. Exact request shapes: `superwall asa docs campaigns`, `superwall asa docs adgroups`,
   `superwall asa docs keywords`, `superwall asa docs negative-keywords`. Every call takes
   `--app 54792` (GeoBlitz's connection, which reaches the Softroni LLC org 20605790).

## Campaigns (US, $10 a day in all)

All campaigns are Search results, US only, iPhone and iPad, all ages, cost per tap. Each has one ad
group with the default product page. Names start with `PC - US -` so they never mix with GeoBlitz's.

| Campaign | Daily | Match | Max CPT | Keywords |
|---|---|---|---|---|
| PC - US - Brand | $1 | exact | $0.50 | paper coach · papercoach · paper coach drawing · paper coach learn to draw |
| PC - US - Category | $5 | exact | $1.00 | learn to draw · how to draw · drawing lessons · draw step by step · step by step drawing · how to draw for kids · drawing for kids · easy drawing · drawing tutorial · learn drawing · drawing for beginners · draw easy · sketching for beginners · how to draw easy |
| PC - US - Competitors | $2 | exact | $0.80 | simply draw · artworkout · drawing desk · art for kids hub · drawy · how to draw app |
| PC - US - Discovery | $2 | broad, and search match on | $0.60 | learn to draw · drawing lessons · how to draw (broad) |

Excluded keywords, on every campaign: procreate · ibis paint · animation · coloring · paint by
number · tattoo · anime. Discovery also excludes every exact keyword of the other three campaigns, so
they don't bid against each other.

Why these: the searches that return the apps Paper Coach competes with (Simply Draw 784k ratings,
Drawing Desk 240k, ArtWorkout 237k, Art For Kids Hub, Drawy, How To Draw) on 2026-09-27. The ASO
engine's popularity scores came back 90–98 for every term, too flat to choose by, so the first two
weeks of Apple's own numbers decide: the budget moves toward the keywords whose installs turn into
trials and purchases in PostHog (`install_attributed` and the `asa_keyword_id` on later events).

## After creating them

- `python3 docs/ops/today.py log "Apple Ads: 4 campaigns live, US, $10 a day"`, and in
  `.studio/ops/notes.json` set `ads.state` to `running`, then `publish`.
- Every week (the Monday daily check): move converting search terms from Discovery to exact in
  Category, exclude the ones that don't fit, apply the budget rule, and note every change in the log.
