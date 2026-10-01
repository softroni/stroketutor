# Fantasy Objects (`fantasy-objects`) — image-generation prompts

Source art for the ten `fantasy-objects` lessons (Advanced level, learners aged 16 and up) in `plan.json`,
written for a raster image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`. The **system prompt** is
the Advanced level's; only the **lesson prompt** changes.

**2026-10-01: a new lineup and new prompts.** The path was reworked to look better and to sell Premium:
lessons 1–3 are free (potion bottle, crown, hourglass), 4–7 are the paid pictures whose stickers end the free
lessons' videos (sword, spellbook, cauldron, crystal ball), 8–9 are breathers (shield, crystal cluster), and
the treasure chest, with the crown and the sword on its heap, is the finale. The prompts of the first lineup
(2026-09-21, written for `style-v2`, with the magic wand, the key and the wizard hat) are in git history.

## How to run them

- **System prompt: `style-v5-advanced`**, the Advanced level's, copied from the level's menu in the Studio
  (System prompt…). It lives in `ADVANCED` in `web/src/studio/levelPrompts.ts`. Give it to the image model as
  its system / instructions prompt, once, and send each lesson prompt below as the message; where a tool has
  no such field, send the system prompt, a blank line and the lesson prompt as one message. It already carries
  the course's look, the line weight, how an attached picture is matched, the views, drawn light, the palette
  and the composition, so the lesson prompts add to it and never say it again.
- **Attach the published apple** (`docs/curriculum/fruits/apple-openai.png`) to every request; the system
  prompt says how to match it, so there is no reference line. `treasure-chest` also gets the kept `crown` and
  `sword` pictures: make it last.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the prettiest.
  Reject any candidate that gets a count wrong: the counts are the lessons' teaching points.
- Save the kept PNGs as `docs/curriculum/fantasy-objects/<lesson-id>-<model>.png`, and record model, date and
  the system prompt's version (`style-v5-advanced`) in the lesson's `--source`.

What the lesson prompts on this path take care of, beyond the system prompt:

- **Magic shown by shape and color only.** Nothing glows, shines, smokes or sparkles. The only stars are the
  three painted on the crystal ball, named there as flat closed shapes.
- **Precious things in the palette.** Gold is yellow, with orange as its darker partner; metal and silver are
  gray; black iron is purple; a gem is a light and a dark partner of one color, split by one line.
- **What sits on what.** Every part that is attached says where, along one shared line. Where one part hides
  the end of another (a ball on a crown's point, the grip's ends under the sword's guard and pommel, the ball
  in its cup), the prompt says so.
- **Overlap only where the subject needs it:** the crown's cap behind its points, the ladle in the brew and
  over the rim, and the finale, whose prompt lists every overlap it allows.
- **Views.** Flat front views, except the crown and the cauldron (a little from above, for their curves), the
  sword (turned 45 degrees, to be big), and the spellbook and the chest in three-quarter view with parallel
  edges and no vanishing points.
- **No letters, runes or symbols** on the tag, the book or the shield, and no skulls, eyes or bones anywhere.

## System prompt (`style-v5-advanced`)

Not copied here: take it from the Advanced level's menu in the Studio (System prompt…), or from `ADVANCED` in
[levelPrompts.ts](../../web/src/studio/levelPrompts.ts). A change to it gets a new version, so a lesson's
`--source` still says which prompt made its picture.

## Lesson prompts

Each is complete as written, on top of the system prompt; the counts are the lesson's teaching points.

### 1 · `potion-bottle`

Objective: Round flask of purple potion with five bubbles, a ringed neck, a cork and a tag.

The first lesson, posted first on social and shown as a sticker on other paths' videos, so the most
eye-catching simple picture: a round flask, a colored potion under one wavy line, five bubbles. The neck is a
stack of short pieces and gold rings, each its own shape, so the rings are drawn as parts, not as bands across
the neck.

```text
SUBJECT: one round potion flask, upright, with purple potion in it, exactly five bubbles in the
potion, a neck with exactly three gold rings, a cork, and a tag hanging from the neck on a string.
- Flask: one closed outline: a large round body, almost a circle, a little flattened at the
  bottom so it could stand, and a short straight neck rising from the top of the body, about a
  quarter as wide as the body. Body and neck are one shape with one outline.
