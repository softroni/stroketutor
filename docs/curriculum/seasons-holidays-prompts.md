# Seasons & Holidays — image-generation prompts

Source art for the ten `seasons-holidays` lessons (Starter level) in `plan.json`, written for a raster
image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. `fireworks` and `party-table` are small scenes and
  use the scene reference line instead.
- Square, 1024 × 1024 or larger, PNG, opaque white background. Make `fireworks` and `party-table` as
  large as the tool allows: their dots, strings and flags need the pixels.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/seasons-holidays/<lesson-id>-<model>.png`, and record model,
  date and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Every lesson is a flat view, seen straight on.** Round things (pumpkin, ornament, lantern) get
  their roundness from a few curved lines, never from shading.
- **Every part has its own dark outline**: the leaf's stem, the ornament's cap, the lantern's caps and
  tassel, every firework dot, every flag. Nothing is told apart by color alone.
- **Parts touch only where one is attached to another**, along a shared edge drawn once (stem on leaf
  and pumpkin, cuff under the mitten, cap on the ornament, caps on the lantern, cake on the table,
  flags on their string) or where a single line lands on an outline (the umbrella's handle, the
  ornament's loop, the tassel's string, the balloons' strings). Everything else keeps a clear white gap.
- **Details are single bold lines**: veins, the pumpkin's rib lines, the umbrella's and the lantern's
  ribs, the zigzag, the fireworks' rays, all strings. Charcoal lines of the outline's weight, never
  tubes or ribbons, and they float: no bundle of lines ever meets in one point, because a meeting
  point traces as a knot. The umbrella's ribs stop short of its top, the lantern's short of its caps,
  the rays short of each burst's center.
- **Stripes are the exception that touches**: the mitten's cuff, the candy cane and the ornament's band
  are divided by lines that reach the outline at both ends on purpose, so that every stripe is its own
  closed area with its own color.
- **Nothing overlaps on this path.** "The biggest in front" in `fireworks` is shown by size and place
  (biggest, lowest, in the middle), not by one burst covering another: crossing rays cannot be traced
  or copied. The party table is a scene of things standing apart.
- **Nothing is white inside a subject**: the candy cane's pale stripes and the cuff's middle stripe are
  cream. The only white inside an outline is paper showing through a loop or under a hook.
- **No highlights, shading, texture or shadow anywhere**: no objective asks for one. No shine on the
  heart, the ornament or the balloons; no glow around the fireworks, the lantern or the candle flame;
  the fireworks are drawn on white paper, not on a night sky.
- **No living things and no faces**: the pumpkin is plain (no carved face), the mitten is empty.

## Style prompt (`style-v2`) — identical for all paths

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

For `fireworks` and `party-table` only (the same apple attached):

```text
Match the attached image exactly in line color, line weight, corner rounding and flatness of
color. This image is a small scene, not one subject, so the margins are smaller and the parts are
smaller, but every line stays exactly as bold as in the attached image.
```

## Lesson prompts

### 1 · `heart`

Objective: Two round bumps meeting in a point at the bottom.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the heart standing upright. No perspective, no tilt.
SUBJECT: one heart: exactly two round bumps at the top, meeting in exactly one point at the bottom.
- Heart: one single closed outline, the same on the left and on the right. At the top are two
  round bumps of the same size, side by side, like the tops of two circles. Between them, in the
  middle, the outline dips down into one sharp inward corner, about a quarter of the way down the
  heart. From the outer side of each bump the outline runs down and inward in one smooth, gently
  bulging curve, and the two curves meet in exactly one point at the bottom center. The heart is
  about as wide as it is tall. Color: red #d8433b.
The heart fills about 62% of the image width, with clear white margin on all four sides.
Nothing else: no second heart, no arrow, no ribbon, no inner line, no shine spot, no highlight, no
sparkles, no shadow. One line in total. Count: two bumps, one dip, one point.
```

