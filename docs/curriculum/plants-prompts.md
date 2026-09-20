# Plants — image-generation prompts

Source art for the ten new `plants` lessons (Core level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.
`palm-tree-4` (position 6) is already published and has no prompt here.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md).
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. Generate `windowsill-garden` last and also attach
  the kept `cactus`, `tulip` and `bonsai` pictures.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/plants/<lesson-id>-<model>.png`, and record model, date and
  prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what Fruits, Food & Treats and Forms taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairline veins and inner lines were the main
  reason Forms pictures had to be made again.
- **Every part has its own outline and its own color.** A cactus arm, a mushroom spot, a foliage pad
  and a pot rim are each a closed shape with the dark line around it; nothing is told apart by color
  alone, and no part is a solid dark shape (spines are lines, mushroom spots are outlined cream ovals).
- **Details are single floating lines**: leaf veins, spine marks, gill lines, the rose's spiral. They are
  as bold as the outlines, at least as long as 4% of the image width, and touch nothing. There is no
  crosshatching anywhere (the sunflower's center is plain), because thin crossing lines trace as a tangle.
- **Parts stand apart** except where one grows from another. Overlap is asked for only where the
  objective is about it: the pine's stacked triangles, the sunflower's two layers of petals, the
  rose's wrapped petals, the oak's branches in front of its canopy. Each time it is a few plain shapes.
- **No ground, grass, sand or sky** in any picture; a trunk or stem simply ends in a flat bottom edge.
  Only `windowsill-garden` has something to stand on, because its objective names the ledge.

## Style prompt (`style-v2`) — identical for all 13 paths

```text
You are illustrating a drawing course. Every image is the finished drawing that a beginner will
copy onto paper with a pen, one line at a time, and then colour with markers. Every image in the
course must look like it came from the same hand and the same set of pens.