- Potion: exactly one gently wavy line across the body, a little above its middle, with two
  shallow waves, from the left side of the outline to the right side, touching it at both ends:
  it divides the body. Below it is the potion. Color: purple #7b4fa3. Above it, the empty glass
  and the neck are one area. Color: blue #5b8fc7.
- Rings: the neck goes on up as a stack. On the top of the neck sits the first ring: a low band a
  little wider than the neck, sticking out past both its sides. On the ring stands a second short
  piece of neck, as wide as the first, then the second ring, then a third short piece of neck,
  then the third ring at the very top, the lip. Every ring and every piece of neck is its own
  closed shape, about four line-widths tall, and each shares one line with the next. Colors: the
  three rings yellow #f7cf46, the pieces of neck blue #5b8fc7.
- Cork: one closed shape standing on the lip, narrower than the lip, a little wider at its top
  than at its bottom, with a flat top and gently rounded top corners. Its bottom edge is the lip's
  top edge (one shared line). Color: brown #8a5a33.
- Bubbles: exactly five circles in the potion: one large (about 9% of the image wide), two
  medium (7%) and two small (5%), spread out over the potion. Each floats: a strip of purple at
  least three line-widths wide lies all around it, and it touches neither the flask's outline,
  nor the wavy line, nor another bubble. Color: watermelon pink #ee5a6a.
- Tag: one small closed shape with five straight sides: an upright rectangle whose top is a
  point, like a gift tag, about 13% of the image tall. It hangs in the white to the right of the
  flask's body, clear of it: a gap of white at least three line-widths wide lies between them.
  Nothing is written or drawn on it. Color: cream #f6e7b8.
- String: exactly one single bold line, gently curved, in the same charcoal as the outlines and
  with no color: not a cord, not a tube. It starts at the right end of the lowest ring and runs
  out to the right and down to the tag's top point, touching only those two.
The flask and its tag together fill about 70% of the image across, so the flask itself stands a
little left of center.
Nothing else: no label, picture or skull on the flask, no knot or bow on the string, no hole in
the tag, no bubbles above the potion, no shine lines on the glass, no steam, smoke or drips, no
stand.
Count the bubbles: five. Count the rings: three.
```

### 2 · `crown`

Objective: Jeweled crown with five ball-tipped points, a band of seven jewels and a velvet cap.

Repeated ornament, the creator's favorite kind of detail: five points with a ball on each, seven jewels
alternating in shape. Seen a little from above, so the band curves like the front of a ring. From the front,
the velvet cap can only show between the points, as four purple pieces in the dips.

```text
SUBJECT: one crown: a band with exactly seven jewels, exactly five points standing on it, each
with a ball on its tip, and a velvet cap inside the crown that shows between the points.
VIEW: seen from the front and a little from above, so the band's top and bottom edges are two
parallel gentle curves that sag a little in the middle. Only the front of the crown shows: no
back points, no inside, no ellipse at the top or the bottom.
- Band: one wide closed shape, about five times as wide as it is tall, its two ends straight and
  upright. Color: orange #f08a2c.
- Points: one closed shape standing on the band: its bottom edge is the band's top edge, one
  shared line, drawn once, and its two sides rise straight up from the band's ends. Its top is a
  row of exactly five points with four V-shaped dips between them. The middle point is the
  tallest, the two beside it a little shorter and the two outer ones the shortest, so the tips
  make one gentle arch. The dips stop well above the band, so the shape stays one piece. The
  points are wide, not thin. Color: yellow #f7cf46.
- Balls: exactly five circles, one on the tip of each point, all the same size, about 6% of the
  image wide. Each point's two edges end on its ball's outline: the ball hides the very tip.
  Neighboring balls keep a clear gap of white between them. Color: cream #f6e7b8.
- Velvet cap: one shape behind the points. Its top edge is one smooth arch that starts on the
  inner side of the leftmost point, crosses each of the four dips above its bottom and ends on the
  inner side of the rightmost point, staying well below the tips and the balls. The points stand
  in front of the cap and hide the rest of it, so it shows only in the four dips, as four pieces
  of purple, each between the two edges of a dip and the arch above it. Color: purple #7b4fa3.