### 2 · `autumn-leaf`

Objective: Five-pointed leaf with a stem and three veins.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the leaf lying flat and upright: points up, stem down.
SUBJECT: one autumn leaf, a maple-style leaf made very simple: exactly five points, exactly one
stem and exactly three veins.
- Leaf: one single closed outline, the same on the left and on the right, with exactly five
  plain points and no small teeth: one large point straight up in the middle, one point up and
  to the left, one point up and to the right, and two smaller points lower down, one pointing
  out to the left and one out to the right. Between neighboring points the outline curves
  inward in one smooth rounded notch: four notches in all. Every side of every point is one
  smooth, plain line. Below the two low points the outline curves in and down to the bottom
  center, where the stem begins. About as wide as it is tall. Color: yellow #f7cf46.
- Stem: exactly one short stem hanging from the bottom center of the leaf, curving slightly to
  the right, drawn as a narrow closed shape about three line-widths thick and about a fifth as
  long as the leaf is tall, with a blunt rounded end. Its top end is attached to the leaf and
  shares a short stretch of the leaf's outline: one line drawn once. Color: brown #8a5a33.
- Veins: exactly three single bold straight lines inside the leaf, the same charcoal line as the
  outline, with no color. The middle vein runs straight up from a little above the stem toward
  the top point. The left vein leans toward the upper left point and the right vein toward the
  upper right point, fanned like the three toes of a bird's footprint whose toes do not quite
  join. They float: each stops well short of its point, and they touch neither the outline nor
  one another. At their lower ends a clear gap of yellow, at least three line-widths wide, lies
  between neighboring veins. No veins run to the two low points.
The leaf with its stem fills about 70% of the image height.
Nothing else: no small teeth or frills on the edge, no side veins, no second color, no spots, no
holes, no curl, no other leaves, no branch, no shadow. Five lines in total. Count: five points,
four notches, one stem, three veins.
```

### 3 · `pumpkin`

Objective: Four rounded ribs side by side with a short curved stem.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective.
NO GROUND: the pumpkin sits on plain white paper. No ground line, no shadow.
SUBJECT: one plain pumpkin: a body with exactly four rounded ribs side by side, and exactly one
short curved stem. It is a plain pumpkin, not a lantern: nothing is carved into it.
- Body: one single closed outline, wider than tall (about four wide to three tall), the same on
  the left and on the right, with round sides. Along the top the outline makes exactly four low,
  gentle bumps side by side, one for each rib, with three shallow dips between them; along the
  bottom it does the same, more gently still. The middle dip at the top is where the stem sits.
  Color: orange #f08a2c.
- Rib lines: exactly three single bold curved lines inside the body, the same charcoal line as
  the outline, with no color. They divide the body into four ribs of about the same width. The
  middle one runs straight down under the stem. The left one bows out to the left and the right
  one bows out to the right, like a pair of parentheses ( ) around the middle line. Each runs
  from just below a top dip to just above the matching bottom dip. They float: they touch
  neither the outline, nor the stem, nor one another.
- Stem: exactly one short, stubby stem rising from the middle dip at the top and curving to the
  right, drawn as a closed shape about as wide as one twelfth of the body, with a flat cut top
  end. Its bottom end is attached to the body and shares a short stretch of the body's outline:
  one line drawn once. Color: leaf green #4f9d4a.
The pumpkin with its stem fills about 66% of the image width.
Nothing else: no face, no eyes, no mouth, no carving, no leaf, no vine, no tendril, no spots, no
shine, no shading between the ribs, no ground, no shadow. Five lines in total. Count: four ribs,
three rib lines, one stem.
```

### 4 · `umbrella`

