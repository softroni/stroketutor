# Sky & Weather — image-generation prompts

Source art for the ten `sky-weather` lessons (Starter level) in `plan.json`, written for a raster
image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. Generate `mountain-storm` last and also attach the
  kept `cloud`, `lightning-bolt`, `rain-cloud` and `mountains` pictures.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/sky-weather/<lesson-id>-<model>.png`, and record model, date
  and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what Fruits, Food & Treats, Forms and Plants taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Every part has its own dark outline.** A drop, a loop, a lava stream, a smoke puff and a snow
  cap are each a closed shape with the dark line around it; nothing is told apart by color alone.
- **Details are single lines as bold as the outlines**: the sun's rays, the snowflake, the wave's two
  flow lines. Never thinner, never a colored bar or ribbon. The rays and flow lines float; the
  snowflake's lines touch only each other.
- **Parts stand apart** with a clear white gap: rays off the disc, drops under the cloud, the tornado's
  loops, the smoke puffs. Parts touch only where one is attached to another (foam on the crest, lava
  on the crater's rim, a cap's zigzag on its peak). Overlap is asked for only in `mountains` and for
  the two peaks of `mountain-storm`, and each time it is plain triangles.
- **Nothing is white inside a subject** (the style prompt forbids it, and white cannot be told from the
  paper when tracing), so the things that are white in life take the palette's palest colors: the
  cloud is gray, snow caps and foam are cream. The storm's cloud is purple. The `snowflake` is lines
  only and has no color at all.
- **No sky, ground or horizon** in any picture; cones and peaks simply end in a straight bottom edge.
- **No highlights, shading, texture or shadow** anywhere on this path: no objective asks for one.

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

### 1 · `sun`

Objective: Circle with eight straight rays.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one sun: a circle with exactly eight straight rays around it.
- Disc: one complete, plain circle in the center of the image, about 30% of the image width
  across. Color: yellow #f7cf46.
- Rays: exactly eight straight lines pointing away from the center of the circle, evenly spaced
  like the eight points of a compass: up, down, left, right and the four diagonals. All eight are
  the same length, about half as long as the circle is wide. Each ray is one single bold line with
  round ends, the same charcoal line as the circle's outline, with no color: a line, not a
  triangle, not a closed shape, not a colored bar. Each ray starts a clear gap of white away from
  the circle (about three line-widths) and touches nothing.
The whole sun, rays included, fills about 65% of the image.
Nothing else: no face, no second ring inside the circle, no short rays in between, no wavy rays,
no glow, no clouds, no sky color. Nine lines in total. Count the rays: eight.
```

### 2 · `cloud`

Objective: Flat base with four bumps on top.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one cloud with a flat base and exactly four bumps on top.
- The cloud is one single closed outline, about twice as wide as it is tall, filling about 70% of
  the image width.
- Base: one straight, level line along the bottom. At each end a rounded corner turns up into the
  first and the last bump.
- Top: exactly four rounded bumps in a row from left to right, each a smooth arc like the top of a
  circle: a small one, then the tallest one, then a medium one, then a small one. Where two bumps
  meet they make one clear inward dip, a small sharp notch between two arcs. There are three dips.
- Color: gray #c9ced6, one flat area.
Nothing else: no lines inside the cloud, no swirls, no second cloud, no sun, no rain, no sky
color, no shadow on the base. Count the bumps: four.
```

### 3 · `lightning-bolt`

Objective: Zigzag bolt in one closed shape.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one lightning bolt, the classic zigzag symbol, as one single closed shape.
- The bolt is tall and narrow and made of straight sides only: exactly seven straight sides and
  seven corners. It fills about 70% of the image height.
- Going around it: a short, nearly level top edge; from its right end a long side slants down
  and to the left to the middle of the bolt; there a short, nearly level step runs out to the
  right; from the end of the step a long side slants down and to the left to one sharp point at
  the very bottom; from the point a long side runs back up to the middle; there a second short,
  nearly level step runs out to the left; and a last long side slants up to the left end of the top edge.
- So the bolt is two leaning bars joined by one step in the middle: wide at the top, one sharp
  point at the bottom, and the bottom point sits to the left of the top edge.
- Color: yellow #f7cf46, one flat area.
Nothing else: no cloud, no second bolt, no branches or forks, no glow, no sparks, no lines inside
the bolt, no curved sides. One closed outline in total. Count the corners: seven.
```

### 4 · `rain-cloud`