- Jewels: exactly seven jewels in one row along the middle of the band, following its curve,
  evenly spaced, alternating in shape: round, diamond, round, diamond, round, diamond, round. The
  round ones are circles; the diamond ones are squares standing on one corner. All are about the
  same size, about 6% of the image wide. Each floats: a strip of orange at least three line-widths
  wide lies all around it, and it touches neither the band's outline nor another jewel. Colors:
  the four round jewels blue #5b8fc7, the three diamond jewels red #d8433b.
Nothing else: no cross or orb on top, no arches over the cap, no fur trim, no cushion, no dots,
lines or pattern on the band or the points, no facet or shine lines on the jewels or the balls.
Count the points: five. Count the balls: five. Count the jewels: seven.
```

### 3 · `hourglass`

Objective: Hourglass with stacked caps and two turned posts, sand falling into a heap.

Stacked tiers and a mirror image: two slabs at each end, two posts with three beads each, two bulbs of
glass. The objective first said three posts, but from the front the third one stands behind the glass, so it
has two. The falling sand is one charcoal line: a colored stream that thin would be a tube.

```text
SUBJECT: one hourglass standing upright, seen straight on from the front: a cap of two stacked
slabs at the top and at the bottom, exactly two turned posts at the sides, and between them the
glass, with sand in its top half, the sand falling, and a heap of sand in its bottom half. Its
left half mirrors its right half.
- Bottom cap: two slabs stacked. Below, a wide slab: one closed shape with straight level top and
  bottom edges and rounded ends, about seven times as wide as it is tall. Color: brown #8a5a33. On
  it, a narrower slab, about two thirds as wide and a little less tall, centered: its bottom edge
  lies on the wide slab's top edge (one shared line). Color: orange #f08a2c.
- Top cap: the same two slabs upside down: the wide slab at the very top, the narrower slab under
  it. Same sizes and colors.
- Glass: one closed outline between the two narrow slabs: two round bulbs, one above the other,
  joined at a narrow waist halfway up. Its top is a short straight edge lying on the top narrow
  slab's bottom edge, and its bottom a short straight edge lying on the bottom narrow slab's top
  edge (one shared line each), each about two thirds as wide as a bulb. The bulbs are a little
  narrower than the narrow slabs. Color of the empty glass: blue #5b8fc7.
- Sand in the top bulb: exactly one level line across the top bulb, about a third of the way down
  from its top, from one side of the glass to the other, touching it at both ends. Below it, down
  to the waist, is sand. Where the glass is narrowest, exactly one short level line across the
  waist closes the sand off from the bottom bulb. Color of the sand: yellow #f7cf46.
- Falling sand: exactly one straight upright line from the middle of the waist line down to the
  top of the heap, touching both and nothing else. It is a single charcoal line, not a colored
  stream.
- Heap: exactly one curved line across the bottom bulb, from one side of the glass to the other,
  low at both sides and rising in the middle to one soft peak under the falling sand, touching the
  glass at both ends. Under it is the heap of sand, color yellow #f7cf46; above it the empty
  glass, blue. The peak stays well below the waist, so the falling line is long and easy to see.
- Posts: exactly two upright posts, one at each side, each standing on the bottom wide slab
  outside the narrow slab and reaching up to the top wide slab: its bottom edge lies on the bottom
  wide slab's top edge and its top edge on the top wide slab's bottom edge (one shared line each).
  Each post is one closed shape, a straight rod with exactly three round beads along it: one in
  the middle, one halfway between the middle and the top, one halfway between the middle and the
  bottom. Each bead is a smooth round swelling about twice as wide as the rod, so the post's
  outline bulges three times on each side. A clear gap of white at least three line-widths wide
  lies between each post and the narrow slabs and the glass. Color: cream #f6e7b8.