Objective: Scalloped canopy with six ribs and a hooked handle.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view of an open umbrella, seen straight on, standing perfectly upright. No
perspective: nothing of the underside or the inside of the canopy shows.
SUBJECT: one open umbrella: a scalloped canopy with exactly six ribs, and exactly one hooked
handle.
- Canopy: one single closed shape, the same on the left and on the right, about 72% of the image
  width and about half as tall as it is wide. Its top edge is one smooth round arch, like the
  top half of a circle pressed a little flat. Its bottom edge is scalloped: exactly seven
  shallow arches of the same width, side by side, each curving upward like a small bridge.
  Neighboring arches meet in a point that points down: six points along the bottom edge, plus
  the canopy's two outer corners. Color: blue #5b8fc7.
- Ribs: exactly six single bold curved lines inside the canopy, three on the left and three on
  the right, as in a mirror, the same charcoal line as the outline, with no color. Each rib
  aims from the top middle of the canopy down to one of the six points of the bottom edge,
  bowing outward a little as the canopy does. They float: each rib starts well below the top of
  the canopy, where neighboring ribs are already at least three line-widths apart, and ends a
  little above its point. They touch neither the outline nor one another, and they never meet
  at the top. There is no rib in the middle.
- Handle: exactly one single bold line, the same charcoal line as the outline, with no color:
  not a tube, not a closed shape. It starts on the canopy's bottom edge, at the top of the
  middle arch, runs straight down, and at its lower end hooks round to the left and back up in
  a small half circle, like the letter J, ending in a round line end. It is a little longer
  than the canopy is tall. It touches the canopy only at its top end.
The umbrella, canopy and handle together, fills about 78% of the image height.
Nothing else: no tip or knob on top of the canopy, no panels in two colors, no pattern, no
raindrops, no puddle, no cloud, no hand, no strap, no shadow. Eight lines in total. Count: seven
arches, six points, six ribs, one handle.
```

### 5 · `mitten`

Objective: Rounded hand shape with a thumb and a striped cuff.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on: one empty mitten lying flat, upright, fingers end up,
cuff at the bottom, thumb on the right.
SUBJECT: one mitten: a rounded hand shape with exactly one thumb, and exactly one cuff with
exactly three stripes.
- Hand: one single closed outline. Its left side rises straight up from the cuff and its top is
  one big round arch. Its right side comes down to about the middle of the hand, where exactly
  one thumb sticks out: a short rounded thumb, like a small sausage, pointing up and to the
  right, about a third as long as the hand is tall. Between the thumb and the hand is one
  rounded notch, with a clear gap of white, at least three line-widths wide, between the
  thumb's tip and the hand. Below the thumb the outline runs down and a little inward to the
  cuff. The hand and the thumb are one shape, with no line between them. Color: blue #5b8fc7.
- Cuff: exactly one level rectangle with gently rounded corners under the hand, a little wider
  than the bottom of the hand and about 18% of the image height tall. Its top edge is the hand's
  bottom edge: one shared line, drawn once.
- Stripes: exactly two single bold straight level lines across the cuff, dividing it into
  exactly three level stripes of the same height. Each line touches the cuff's outline at both
  of its ends, on purpose. Colors: top stripe red #d8433b, middle stripe cream #f6e7b8, bottom
  stripe red #d8433b.
The mitten with its cuff fills about 72% of the image height.
Nothing else: no pattern, snowflake or heart on the hand, no knit texture, no ribbing lines, no
fur or fluff on the cuff, no string, no second mitten, no hand inside, no shadow. Four lines in
total. Count: one thumb, one cuff, two stripe lines, three stripes.
```

### 6 · `candy-cane`

Objective: Hooked stick with six slanted red stripes.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the cane standing perfectly upright with its hook at
the top. No perspective, no tilt.
SUBJECT: one candy cane, drawn chunky so its stripes have room: one hooked stick with exactly six
slanted red stripes.
- Cane: one single closed shape, the same thickness all along, about 12% of the image width
  thick, thick on purpose, with two rounded ends. A straight upright stick whose top bends over
  to the right in one smooth half circle, like the handle of a walking stick. The end of the
  hook points straight down and stops about a quarter of the way down the stick. Under the hook,
  between its end and the stick, is plain white paper, at least as wide as the cane is thick.