Objective: Cloud with five slanted drops.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one cloud with exactly five slanted raindrops falling below it.
- Cloud: in the upper half of the image, about 65% of the image width wide and about twice as
  wide as it is tall. One single closed outline: one straight, level base line with a rounded
  corner at each end, and exactly four rounded bumps along the top from left to right (small,
  tallest, medium, small), meeting in three clear inward dips. Color: gray #c9ced6.
- Drops: exactly five raindrops below the cloud. Each is one small closed teardrop: a point at
  the top and a round bottom, about 7% of the image width wide and about twice as long as it is
  wide. All five are the same size and all slant the same way, like rain blown by wind: the point
  leans to the upper right and the round end hangs to the lower left, so the five drops are
  parallel. They sit in two rows: three in the upper row, two in the lower row under the gaps of
  the upper row. Color: blue #5b8fc7.
- Every drop stands alone: a clear white gap between the cloud's base and the upper row (at least
  4% of the image height), and clear white gaps between all drops. No drop touches the cloud or
  another drop.
Nothing else: no lines inside the cloud, no dashes or streaks of rain, no puddle, no splashes, no
lightning, no shine spots on the drops. Six closed shapes in total. Count the drops: five.
```

### 5 · `snowflake`

Objective: Three crossed lines with V tips.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one snowflake made only of straight lines: exactly three long crossed lines, each arm
ending in a V.
- COLOR: none. This drawing is lines only, in the same charcoal as every outline of the course,
  on the plain white background. There are no closed shapes and no colored areas at all.
- Long lines: exactly three straight lines of the same length, about 65% of the image width long,
  all crossing at their middles in one single point at the center of the image. One is upright;
  the other two lean 60 degrees to either side, so the six arms are evenly spaced like a star
  with six points. The crossing is just the three lines crossing: no dot, no circle, no hexagon.
- V tips: exactly six, one on each arm. Each V is two short straight lines that start together
  from one point on the arm, about three quarters of the way from the center to the arm's end,
  and point outward and away from the center, one on each side of the arm, like the two top
  branches of a letter Y or of a fir twig. Each short line is about 8% of the image width long
  and makes about half a right angle with the arm. The arm carries on a little past the V to its
  round end.
- The short lines of one arm stay well clear of the short lines of the next arm.
Nothing else: no second row of branches, no dots, no diamonds, no curved lines, no sparkles, no
blue fill, no circle around it. Fifteen lines in total: three long, twelve short.
```

### 6 · `wave`

Objective: Curling crest with foam and a trailing swell.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one ocean wave seen from the side, its crest curling over toward the right, with foam
on the crest and a low swell trailing behind it on the left.
- Water: one single closed shape, about 70% of the image width wide. Its bottom is one straight,
  level line. At the left end a rounded corner turns up into the trailing swell: one low, smooth
  hump, about a quarter as high as the wave. After the hump the outline dips once, gently, then
  climbs in one long smooth curve up the back of the wave to the crest at the upper right, the
  highest point. There it curls over forward and downward like a hook and ends in one rounded tip
  pointing down. From the tip the outline runs back under the crest in one smooth hollow curve,
  like the inside of a letter C, down to the right end of the bottom line. The hollow under the
  curl is open white background, and the tip hangs free in it, touching nothing.
  Color: blue #5b8fc7.
- Foam: one closed shape lying along the top of the crest like a cap, from the top of the back
  round to the tip of the curl. Its lower edge is the wave's own outline; its upper, outer edge is
  exactly five round bumps in a row, all about the same size, meeting in clear dips.
  Color: cream #f6e7b8.
- Flow lines: exactly two curved lines inside the water, one above the other, following the long
  curve of the back. Each is one single bold line of the same weight as the outline, floating: it
  starts and ends well inside the water and touches nothing.