Nothing else: no stand, no handle, no knobs or feet on the caps, no grains or dots of sand in the
air or on the glass, no shine lines on the glass, no wood grain.
Count the posts: two. Count the beads on each post: three.
```

### 4 · `sword`

Objective: Diagonal sword with a fuller, a curled crossguard, a wrapped grip and two jewels.

The first paid lesson and the first sticker on the free videos: a big silhouette. Built upright and turned 45
degrees, so the sword runs corner to corner and is as long as the picture allows. The two jewels sit in the
middle of the crossguard and in the pommel.

```text
SUBJECT: one knight's sword: a long blade with one fuller line, a crossguard whose two arms curl
back toward the grip, a round jewel in the middle of the crossguard, a grip wrapped in five
bands, and a round pommel with a second jewel in it.
VIEW: the sword is built as if it stood upright, point up, its left half mirroring its right
half, and then the whole sword is turned 45 degrees to the right, so it runs from the pommel at
the lower left to the point at the upper right. It is seen flat, straight on. Here the subject is
not upright.
- Blade: one long closed shape with two straight parallel sides, about 8% of the image wide. Near
  its far end the two sides turn inward as two straight slanted edges and meet in one point. At
  its other end its two sides end on the crossguard's outline. Color: gray #c9ced6.
- Fuller: exactly one straight line along the middle of the blade, floating: it starts a little
  way from the crossguard, ends well before the blade begins to narrow, and touches nothing.
- Crossguard: one closed shape across the sword where the blade and the grip meet. In its middle
  is a round boss, wider than the blade. From the boss an arm goes out on each side: it runs
  straight out, then curls back toward the grip in one smooth curve and ends in a round, blunt
  tip, like a ram's horn making half a turn. The two arms mirror each other, and their tips stay
  clear of the grip, with white at least three line-widths wide between. Color: yellow #f7cf46.
- First jewel: one circle in the middle of the boss, floating: a strip of yellow at least three
  line-widths wide lies all around it. Color: red #d8433b.
- Grip: one straight shape between the crossguard and the pommel, about as wide as the blade and
  about a fifth as long as the whole sword. Its two sides start on the crossguard's outline and
  end on the pommel's outline. Exactly four straight slanted lines cross it, parallel and evenly
  spaced, each running from one side of the grip to the other and touching both: they divide it
  into five bands. Colors of the bands, from the crossguard to the pommel: brown #8a5a33, orange
  #f08a2c, brown, orange, brown.
- Pommel: one round shape at the end of the grip, about twice as wide as the grip.
  Color: yellow #f7cf46.
- Second jewel: one circle in the middle of the pommel, floating: a strip of yellow at least three
  line-widths wide lies all around it. Color: blue #5b8fc7.
The sword fills about 70% of the image both across and down: its point near the upper right, its
pommel near the lower left.
Nothing else: no scabbard, no engraving, letters or second line on the blade, no edge or shine
lines, no tassel or chain, no stone, no flames.
Count the jewels: two. Count the lines across the grip: four.
```

### 5 · `spellbook`

Objective: Thick book in ¾ view with metal corners, a jeweled medallion, a strap and a clasp.

The path's first three-quarter view, drawn with parallel edges like the Forms boxes, and made rich on the
cover: four gold corners, a sun-shaped medallion with its jewel, and a strap that comes round the page edge to
a clasp. The two page faces are cream and gray, the lit side and the side away from the light.

```text
SUBJECT: one thick closed spellbook lying flat: a cover with a metal cap on each of its four
corners and a jeweled medallion in its middle, and a strap that comes round the edge of the pages
and ends in a clasp on the cover.
VIEW: not a flat front view. The book is seen from a little above, with one upright corner turned
toward the viewer, so exactly three faces show: the cover on top, a long side on the right and a
short side on the left. Edges that are parallel on the book are drawn parallel: no vanishing
points, no dots, no horizon, no narrowing toward the back. Hidden back edges are not drawn. The
book is a plain box with straight edges: the cover does not stick out past the pages, and the
spine is at the back, out of sight.
LIGHT: from the upper left, shown only by the flat colors named for the faces: no shadow, no
hatching.
- Cover: the top face, one four-sided shape like a leaning diamond. Color: red #d8433b.
- Long side: the right face, the edge of the pages where the book opens. It is about a third as
  tall as it is long: a thick book. Color: gray #c9ced6.