- Stripes: exactly six red stripes across the cane: four on the straight stick, evenly spaced
  from near the bottom to just under the bend, and two on the hook, evenly spaced around the
  bend. Each stripe is bounded by exactly two single bold lines, parallel to each other, that
  cross the cane at a slant of about 45 degrees, all slanting the same way along the cane.
  Each line touches the cane's outline at both of its ends, on purpose, so each stripe is its
  own closed area. Each stripe is about half as wide as the cane is thick, and the pale part
  between two stripes is a little wider than a stripe. No stripe touches another stripe or
  either end of the cane. Colors: the six stripes red #d8433b; the seven parts between and
  beyond them, both rounded ends included, cream #f6e7b8. Nothing is left white inside the cane.
The candy cane fills about 76% of the image height.
Nothing else: no thin stripes between the wide ones, no second stripe color, no bow, no ribbon,
no wrapper, no shine, no highlight line, no sparkles, no shadow. Thirteen lines in total. Count
the red stripes: six.
```

### 7 · `ornament`

Objective: Ball with a small cap and loop and a zigzag band around its middle.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective.
SUBJECT: one round tree ornament: a ball, exactly one small cap, exactly one loop, and exactly
one band around the ball's middle with exactly one zigzag in it.
- Ball: one perfect circle, about 56% of the image width.
- Band: exactly two single bold lines across the ball, one a little above its middle and one a
  little below, parallel, each bowing very slightly downward. Each line touches the ball's
  outline at both of its ends, on purpose. Together they cut the ball into three parts: a top
  part, a band about 30% as tall as the ball, and a bottom part.
  Colors: top part blue #5b8fc7, band yellow #f7cf46, bottom part blue #5b8fc7.
- Zigzag: exactly one single bold zigzag line inside the band, running from left to right, the
  same charcoal line as the outline, with no color. It is made of exactly eight straight
  strokes of the same length, going down, up, down, up, down, up, down, up: four letter V's
  joined side by side. It floats in the yellow: its two ends stop short of the ball's outline,
  and its points stop short of the two band lines, with a clear gap of yellow at least two
  line-widths wide everywhere around it.
- Cap: exactly one small level rectangle with gently rounded corners sitting on the very top of
  the ball, about a fifth as wide as the ball and about half as tall as it is wide. Its bottom
  edge is the ball's outline: one shared line, drawn once. Color: gray #c9ced6.
- Loop: exactly one single bold line, a small round arch standing on the middle of the cap's
  top edge, about half as wide as the cap, both of its ends landing on the cap's outline.
  White paper shows through it. The same charcoal line, with no color.
The ornament with its cap and loop fills about 70% of the image height.
Nothing else: no shine spot, no highlight, no reflection, no stars or dots on the ball, no second
band, no ridges on the cap, no hook, no string, no branch, no pine needles, no sparkles, no
shadow. Six lines in total. Count: one cap, one loop, two band lines, one zigzag of four V's.
```

### 8 · `paper-lantern`

Objective: Round lantern with five curved ribs and a tassel underneath.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the lantern hanging perfectly upright. No perspective:
the caps are flat bars, not ellipses.
SUBJECT: one round paper lantern: a round body with exactly five ribs, one cap on top, one cap
underneath, and exactly one tassel hanging underneath.
- Body: one round shape, a circle pressed a little flat: about 58% of the image width and about
  48% of its height. Color: red #d8433b.
- Caps: exactly two small level rectangles with gently rounded corners, the same size, each
  about a third as wide as the body and about 5% of the image height tall. One sits on the
  middle of the body's top and one hangs under the middle of its bottom. Each shares one edge
  with the body: one line drawn once. Color: yellow #f7cf46.