Nothing else: no spray drops, no second wave, no sea line or horizon, no boat, no sun, no
spirals, no claw-like fingers on the foam, no lighter or darker blue. Count the foam bumps: five.
```

### 7 · `mountains`

Objective: Three overlapping peaks with snow caps.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: a row of exactly three mountain peaks with snow caps, the middle peak standing in
front of the other two. The peaks do overlap: that is what this lesson teaches.
- Front peak: one tall triangle in the center, complete: two straight sloping sides meeting in a
  gently rounded point at the top, and a straight, level bottom edge. Color: purple #7b4fa3.
- Left peak: a triangle about three quarters as tall as the front peak, standing behind it on the
  left. Its point and its outer side are fully visible, well out to the side of the front peak;
  its inner side runs down until it meets the front peak's sloping side and stops there. The
  hidden part is not drawn. Color: blue #5b8fc7.
- Right peak: the same on the right, about two thirds as tall as the front peak.
  Color: gray #c9ced6.
- The three bottom edges lie on one level, so together they read as one straight line across the
  bottom of the range. The whole range fills about 70% of the image width.
- Snow caps: exactly three, one on each peak. A cap is the tip of the triangle, cut off by one
  zigzag line that runs from one sloping side across to the other, shaped like a wide letter W:
  two points down, one point up in the middle. The zigzag touches the two sloping sides at its
  ends. On the left and right peaks the whole cap is in the visible part of the peak and does not
  touch the front peak. Color of all three caps: cream #f6e7b8.
Nothing else: no ground, no grass, no trees, no sun, no clouds, no rock or crack lines, no
shading on one side of a peak. Count the peaks: three. Count the caps: three.
```

### 8 · `tornado`

Objective: Funnel of stacked, shrinking loops.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one tornado drawn as a funnel of exactly five stacked loops that shrink from top to bottom.
- Loops: exactly five flat ovals (wide ellipses lying level), stacked one under the other. Each
  is one complete closed shape with its whole outline visible. The top loop is the widest, about
  60% of the image width; each loop below is clearly narrower and a little flatter than the one
  above; the bottom loop is the smallest, about 15% of the image width. Together they make the
  funnel of a tornado, and the whole stack fills about 70% of the image height.
- Lean: each loop sits a little further to the right than the one above it, so the funnel leans
  gently, as if it were moving.
- The loops do not touch and do not overlap: between every two there is a clear gap of white, at
  least three line-widths high.
- Color: the first, third and fifth loops from the top are gray #c9ced6; the second and fourth
  are purple #7b4fa3.
Nothing else: no spiral line, no lines inside the loops, no side lines joining the loops, no
cloud on top, no ground, no dust, no flying things, no motion lines. Five closed shapes in total.
Count the loops: five.
```

### 9 · `volcano`

Objective: Cone with a crater, lava streams and a smoke plume.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one erupting volcano: a cone with a crater, exactly two lava streams and a plume of
exactly three smoke puffs. This one image is seen from slightly above, so the crater is a flat ellipse.
- Cone: a wide mountain with its top cut off: two straight sides sloping inward from a straight,
  level bottom edge up to the crater. It is wider than it is tall and about 70% of the image
  width at the bottom. Color: brown #8a5a33.
- Crater: one flat ellipse closing the top of the cone, complete, with its whole outline visible;
  the two sloping sides end at its left and right ends. Color: red #d8433b.
- Lava streams: exactly two, each its own closed shape hanging from the front edge of the crater
  and running down the front of the cone like a drip of thick paint: two nearly parallel sides
  and a round end. The left stream reaches about halfway down the cone; the right one is about
  half as long. They are apart from each other, with brown between them, and neither touches the
  cone's sloping sides or its bottom edge. Color: orange #f08a2c.
- Smoke plume: exactly three round puffs rising above the crater. Each is one complete, plain
  circle; they grow larger as they rise, and each sits a little further to the right than the one
  below. A clear gap of white separates the lowest puff from the crater and each puff from the
  next. Color: gray #c9ced6.
Nothing else: no sparks, no flying rocks, no flames, no cracks or rock lines on the cone, no
ground, no trees, no glow, no lines inside the puffs. Count the streams: two. Count the puffs: three.
```

### 10 · `mountain-storm`

Objective: Peaks, cloud, bolt and rain in one scene.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: a storm over the mountains: one cloud at the top, one lightning bolt and exactly four
raindrops under it, and exactly two snow-capped peaks at the bottom. The parts are in the same
shapes as earlier in the course (see the other attached pictures), with no extra detail. The whole
scene fills about 70% of the image, with white margin on all four sides.
- Cloud: across the top of the scene, about 60% of the image width wide. One closed outline: a
  straight, level base with rounded corners, and exactly four rounded bumps on top (small,
  tallest, medium, small) meeting in three clear dips. Color: purple #7b4fa3.
- Bolt: one lightning bolt under the middle of the cloud, in the band between the cloud and the
  peaks. One closed shape of seven straight sides: a short top edge, two leaning bars joined by
  one step in the middle, one sharp point at the bottom. It is about 20% of the image height
  tall. Color: yellow #f7cf46.
- Rain: exactly four slanted raindrops, two to the left of the bolt and two to the right, in the
  same band. Each is a small closed teardrop, point leaning to the upper right, round end to the
  lower left, all four the same size and parallel. Color: blue #5b8fc7.