- Short side: the left face, the pages' bottom edge, as tall as the long side. Color: cream
  #f6e7b8.
- Metal corners: exactly four, one on each corner of the cover. Each is a small triangle cut off
  its corner by exactly one straight line from one edge of the cover to the next, touching both:
  it divides the cover. All four are the same size, each about a fifth of the cover's short edge
  long. Color: yellow #f7cf46.
- Medallion: one round plate in the middle of the cover, tilted with the cover so it shows as an
  oval, about a third as wide as the cover's short edge, with exactly eight short round-tipped
  points around its edge, like a small sun. It floats: a strip of red at least three line-widths
  wide lies all around it, clear of the corners, the strap and the clasp. Color: yellow #f7cf46.
- Jewel: one oval in the middle of the medallion, floating: a strip of yellow at least three
  line-widths wide lies all around it. Color: blue #5b8fc7.
- Strap: one flat band about 6% of the image wide, with a straight outline on both edges. It runs
  up the long side from its bottom edge to its top edge, upright, halfway along the long side, then
  bends over the edge and carries on across the cover toward the medallion for a short way, and
  ends at the clasp. Where it bends, the cover's edge line runs across it. Colors: the part on the
  long side brown #8a5a33, the part on the cover orange #f08a2c.
- Clasp: one small square plate on the cover at the end of the strap, a little wider than the
  strap. The strap's end lies on the clasp's edge (one shared line). Color: yellow #f7cf46.
Nothing else: no title, letters, runes or symbols, no star, moon or eye on the cover, no lines on
the pages, no keyhole, no bookmark or ribbon, no rounded spine, no second strap.
Count the metal corners: four. Count the medallion's points: eight. Count the clasps: one.
```

### 6 · `cauldron`

Objective: Three-legged cauldron of green brew with bubbles, a ladle and flames under it.

A paid sticker that lands in October, when a cauldron is the best social picture there is. Seen a little
from above, so the rim is an ellipse and the brew shows. The flames stand between the legs, not behind them,
so nothing hides the legs; black iron is purple, as the palette asks.

```text
SUBJECT: one round cauldron standing on three short legs, full of green brew with exactly five
bubbles, a ladle standing in the brew, and two flames under the cauldron.
VIEW: seen from the front and a little from above, so the rim is a wide ellipse and you see the
top of the brew inside it.
- Rim: a ring around the cauldron's mouth, made of two ellipses one inside the other, with a band
  between them at least three line-widths wide all the way round. Color: gray #c9ced6.
- Brew: everything inside the inner ellipse. Color: leaf green #4f9d4a.
- Pot: one closed shape below the rim. Its top edge is the front half of the rim's outer ellipse
  (one shared line). From there its sides swell out into a round belly, wider than the rim, and
  curve in again to a gently rounded bottom. Color: purple #7b4fa3.
- Bubbles: exactly five circles of different sizes. Three are on the brew: each floats inside the
  inner ellipse, with a strip of green at least three line-widths wide all around it. Two rise
  above the cauldron, floating in the white over the brew's left part, the higher one the smaller,
  each clear of everything else. Color of all five: pale green #b9dc8a.
- Ladle: only its handle shows: one long, straight, narrow shape about 4% of the image wide. Its
  lower end is a short straight edge inside the brew's right part, where it goes into the brew;
  from there it leans up and to the right, crosses the back of the rim and ends above the cauldron
  in one rounded end. The handle hides the stretch of rim behind it: the rim's lines stop on its
  outline. Color: brown #8a5a33.
- Legs: exactly three short, stubby legs under the belly: one at the left, one in the middle and
  one at the right, each a little wider at its foot than at its top, their feet on one level. Each
  leg's top edge lies on the belly's outline (one shared line). Color: gray #c9ced6.
- Flames: exactly two flames under the cauldron, one in the gap between the left and middle legs
  and one in the gap between the middle and right legs. Each flame is two shapes: an outer flame
  with three tips, the middle one the tallest, color red #d8433b; and inside it, floating with a
  strip of red at least three line-widths wide all around it, a smaller flame with one tip, color
  yellow #f7cf46. The flames' bottoms are level with the legs' feet. Each flame keeps a clear gap
  of white at least three line-widths wide from the belly above it and from the legs beside it.