- Ribs: exactly five single bold lines inside the body, the same charcoal line as the outline,
  with no color, running from top to bottom. The middle rib is straight. The two ribs on its
  left bow out to the left, the outer one more than the inner one, and the two on its right bow
  out to the right in the same way, like the lines on a beach ball seen from the side. They
  divide the body into six bands. They float: each starts just below the top cap and ends just
  above the bottom cap, and they touch neither the outline, nor the caps, nor one another. At
  both ends a clear gap of red, at least three line-widths wide, lies between neighboring ribs.
- String: exactly one short single bold straight line, straight down from the middle of the
  bottom cap to the top of the tassel, about 5% of the image height long. No color.
- Tassel: exactly one closed shape under the string: narrow and rounded at the top, its sides
  spreading a little on the way down, with a straight level bottom edge, like a small bell
  with no clapper. About 13% of the image width and 15% of its height. Inside it, exactly two
  single bold straight upright lines that float: they touch neither the outline nor each
  other, with a clear gap of yellow at least two line-widths wide around each.
  Color: yellow #f7cf46.
The lantern, from its top cap to the bottom of its tassel, fills about 80% of the image height.
Nothing else: no glow, no light rays, no candle, no writing or symbols on the body, no pattern,
no hanging cord or hook above the top cap, no bead or knot on the string, no fringe of many
threads, no second lantern, no shadow. Twelve lines in total. Count: five ribs, two caps, one
string, one tassel with two lines.
```

### 9 · `fireworks`

Objective: Three bursts of straight rays and dots, the biggest in front.

```text
LINE WEIGHT: every line is as bold as the outline of the attached image: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, however small the part: the rays of the small bursts are exactly as bold as the rays
of the big one. The image is square.
VIEW: flat, seen straight on, drawn on plain white paper. The paper stays white: no night sky, no
dark background, no color behind the bursts.
NOTHING OVERLAPS: the three bursts stand apart, with a clear gap of white, at least 4% of the
image width wide, between any two of them. No ray crosses or touches another ray, a dot or
another burst. "In front" is shown only by size and place: the biggest burst is the lowest and
sits in the middle.
SUBJECT: exactly three firework bursts: one big burst and two small ones. Each burst is a ring of
straight rays around an empty center, with one dot beyond the tip of every ray.
- Big burst: in the middle of the image, a little below its center, about 52% of the image
  width across, dots included. Exactly eight rays, evenly spaced like the eight points of a
  compass: up, down, left, right and the four diagonals. Exactly eight dots. Dot color:
  red #d8433b.
- Left small burst: in the upper left, about 32% of the image width across, dots included.
  Exactly six rays, evenly spaced: one straight up, one straight down and four diagonal.
  Exactly six dots. Dot color: yellow #f7cf46.
- Right small burst: in the upper right, a little lower than the left one, the same size and
  made the same way: exactly six rays and exactly six dots. Dot color: blue #5b8fc7.
- Rays: every ray is one single bold straight line, the same charcoal line as everything else,
  with no color, all rays of one burst the same length. The rays do not meet: each starts a
  little way out from the burst's center, far enough that neighboring rays are at least three
  line-widths apart, so the center of every burst is an empty white spot. Each ray points
  straight away from that center.
- Dots: every dot is one small complete circle with its own dark outline, all dots in the
  picture the same size, about 4% of the image width across. One dot lies beyond the tip of
  each ray, in line with it, with a clear gap of white, about three line-widths wide, between
  the ray's tip and the dot. Dots touch nothing.