LINE
- One outline colour everywhere: very dark charcoal (#26292e). Never pure black, never coloured lines.
- One line weight everywhere: a bold, even felt-tip line about 1% of the image width. No thick-to-thin
  variation, no tapering, no sketchy or doubled lines, no broken or dashed lines.
- Lines are confident and slightly hand-drawn: smooth curves, gently rounded corners, round line ends.
  Not ruler-perfect, not wobbly.
- Every shape is fully closed. Where two lines meet, they touch exactly: no gaps, no overshoot.
- Use as few lines as possible. If a detail is not named in the subject description, leave it out.
  When a number of details is given (five seeds, eight segments), draw exactly that number.

DRAWABLE
A child of eight will copy this with a pen, one line at a time, so it must be made of lines a child can draw.
- Every outline is one smooth, simple curve or a few straight sides: no small bumps, notches, frills or
  zigzags unless the subject description asks for them.
- Separate things do not touch. Two parts touch only where one is attached to the other (a stem on a
  fruit, a leaf on a stem) or where the description says one overlaps the other. Otherwise leave a
  clear gap of white between them, at least three line-widths wide: a leaf does not rest on the fruit
  below it.
- Detail lines inside a shape (a leaf's vein, ridge lines, crosshatching, seeds) float: each starts and
  ends a little inside the shape's outline and touches nothing, except where the description says otherwise.

COLOUR
- Flat, solid colour inside the outlines, like a marker laid down evenly. No gradients, no shading,
  no highlights, no shine spots, no texture, no grain, no patterns, no transparency.
- Use only the colours named in the subject description, taken from this palette:
  red #d8433b, watermelon pink #ee5a6a, orange #f08a2c, yellow #f7cf46, cream #f6e7b8,
  pale green #b9dc8a, leaf green #4f9d4a, dark green #2f6b3a, purple #7b4fa3, brown #8a5a33,
  blue #5b8fc7, grey #c9ced6.
- One colour per enclosed area. Neighbouring areas never share a colour. Nothing is left white
  inside the subject, and nothing inside the subject is coloured white.

COMPOSITION
- Square image. Pure white (#ffffff) background, completely empty: no ground line, no horizon, no
  shadow under the subject, no frame, no border, no vignette, no paper texture.
- One subject, centred, upright, seen straight on (flat front view, no perspective unless the
  subject description asks for it). The subject fills about 70% of the image, with clear white
  margin on all four sides. Nothing is cropped by the edge.

NEVER
- No faces, eyes, mouths, arms or legs on anything. No people, animals or insects. Objects are
  objects, not characters.
- No text, letters, numbers, labels, logos, watermarks or signatures.
- No 3D rendering, no photorealism, no watercolour, no pencil or crayon texture, no drop shadows,
  no glow, no sparkles, no decorative background shapes.
```

## Reference line (with the published apple attached)

```text
Match the attached image exactly in line color, line weight, corner rounding, flatness of color,
margins and overall feel. Only the subject changes.
```

## Lesson prompts

### 1 · `pine-tree`

Objective: Three stacked triangles on a short trunk.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one pine tree made of exactly three stacked triangles on a short trunk, like a simple
Christmas tree with no decorations.
- Top triangle: one complete triangle, point at the top, with a straight flat base. It is the
  smallest of the three. Color: pale green #b9dc8a.
- Middle triangle: wider than the top one. Its point is hidden behind the top triangle, so only
  its two sloping sides and its straight flat base show. The two sloping sides start on the top
  triangle's base line, a little in from that base's ends. Color: leaf green #4f9d4a.
- Bottom triangle: the widest. Its point is hidden behind the middle triangle in the same way: two
  sloping sides starting on the middle triangle's base line, and a straight flat base.
  Color: dark green #2f6b3a.
- The three base lines are straight and level, and each triangle's two base corners stick out
  clearly beyond the triangle below's sloping sides, like steps. All corners are gently rounded.
- Trunk: one short upright rectangle under the middle of the bottom triangle, about as tall as it
  is wide, hanging from the bottom triangle's base line and closed by a flat bottom edge.
  Color: brown #8a5a33.
Nothing else: no star, no snow, no ornaments, no needles or texture, no branches, no zigzag edges,
no ground. About twelve straight lines in total. Count the triangles: three.
```

### 2 · `tulip`

Objective: Cup-shaped bloom with two pointed leaves.

```text
LINE WEIGHT: every line, including the leaf veins, is as bold as the outline of the attached apple:
about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one tulip: a cup-shaped bloom on a tall stem with exactly two pointed leaves.
- Bloom: one closed cup shape, like an egg with its top cut into points. The bottom is round. The
  top edge has exactly three pointed tips, one in the center and one at each side, with two
  V-shaped dips between them. There are no lines inside the bloom. Color: watermelon pink #ee5a6a.
- Stem: a tall, narrow, nearly straight closed shape from the bottom center of the bloom down to a
  flat bottom edge. It is about three line-widths wide. Color: leaf green #4f9d4a.
- Leaves: exactly two long pointed leaves, one on each side, both growing from the lowest part of
  the stem. Each curves outward and up like a tall, narrow flame and ends in a sharp tip. The left
  leaf reaches about halfway up the stem; the right one is a little shorter. Each leaf touches the
  stem only at its base, and both tips stay well below the bloom, with clear white around them.
  Color: dark green #2f6b3a.
- Veins: exactly one center vein line in each leaf, following its curve. Each vein floats: it
  starts and ends inside the leaf, at least three line-widths from the outline, and touches nothing.
Nothing else: no petal lines, no second flower, no bud, no soil, no pot, no ground.
About eight lines in total. Count the leaves: two.
```

### 3 · `cactus`

Objective: Saguaro with two arms and six spines.

```text
LINE WEIGHT: every line, including the spine marks, is as bold as the outline of the attached
apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one saguaro cactus with exactly two arms and exactly six spine marks.
- Body: one tall upright column with straight sides, a fully rounded top and a flat bottom edge,
  about four times as tall as it is wide. It is a complete closed shape of its own: its two long
  sides run unbroken from top to bottom, also where the arms join it. Color: leaf green #4f9d4a.
- Arms: exactly two, each its own closed shape shaped like the letter L with a round elbow: it
  leaves the side of the body going outward, turns and goes straight up, and ends in a rounded top.
  Each arm is about half as thick as the body. The left arm joins the body lower down and is the
  longer one; the right arm joins higher up and is shorter. Both rounded tops stay below the top of
  the body. The upright part of each arm is separated from the body by a clear white gap at least
  as wide as the arm. Color: pale green #b9dc8a.
- Spines: exactly six short straight marks, each a single line about 5% of the image width long,
  slightly tilted. Four are on the body, one under another, leaning left and right in turn; one is
  on the upright part of each arm. Every mark floats in the middle of its shape, at least three
  line-widths from any outline, and touches nothing. They are lines, not shapes, with no color.
Nothing else: no flower, no ribs or long stripes, no pot, no sand, no rocks, no ground, no sun.
Count the arms: two. Count the spine marks: six.
```

### 4 · `mushroom`

Objective: Cap with three spots and gill lines under the rim.

```text
LINE WEIGHT: every line, including the gill lines and the outlines of the spots, is as bold as the
outline of the attached apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image),
in the same very dark charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one toadstool mushroom: a domed cap with exactly three spots, gill lines under the rim,
and a stout stem.
- Cap: a wide smooth dome, like the top half of a flattened ball, closed along the bottom by a
  nearly straight rim line that bows slightly downward. Color: red #d8433b.
- Spots: exactly three ovals on the cap, one large in the upper middle and one smaller at each side
  lower down. Each spot is a complete closed oval with its own dark outline, floating well inside
  the cap: at least three line-widths from the cap's outline and from the other spots.
  Color: cream #f6e7b8.
- Underside: a shallow bowl shape hanging under the rim, its top edge being the rim line itself.
  It starts a little in from each end of the rim and curves down to the stem, and it is about one
  fifth as tall as the cap. Color: cream #f6e7b8.
- Gill lines: exactly six short straight lines in the underside, three on the left of the stem and
  three on the right, fanning outward like the ribs of an open umbrella. Each is about 4% of the
  image width long, floats inside the underside and touches nothing: not the rim, not the stem,
  not the lower edge, not another gill line.
- Stem: a stout stem coming down from the middle of the underside, a little wider toward the
  bottom, closed by a gently rounded bottom edge. Its top is hidden by the underside.
  Color: gray #c9ced6.
Nothing else: no ring or skirt on the stem, no grass, no ground, no second mushroom, no shine on
the cap. Count the spots: three. Count the gill lines: six.
```

### 5 · `palm-tree`

Objective: Curved trunk with five fanning fronds.

Second version, 2026-09-20: see "First round" below for why.

```text
LINE WEIGHT: every line, including the trunk's ring lines, is as bold as the outline of the attached apple:
about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one palm tree as on a postcard of a tropical beach: a tall curved trunk with exactly five
drooping, feathery fronds. It must read as a palm at a glance, not as a plant with five plain leaves.
- Trunk: one long, narrow closed shape that leans and curves gently to the right as it rises. It is
  widest at the flat bottom edge and narrows slowly to a small rounded top. Color: brown #8a5a33.
- Ring lines: exactly four short, slightly curved lines across the trunk, evenly spaced up its
  length, like the rungs of a ladder. Each floats: it stops at least three line-widths short of
  both sides of the trunk and touches nothing.
- Fronds: exactly five, all growing from the top of the trunk and arching outward and then
  downward, like water from a fountain: two to the left, two to the right, and one over the top
  that leans to the right. On each side the upper frond reaches farther out than the lower one.
- Each frond is one closed shape like half a feather. Its upper edge is one smooth arc from the
  trunk out to a sharp tip. Its lower edge is cut into exactly four big pointed teeth that point
  down and outward, like the teeth of a saw, all about the same size. No lines inside a frond.
- The fronds touch one another only at the top of the trunk, where they grow from. Beyond that they
  spread apart with clear white between them, and no frond crosses or covers another or the trunk.
  Color: leaf green #4f9d4a for the top frond and the two lower ones, dark green #2f6b3a for the
  two upper side ones.
Nothing else: no coconuts, no sand, no island, no grass, no sun, no ground, no single leaflets.
Count the fronds: five. Count the teeth on each frond: four. Count the ring lines: four.
```

### 7 · `sunflower`

Objective: Big center with two layers of pointy petals (now on a stem with two leaves).

Second version, 2026-09-20: see "First round" below for why.

```text
LINE WEIGHT: every line, including the leaf veins, is as bold as the outline of the attached apple:
about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one whole sunflower standing upright: a big flower head facing the viewer on a tall
stem with exactly two leaves. The flower head sits in the upper half of the image and is about
half as wide as the image; the whole plant fills about 80% of the image's height.
- Center: one big plain circle, about 40% as wide as the whole flower head. It is completely
  plain inside: no seeds, no dots, no crosshatching, no spiral, no inner ring. Color: brown #8a5a33.
- Front layer: exactly eight pointed petals, evenly spaced all the way around the center like the
  points of a compass. Each is a complete leaf-like shape, widest near the middle and ending in a
  sharp tip, growing straight out from the center circle. Neighboring front petals sit side by
  side at the center and do not overlap each other. Color: yellow #f7cf46.
- Back layer: exactly eight more pointed petals, one behind each gap between two front petals.
  Only the pointed outer part of each shows: two edges rising from behind the front petals on
  either side and meeting in a sharp tip. Here the front petals do overlap the back ones: that is
  what this lesson teaches. Color: orange #f08a2c.
- No lines inside any petal.
- Stem: one tall, narrow, nearly straight closed shape coming down from behind the bottom petals
  to a flat bottom edge, about four line-widths wide. Color: leaf green #4f9d4a.
- Leaves: exactly two broad leaves shaped like a wide heart with a pointed tip, one on each side
  of the stem, the left one higher up than the right one. Each grows from the stem on a very
  short stalk, points outward and slightly up, and has smooth edges. Each leaf touches only the
  stem, and stays well clear of the petals above it. Color: dark green #2f6b3a.
- Veins: exactly one center vein line in each leaf, from near its base toward its tip. Each vein
  floats: it starts and ends inside the leaf, at least three line-widths from the outline.
Nothing else: no seeds, no bee, no face, no pot, no soil, no grass, no ground, no sun.
Count the yellow front petals: eight. Count the orange back petal tips: eight. Count the leaves: two.
```

### 8 · `big-oak`

Objective: Thick trunk, spreading branches and a bumpy canopy.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one big oak tree: a thick trunk that divides into exactly three spreading branches, drawn
in front of one big bumpy canopy.
- Trunk and branches: one single closed shape. The trunk is thick and short, flaring a little
  wider at the flat bottom edge. At about half the tree's height it divides into exactly three
  thick branches that spread like the fingers of an open hand: one leaning out to the left, one
  going straight up in the middle, one leaning out to the right. Each branch narrows a little and
  ends in a blunt rounded tip. The branches do not divide again and carry no twigs.
  Color: brown #8a5a33.
- Canopy: one big closed cloud shape behind the branches, wider than it is tall. Its outline is
  made of exactly nine large round bumps, all about the same size, like a cumulus cloud. It is
  one flat area with no lines inside it. The three branches are drawn in front of it and their
  whole outlines show; every branch tip stays well inside the canopy, at least five line-widths
  from the canopy's outline. The canopy's lower edge comes down to meet the trunk on both sides,
  a little below where the branches divide. Color: leaf green #4f9d4a.
Nothing else: no acorns, no single leaves, no bark lines, no knothole, no roots, no grass, no
ground, no second shade of green in the canopy. Count the branches: three. Count the canopy's
bumps: nine.
```

### 9 · `rose`

Objective: Spiral center wrapped in curved petals.

Second version, 2026-09-20: see "First round" below for why.

```text
LINE WEIGHT: every line, including the spiral and the leaf veins, is as bold as the outline of the attached apple:
about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one red rose on a stem, the way a rose is drawn in a simple coloring book: seen from the
side, a rounded cup-shaped bloom that anyone would call a rose at a glance, not a round pinwheel
seen from above. Keep it very simple: a spiral center and exactly three big petals.
- Bloom: about as wide as it is tall, rounded at the bottom like a cup, in the upper half of the
  image.
- Center: at the top middle of the bloom, one small rounded shape, the rolled-up heart of the rose,
  peeking out above the petals. Inside it is one single spiral line with exactly one and a half
  turns. The spiral floats: it touches neither itself nor the outline around it. It is a line, not
  a shape. Color of the center: watermelon pink #ee5a6a.
- Petals: exactly three, each one big smooth shape with its own complete dark outline.
  A left petal and a right petal wrap around the center like two cupped hands: each rises from
  the bottom of the bloom, curves up around its side of the center, and ends in a soft point that
  curls slightly outward at the top. A front petal, shaped like a wide rounded heart without the
  notch, lies low across the front and overlaps the lower part of both side petals.
  Here the petals do overlap one another: that is what this lesson teaches. All three petals are
  red #d8433b and are told apart by their dark outlines. No lines, folds or creases inside a petal.
- Stem: one narrow, gently curved closed shape from the bottom of the bloom down to a flat bottom
  edge, about three line-widths wide. Color: dark green #2f6b3a.
- Leaves: exactly two pointed oval leaves with smooth edges, one on each side of the stem, the
  left one higher than the right one, each touching only the stem and pointing outward and up.
  Color: leaf green #4f9d4a.
- Veins: exactly one center vein line in each leaf. Each vein floats: it starts and ends inside
  the leaf, at least three line-widths from the outline, and touches nothing.
Nothing else: no thorns, no sepals, no bud, no dewdrops, no extra petals, no saw-toothed leaf edges,
no ground. Count the petals: three. Count the leaves: two.
```

### 10 · `bonsai`

Objective: Twisted trunk in a shallow pot with layered canopy.

Second version, 2026-09-20: see "First round" below for why.

```text
LINE WEIGHT: every line, including the tuft lines, is as bold as the outline of the attached apple:
about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one bonsai tree in the windswept Japanese pine style: a leaning, twisted trunk growing
from a shallow pot, carrying exactly three flat layers of foliage like the tiers of a pagoda. It
must read as a bonsai at a glance, not as a tree holding three clouds.
- Pot: a wide, shallow pot seen straight from the front, about four times as wide as it is tall.
  It has three kinds of part, each a closed shape: a narrow straight rim band across the top; under
  it the body, a little narrower, with sides sloping slightly inward toward a flat bottom; and
  exactly two small square feet under the body. Colors: rim purple #7b4fa3, body blue #5b8fc7,
  feet purple #7b4fa3.
- Trunk: one closed shape rising from behind the rim band, left of the pot's middle. It is thick
  and flared at the pot, leans strongly to the right as it climbs, and twists like the letter S,
  narrowing all the way. Exactly two short branches leave it, one to the left low down and one to
  the right higher up, each narrowing toward its end. Trunk and branches are one shape with smooth
  sides: no bark lines, no knots. Color: brown #8a5a33.
- Foliage layers: exactly three, each its own closed shape: a long, low, smooth dome like a
  flattened hill or the cap of a wide mushroom, about four times as wide as it is tall, with a
  level, nearly straight bottom edge. The top edge is one smooth curve with no bumps at all: a
  bumpy top would look like a cloud. The largest layer sits on the end of the low left branch; a
  middle-sized one sits on the end of the right branch, higher; the smallest sits on the top of
  the trunk, highest of all, so the layers get smaller toward the top. The end of the trunk or
  branch is hidden behind the bottom edge of its layer. The three layers do not touch each other,
  the pot or any other part of the trunk: clear white, at least three line-widths wide, separates
  them. Color: dark green #2f6b3a for the two side layers, leaf green #4f9d4a for the top one.
- Tuft lines: exactly two short curved lines inside each layer, each like a small arch or an
  upside-down letter U, side by side, about 5% of the image width long. Each floats in the middle
  of its layer, at least three line-widths from the outline and from the other tuft line.
Nothing else: no soil or moss showing, no rocks, no pattern on the pot, no single leaves or
needles, no table, no ground. Count the layers: three. Count the tuft lines: six in all.
```

### 11 · `windowsill-garden`

Objective: Potted cactus, tulip and bonsai on a ledge.

Generate this one last, with the kept `cactus`, `tulip` and `bonsai` pictures attached as well as the
apple, and add this sentence after the reference line: "The other attached images show how the
cactus, the tulip and the bonsai of this course are drawn; draw simpler, smaller versions of them."

```text
LINE WEIGHT: every line, including the spine marks, is as bold as the outline of the attached
apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: three potted plants standing in a row on a ledge, seen straight from the front: a cactus
on the left, a tulip in the middle, a bonsai on the right. The ledge spans about 80% of the image
width, and the whole scene is centered with clear white margin on all four sides.
- Ledge: one long, low rectangle with gently rounded corners lying across the lower part of the
  image, about fifteen times as wide as it is tall. Color: gray #c9ced6.
- The three pots stand on the top edge of the ledge, evenly spaced, with clear white gaps between
  them at least half a pot wide. No plant or pot touches or overlaps another one.
- Every pot has exactly two parts, each a closed shape: a narrow straight rim band across the top
  and, under it, a slightly narrower body with sides sloping inward toward a flat bottom that rests
  on the ledge. The pots have no feet, no saucers and no patterns.
- Cactus, on the left: a pot about as tall as it is wide, body orange #f08a2c, rim brown #8a5a33.
  From behind the rim rises one upright cactus column with a rounded top, leaf green #4f9d4a, and
  exactly two L-shaped arms with round elbows and rounded tops, pale green #b9dc8a, the left arm
  lower than the right one, each separated from the column by a clear white gap. Exactly three
  short, slightly tilted spine marks float inside the column, one under another, leaning left and
  right in turn, each about 4% of the image width long; none on the arms.
- Tulip, in the middle: a pot of the same shape, body yellow #f7cf46, rim orange #f08a2c. From
  behind the rim rises one tall narrow stem, leaf green #4f9d4a, with exactly two long pointed
  leaves growing from its lowest part, one on each side, dark green #2f6b3a, with no vein lines. On
  top sits one cup-shaped bloom with exactly three pointed tips, watermelon pink #ee5a6a. The tulip
  is the tallest of the three plants.
- Bonsai, on the right: a wide, shallow pot, about three times as wide as it is tall, body blue
  #5b8fc7, rim purple #7b4fa3. From behind the rim, left of the pot's middle, rises one twisted
  trunk that leans strongly to the right and bends like the letter S, narrowing as it climbs, with
  exactly one short branch to the left low down, all one shape, brown #8a5a33. Exactly two flat
  layers of foliage, like the tiers of a pagoda: a larger one on the end of the low left branch,
  dark green #2f6b3a, and a smaller one on the top of the trunk, higher up, leaf green #4f9d4a.
  Each layer is a long, low, smooth dome like a flattened hill, about four times as wide as it is
  tall, with a level bottom edge, no bumps and no lines inside. The end of the trunk or branch is
  hidden behind the bottom edge of its layer. The two layers do not touch each other, the pot or
  any other part of the trunk. It must read as a bonsai, not as a mushroom or a tree holding clouds.
Nothing else: no window, no window frame, no curtains, no wall, no sky, no watering can, no soil
showing, no shadows. Count the pots: three. Count the spine marks: three. Count the bonsai's layers: two.
```

## First round, 2026-09-20 (OpenAI)

Kept: `pine-tree`, `tulip`, `cactus`, `mushroom`, `big-oak`, `windowsill-garden`. The creator turned down
four, kept for the record in `plants/round1/`: `palm-tree` (five plain veined leaves did not read as a
palm: now drooping fronds with four saw teeth each and four trunk rings), `sunflower` (head only: now a
whole sunflower on a stem with two leaves), `rose` (a pinwheel of seven petals seen from above was
complicated and did not read as a rose: now a side-view cup of three petals with the spiral on top, on a
stem with two leaves) and `bonsai` (three-bump pads read as clouds: now smooth flat layers, pagoda
order, leaning trunk, two tuft lines each). `windowsill-garden` was kept at first, then its bonsai
paragraph was rewritten the same day to match the new bonsai (leaning trunk, two flat layers, the larger
one low on the left); generate it again, last, with the new kept `bonsai` attached.

## Second round, 2026-09-20 (OpenAI)

Kept: the new `sunflower` (whole plant; its stem runs off toward the bottom with no foot line), `palm-tree`
(drooping saw-tooth leaves; the teeth are three or four to a leaf, not four everywhere) and `rose` (side
view, three petals). The creator decided to keep the FIRST `bonsai` and the FIRST `windowsill-garden`
after all, so the second-version bonsai prompt and the rewritten bonsai paragraph of the garden prompt
above were never used for a kept picture; they stay for the record.

## What to send back

The PNGs you like (any number per lesson), in `docs/curriculum/plants/`, named
`<lesson-id>-<model>.png`. The usual failures to watch for on this path: needles, leaflets or bark
texture added to make a tree look real; zigzag edges on the pine; leaf veins drawn as hairlines or
touching the leaf's tip; spines drawn as tiny stars or sticking out through the outline; mushroom
spots left white or without an outline; seeds or crosshatching in the sunflower's center; a rose
with creases and folds instead of seven plain petals; grass, soil or a ground line under anything;
and a window drawn behind the windowsill garden.