Nothing else: no logs, no smoke or steam, no drips running down the pot, no handles or ears on the
pot, no bowl of the ladle showing, no skulls, eyes or bones, no stars.
Count the legs: three. Count the bubbles: five. Count the flames: two.
```

### 7 · `crystal-ball`

Objective: Crystal ball with a swirl and three stars, on a stand with three curled feet.

The last paid sticker: one big blue ball on a gold stand of stacked tiers. The ball is opaque, and the swirl
and the stars are painted on it: the swirl is one bold line, and the stars are the path's only stars. From
the front, the third foot points at the viewer, so its curl shows as a round knob.

```text
SUBJECT: one crystal ball resting in a stand: a big ball with exactly one swirl line and exactly
three stars on it, held in a cup on a collar and a base, standing on exactly three curled feet.
The left half mirrors the right half, apart from the swirl and the stars.
- Ball: one big circle, about 50% of the image wide. Its lower part sits in the stand's cup: the
  cup's top edge is the line between them, and the cup hides the rest of the ball. The ball is
  opaque, one flat color: nothing shows through it. Color: blue #5b8fc7.
- Swirl: exactly one bold spiral line on the ball, the same charcoal line as the outlines, with
  one and a half turns, starting near the ball's middle and opening outward. It floats: it touches
  nothing. It is a line, not a colored band.
- Stars: exactly three five-point stars on the ball, around the swirl: one large (about 8% of the
  image wide), one medium (6%) and one small (5%), spread apart. Each is one closed shape with ten
  straight sides, plump rather than thin. Each floats: a strip of blue at least three line-widths
  wide lies all around it, and it touches neither the ball's outline, nor the cup, nor the swirl,
  nor another star. They are flat shapes painted on the ball, the only stars in the picture, not
  sparkles. Color: yellow #f7cf46.
- Cup: one bowl-shaped closed shape holding the ball, about two thirds as wide as the ball. Its
  top edge is one gentle curve that sags a little in the middle, and its two ends lie on the
  ball's outline. From there its sides curve in and down to a narrow bottom. Color: yellow
  #f7cf46.
- Collar: one low band under the cup, its top edge on the cup's bottom edge (one shared line), a
  little wider than the cup's bottom. Color: orange #f08a2c.
- Base: one wide, low slab with rounded ends under the collar, about as wide as the cup's top, its
  top edge on the collar's bottom edge (one shared line). Color: yellow #f7cf46.
- Feet: exactly three feet under the base, each attached to its bottom edge (one shared line). The
  left foot curves down and out to the left and turns up at its end into one round, blunt curl,
  like a small hook; the right foot mirrors it to the right; the middle foot points toward the
  viewer, so its curl shows as one round end: a short leg ending in a round knob. A clear gap of
  white at least three line-widths wide lies between the feet. Color: orange #f08a2c.
Here the ball and its stand fill a little less of the image than usual: about 65% of its height,
because the ball is one big round shape.
Nothing else: no light rays, no glow or sparkles around the ball, no shine lines on the ball, no
smoke or mist, no picture inside the ball, no cushion or cloth.
Count the stars: three. Count the feet: three.
```

### 8 · `shield`

Objective: Heraldic shield in four colored quarters, with a rim of ten rivets and a round boss.

A breather after the four paid stickers: a flat front, clean ornament, ten rivets to space evenly. The four
quarters are two colors, alternating, as in heraldry.

```text
SUBJECT: one knight's shield with a rim of exactly ten rivets, a field in four quarters of two
colors, and a round boss in the middle.
The shield is flat: no bulge, no side edge, no strap.
- Shield: one closed outline, a little taller than it is wide: a straight level top edge, two
  gently rounded top corners, and two sides that run down and curve inward to meet in one soft
  point at the bottom center. The left half mirrors the right half.
- Rim: a second outline of the same shape inside the first, the same distance from it all the way
  round, about a tenth of the image wide. The band between the two outlines is the rim. Color:
  gray #c9ced6.