The three bursts together fill about 86% of the image, with clear white margin on all four sides.
Nothing else: no dot or star in the center of a burst, no curved or drooping rays, no second ring
of rays, no rocket trails below the bursts, no sparkles, no stars, no moon, no glow, no smoke, no
sky, no skyline, no ground. Forty lines in total. Count: eight rays and eight dots on the big
burst; six rays and six dots on each small burst.
```

### 10 · `party-table`

Objective: Cake, three balloons and a bunting of five flags in one scene.

```text
LINE WEIGHT: every line is as bold as the outline of the attached image: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, however small the part: the strings are exactly as bold as the outlines. The image
is square.
VIEW: a flat front view of a party table, seen straight on. No perspective: the table top is a
flat bar, nothing of its upper surface shows, and only its two front legs show.
NO GROUND: the table legs simply end on plain white paper. No floor line, no shadow, no wall.
NOTHING OVERLAPS: every part stands apart with a clear gap of white, at least three line-widths
wide, except where the description says one part is attached to another.
SUBJECT: a party scene with exactly one table, exactly one cake on it, exactly three balloons and
exactly one bunting of exactly five flags.
- Table: one long level bar with gently rounded corners, about 80% of the image width and 6% of
  its height, low in the image. Color: orange #f08a2c. Under it, exactly two legs, one near
  each end: plain upright rectangles, about 4% of the image width wide and 12% of its height
  tall. Each leg's top edge is the bar's bottom edge: one shared line. Color: brown #8a5a33.
- Cake: exactly one cake standing on the middle of the table: a rectangle with gently rounded
  top corners, about 28% of the image width and 20% of its height. Its bottom edge is the
  table's top edge: one shared line, drawn once. One single bold wavy line runs across the cake
  a little below its top, from its left side to its right side, touching the outline at both
  ends: exactly four rounded scallops hanging down, the edge of the frosting.
  Colors: above the wavy line cream #f6e7b8, below it watermelon pink #ee5a6a.
- Candle: exactly one small upright rectangle standing on the middle of the cake's top edge,
  about 3% of the image width wide and 9% of its height tall; its bottom edge is the cake's
  top edge, one shared line. Color: blue #5b8fc7. Above it, exactly one flame: a small teardrop
  with its point up, floating, with a clear gap of white between it and the candle.
  Color: yellow #f7cf46.
- Balloons: exactly three, all the same size: upright egg shapes, rounder at the top, narrowing
  to a soft point at the bottom, each about 12% of the image width wide and 16% of its height
  tall. One floats to the left of the cake. Two float to the right of the cake, one higher and
  farther right than the other. No balloon touches another balloon, the cake, the candle, the
  flame or the bunting. Colors: left balloon red #d8433b, lower right balloon leaf green
  #4f9d4a, upper right balloon purple #7b4fa3.
- Balloon strings: exactly three single bold lines, the same charcoal line, with no color, one
  from the bottom point of each balloon straight down, with one very gentle bend, to the
  table's top edge, where it ends exactly on the outline, as if tied there. No string crosses
  or touches another string, a balloon, or the cake.
- Bunting: exactly one single bold line, the string, hanging across the top of the image from
  the upper left to the upper right in one gentle sag, its two ends simply ending in the air
  with round line ends. Exactly five flags hang from it, evenly spaced: each a triangle of the
  same size pointing straight down, about 10% of the image width wide, whose top side is the
  string itself: a shared line, drawn once. Between neighboring flags a stretch of bare
  string, at least four line-widths long. The lowest flag point stays clear above the flame
  and the balloons. Flag colors from left to right: red #d8433b, yellow #f7cf46, blue #5b8fc7,
  yellow #f7cf46, red #d8433b.
The scene fills about 86% of the image, with clear white margin on all four sides.
Nothing else: no knots or ties under the balloons, no shine on the balloons, no glow around the
flame, no plate or cake stand, no tablecloth, no sprinkles, no cherries, no second tier, no
lettering, no presents, no party hats, no cups, no confetti, no chairs, no people, no floor, no
wall, no shadow. About twenty-two lines in total. Count: one cake with four scallops, one
candle, one flame, three balloons, three strings, five flags.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding shine on the heart, the ornament or the
balloons, a face on the pumpkin, a night sky behind the fireworks, thin strings, ribs that meet in a
point, or shadows despite the prompts, regenerate rather than keep it.