- Peaks: exactly two mountains along the bottom of the scene. The bigger one stands in front,
  left of center: a complete triangle with two straight sloping sides, a gently rounded point and
  a straight, level bottom edge. Color: gray #c9ced6. The smaller one stands behind it on the
  right, about two thirds as tall; its inner side stops where it meets the front peak's side, and
  its hidden part is not drawn. Color: blue #5b8fc7. Both bottom edges lie on one level.
- Snow caps: exactly two, one on each peak: the tip of the triangle, cut off by one zigzag line
  shaped like a wide letter W that touches both sloping sides. Color: cream #f6e7b8.
- Apart: the bolt and the drops do not touch the cloud, the peaks or each other; there is a clear
  white gap (at least three line-widths) under the cloud's base and above the peaks' points. The
  bolt's point aims at the dip between the two peaks and stops well above it. Only the two peaks
  overlap.
Nothing else: no sky color, no ground, no trees, no second cloud, no rain streaks or dashes, no
glow around the bolt, no lines inside the cloud. Count: one cloud, one bolt, four drops, two
peaks, two caps.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding shine spots, gradients, faces on the sun or
sky backgrounds despite the style prompt, regenerate rather than keep it.

## Second versions (2026-09-20)

The first `snowflake` came back as outlined blue tubes with a center disc and six diamonds, and the first
`tornado` as open bands whose color ran past their lines, with gray motion marks. The creator then chose to keep both first pictures (2026-09-20), so these
prompts were not run; they stay here in case either picture is ever made again.

### 5 · `snowflake` (v2) — also attach the kept `sky-weather/sun-openai.png`

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
THIS IMAGE HAS NO COLOR. For this one image, ignore the COLOUR section above: there is nothing to
color in. The whole drawing is fifteen plain pen strokes in very dark charcoal on the white
background, exactly like the eight rays of the attached sun picture: each stroke is one solid dark
line with round ends, with nothing inside it and nothing around it. Do not draw the snowflake as an
outlined shape, a tube, a bar or a ribbon, and do not fill anything with blue or any other color.
SUBJECT: one snowflake made only of straight pen strokes: exactly three long crossed lines, each
arm ending in a V.
- Long lines: exactly three straight strokes of the same length, about 65% of the image width
  long, all crossing at their middles in one single point at the center of the image. One is
  upright; the other two lean 60 degrees to either side, so the six arms are evenly spaced like a
  star with six points. The crossing is just the three strokes crossing: no dot, no disc, no
  circle, no hexagon.
- V tips: exactly six, one on each arm. Each V is two short straight strokes that start together
  from one point on the arm, about three quarters of the way from the center to the arm's end,
  and point outward and away from the center, one on each side of the arm, like the two top
  branches of a letter Y. Each short stroke is about 8% of the image width long and makes about
  half a right angle with the arm. The arm carries on a little past the V to its round end.
- The short strokes of one arm stay well clear of the short strokes of the next arm.
Nothing else: no diamonds or dots between the arms, no second row of branches, no curved lines,
no sparkles, no color anywhere. Fifteen strokes in total: three long, twelve short.
```

### 8 · `tornado` (v2)

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
SUBJECT: one tornado built from exactly five separate closed shapes, stacked from top to bottom
and shrinking, like a stack of plates seen from the side with a small tail under it.
- Top four shapes: four flat ovals (wide ellipses lying level), one under the other. Each is one
  complete closed outline, a whole ellipse with nothing hidden and nothing open. The top oval is
  the widest, about 60% of the image width; each oval below is clearly narrower than the one
  above; the fourth is about 20% of the image width.
- Fifth shape, the tail: one small closed shape under the fourth oval, like a comma or a curled
  horn: wide and rounded at the top, curving down and to the left to one soft point.
- Lean: each shape sits a little further to the right than the one above it, so the funnel leans.
- Apart: no shape touches or overlaps another. Between every two there is a clear gap of plain
  white, at least three line-widths high.
- Every shape is completely surrounded by its own dark outline, and its color stays inside that
  outline everywhere. No open-ended bands, no outline that stops partway round.
- Color: first, third and fifth shapes from the top blue #5b8fc7; second and fourth purple #7b4fa3.
Nothing else: no bowl or funnel drawn around the shapes, no inner ellipse inside the top oval, no
spiral, no lines inside the shapes, no gray motion marks beside the tornado, no cloud, no ground,
no dust, no flying things. Five closed shapes in total. Count them: five.
```