- Quarters: exactly two lines divide the field inside the rim: one upright line from the middle of
  the inner top edge down to the inner bottom point, and one level line across, a little above the
  middle, from the inner left side to the inner right side; each touches the inner outline at both
  ends. Colors: top left and bottom right blue #5b8fc7, top right and bottom left red #d8433b.
- Boss: one circle where the two lines cross, about 16% of the image wide. The lines stop on its
  outline: the boss hides the crossing. Color: yellow #f7cf46.
- Rivets: exactly ten small circles on the rim, each about 4% of the image wide: one at each top
  corner, one in the middle of the top edge, three spaced down each side and one at the bottom
  point. Each floats in the middle of the rim's width, with a strip of gray all around it: it
  touches neither outline nor another rivet. Color: yellow #f7cf46.
Nothing else: no animal, cross, letters or emblem, no stripes, no dents, scratches or wood grain,
no shine lines, no straps, no sword.
Count the rivets: ten. Count the quarters: four.
```

### 9 · `crystal-cluster`

Objective: Five crystals on a rock, each with a light facet and a dark facet.

The faceting drill the chest's gems reuse: each crystal is split down its middle into a light and a dark
partner of one color, with no hatching. Purple's lighter partner is blue, so the crystals are blue and purple,
on a gray rock.

```text
SUBJECT: exactly five crystals standing on one rock and fanning out from it, each split down its
length into a light facet and a dark facet.
LIGHT: from the upper left. On every crystal the left facet is in the light and the right facet in
shadow, shown only by the two flat colors named below: no hatching, no other shadow.
- Rock: one low, wide closed shape at the bottom, about 60% of the image wide: a flat bottom edge,
  and a top made of a few long, gentle slopes that rise to a rounded middle, with no bumps. Color:
  gray #c9ced6.
- Crystals: each crystal is the same kind of shape, like a short, fat pencil: two long straight
  parallel sides, and at its top two short straight slanted edges that meet in one point. They are
  wide, not thin: each about 9% of the image wide. Each crystal's lower end stops on the rock's top
  edge (one shared line): it stands on the rock.
- The fan: the middle crystal stands upright and is the tallest. One crystal on each side of it
  leans out a little and is shorter; one more on each side leans out further and is the shortest.
  Each stands roughly at right angles to the rock's top where it meets it. Left and right mirror
  each other. Neighboring crystals never touch or overlap: a clear gap of white at least three
  line-widths wide lies between them all the way, widening toward their points.
- Facets: on every crystal, exactly one straight line from its point straight down the middle of
  the crystal to where it meets the rock, touching the point and the rock's edge: it divides the
  crystal in two. Left of the line is the light facet, color blue #5b8fc7; right of it the dark
  facet, color purple #7b4fa3.
Nothing else: no small extra crystals, no second facet line, no hatching, no shine marks, no
cracks, spots or texture on the rock, no moss, no ground line, no cast shadow, no sparkles.
Count the crystals: five. Count the facet lines: five.
```

### 10 · `treasure-chest`

Objective: Open chest in ¾ view: banded domed lid, heaped coins and gems, the crown and the sword.

The finale, built from the path: the crown of lesson 2 and the sword of lesson 4 (attach both kept pictures)
on a heap of gold with coins and the faceted gems of lesson 9, in an open chest drawn in the spellbook's
three-quarter view. An open domed lid shows its inside, and its outer bands face away, so the lid has one
metal band along its arch and the box three upright bands. The crown and the sword are smaller and lose their
jewels, so the lesson stays within about twenty steps.

```text
The attached pictures are the crown and the sword from earlier in the course: draw them here as
they look there, smaller, with the changes given below.
SUBJECT: one open treasure chest heaped with gold: a box with exactly three metal bands and a lock
plate, an open domed lid with a metal band along its arch, and on the heap exactly six coins,
exactly three gems, the crown standing on the heap and the sword stuck into it.
VIEW: not a flat front view. The chest is seen from the front, a little from the right and a little
from above, so its long front face and its short right side face both show, and you look down onto
the heap in the open box. Edges that are parallel on the chest are drawn parallel: no vanishing
points, no dots, no horizon. Hidden edges are not drawn.
LIGHT: from the upper left, shown only by the flat colors named for the box's faces and the gems'
facets: no shadow, no hatching.
Here some parts do overlap, and only these: the box's front and right top edges pass in front of
the bottom of the heap; the heap passes in front of the bottom of the lid and of the sword's point
and lower blade; the crown and the sword stand in front of the lid.
- Box: a plain box with straight edges, about twice as long as it is tall. Its long front face,
  color orange #f08a2c, and its short right side face, which slants up and away to the right,
  color brown #8a5a33, meet at one upright edge.
- Bands: exactly three upright metal bands, each about 5% of the image wide: two on the front
  face, each about a quarter of the way in from its ends, and one in the middle of the right side
  face. Each band's two edges are straight lines running from the box's top edge to its bottom
  edge, touching both: they divide the face. Color: gray #c9ced6.
- Lock plate: one small plate in the middle of the front face, near its top, between the two
  bands: a straight top edge, straight sides and a rounded bottom. It floats: a strip of orange at
  least three line-widths wide lies all around it. Color: yellow #f7cf46. In its middle floats a
  keyhole: one closed shape, a small circle with a short triangle below it, with a strip of yellow
  all around it. Color: purple #7b4fa3.
- Lid: open, standing up behind the box and leaning back a little, hinged along the box's back top
  edge. You see its inside: one flat shape as wide as the box, with two straight upright sides and
  a top edge that is one high, round arch: the dome. Its bottom is hidden behind the heap. Color of
  the lining: red #d8433b. Along the arch runs one metal band, the lid's rim: a curved band at
  least three line-widths wide from the top of the left side to the top of the right side, its
  inner edge one line parallel to the arch. Color: gray #c9ced6. The lid's thickness and its ends
  are not drawn.
- Heap: one closed shape with a smooth, rounded top, like a low hill, rising out of the box and
  filling its whole opening, so nothing of the inside of the box shows. Its top stays well below
  the lid's arch. Color: yellow #f7cf46.
- Coins: exactly six circles on the heap, all the same size, each about 5% of the image wide,
  spread over the heap. Each floats: a strip of yellow at least three line-widths wide lies all
  around it, and it touches nothing. Nothing is drawn on them. Color: orange #f08a2c.
- Gems: exactly three gems on the heap among the coins, each one diamond shape, a square standing
  on one corner, about 6% of the image wide, floating like the coins. Exactly one straight upright
  line from its top corner to its bottom corner divides each gem into a light left facet and a dark
  right facet. One red gem: left watermelon pink #ee5a6a, right red #d8433b. One green gem: left
  pale green #b9dc8a, right leaf green #4f9d4a. One blue gem: left blue #5b8fc7, right purple
  #7b4fa3.
- Crown: the crown from the attached picture, about 28% of the image wide, standing upright on the
  left part of the heap, in front of the lid: the bottom edge of its band lies on the heap. It keeps
  its band, its five points with a ball on each tip and its velvet cap showing in the four dips, in
  the same colors. At this size its band has no jewels.
- Sword: the sword from the attached picture, about 45% of the image long, stuck point down into
  the right part of the heap and leaning a little to the right. A good length of blade shows above
  the heap, with its fuller line; the crossguard with its two curled arms, the grip and the pommel
  stand in front of the lid, below its rim. At this size the grip has two lines across it, making
  three bands (brown, orange, brown), and the sword has no jewels.
The chest with its lid fills about 70% of the image across.
Nothing else: no coins or gems outside the chest, no coins falling, no other treasure (no cups,
necklaces, pearls, maps or scrolls), no handles on the box, no planks or wood grain, no rivets, no
light rays or sparkles, no ground line or shadow.
Count the coins: six. Count the gems: three. Count the bands on the box: three.
```

## What to send back

The PNGs you keep, one per lesson, named `<lesson-id>-<model>.png` and attached as files. Flat color and an
even dark line are what make them traceable; if a model keeps adding glow, shine lines or gradients despite
the prompts, regenerate rather than keep the prettiest one.
