# Light & Shadow — image-generation prompts

Source art for the ten `light-shadow` lessons (Advanced level) in `plan.json`, written for a raster
image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

This is the Advanced skills path, as Forms is for Core: pick where the light comes from, then give
every form a light side, a shadow side and a cast shadow. The sources are flat-color pictures, so
**light is drawn, not rendered**: a shadow is a flat, outlined, darker shape or a set of pen lines;
a highlight is a small outlined cream shape; a pool or patch of light is an outlined cream shape on
the ground. That is also what a child can do with a pen and markers.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. The view changes in most of these lessons, so the
  reference line says so and every prompt has a VIEW paragraph.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/light-shadow/<lesson-id>-<model>.png`, and record model,
  date and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again, and hatch lines and shadow outlines are where a model thins out first.
- **Every prompt has a FLAT LIGHT paragraph.** The style prompt forbids shading, highlights, shadows
  and glow; these lessons are the exception, and the paragraph says exactly how far: only the named
  shapes, each flat and outlined, on white paper. No gradients, no soft edges, no dark background,
  not even in `candle` and `night-street`.
- **Every shadow, highlight, glow ring and patch of light has its own dark outline.** Forms taught
  us that models leave shadows without one (`still-life`), and then they do not trace.
- **Tone is three flat palette colors of one family**, lightest toward the light: pink / red / brown
  (`lit-box`), pale / leaf / dark green (the box in `desk-lamp`), blue / purple (`shaded-ball`),
  pale green / leaf green (`pillar`), yellow / orange (`pyramid`). Cast shadows are always gray
  #c9ced6; highlights and light on the ground are always cream #f6e7b8.
- **A cast shadow is attached to the thing that casts it**: it shares the bottom edge of a box's dark
  face (drawn once), or the round thing overlaps its left end. Those are the only overlaps in the
  first six lessons.
- **Lines that divide a shape touch its outline on purpose** and the prompt says so each time: the
  ball's shadow edge, the pillar's shadow band, the window's and the light patch's crosses. Every
  other detail floats (highlights, the bright spot, hatch lines).
- **Hatching only in `clay-pot`**, where the objective asks for it: six lines one way and three
  crossing them, the same weight as the outline, on one flat body color. Trace it with
  `svg from-image --min-area 10 --max-colours 12` if the lines break up.
- **Overlap in the last four lessons is kept to simple shapes in front of a circle or an ellipse**:
  the candle in front of its two rings, and things standing in front of the back edge of a pool of
  light. Circles and ellipses that another outline touches will likely need the color-edge trace
  (`svg trace --ink-max-channel 0`) merged into the ink trace.
- **Round things fill about 60%**, scenes a little more than 70% of the width.

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
Match the attached image exactly in line color, line weight, corner rounding, flatness of color
and margins. The subject changes, and so does the view: follow the VIEW paragraph below.
```

## Lesson prompts

### 1 · `lit-box`

Objective: Box with a light, a middle and a dark face and a cast shadow.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: one box (a cube) standing on the ground, lit from one side, with its cast shadow.
VIEW: this image is not a flat front view. The box is seen from slightly above, with one upright
edge turned toward the viewer, so exactly three faces show: the top, the left side and the right
side. Edges that are parallel on the box are drawn parallel: no vanishing points, no narrowing
toward the back. Hidden back edges are not drawn.
LIGHT: it comes from the upper left, a little behind the box. The top face is the lightest, the
left face is the middle tone, the right face is the darkest, and the cast shadow falls on the
ground to the lower right.
- Top face: a diamond lying flat, one corner pointing toward the viewer. Color: watermelon pink
  #ee5a6a.
- Left face: a four-sided shape hanging from the top face's front left edge, with upright sides.
  Color: red #d8433b.
- Right face: the mirror image of the left face, hanging from the top face's front right edge.
  Color: brown #8a5a33.
- The three faces share three edges, and those three edges meet at one point in the middle of the
  box, like the letter Y. Each shared edge is drawn once, as a single line. Nine straight lines.
- Cast shadow: one flat four-sided shape (a parallelogram) lying on the ground to the right of the
  box. Its first side is the bottom edge of the right face, drawn once and shared with the box.
  From each end of that edge, one straight line runs down to the right, parallel to the bottom edge
  of the left face; the two lines are the same length, about two thirds as long as an edge of the
  box. A fourth straight line, parallel to the first side, closes the shape. It has the same bold
  dark outline as the box. Color: gray #c9ced6.
The box and its shadow together are centered and fill about 70% of the image.
Nothing else: no pattern on the faces, no highlight, no hatching, no ground line, no second shadow.
Count the lines: twelve, nine for the box and three more for the shadow.
```

### 2 · `shaded-ball`

Objective: Ball with a crescent shadow shape, a highlight and an oval cast shadow.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: one ball resting on the ground, with a crescent-shaped shadow on the ball, one highlight
and one oval cast shadow.
VIEW: the ball is a perfect circle. The ground is seen from slightly above, so the cast shadow
lying on it is drawn as a very flat ellipse.
LIGHT: it comes from the upper left, so the highlight is on the ball's upper left, the ball's own
shadow is along its lower right, and its cast shadow falls on the ground to the right.
- Ball: one perfect circle.
- Shadow edge: exactly one smooth curved line inside the circle. It starts on the circle at the
  upper right and ends on the circle at the lower left, and its two ends are opposite each other
  across the center of the ball. Between them it bows toward the lower right, so the area between
  this line and the circle's lower right edge is a crescent, like a thin moon, about one fifth of
  the ball's width at its widest. This line touches the circle at both ends on purpose.
- Colors on the ball: the large lit part is blue #5b8fc7; the crescent is purple #7b4fa3.
- Highlight: exactly one small oval in the upper left of the lit part, tilted like /, about one
  eighth of the ball's width long. It floats: it touches neither the circle nor the shadow edge.
  It has its own bold dark outline. Color: cream #f6e7b8.
- Cast shadow: one very flat ellipse lying on the ground, about as wide as the ball. It starts
  under the ball and reaches out to the right. The ball overlaps it and hides its left end; this is
  the only overlap in the image. It has the same bold dark outline as everything else. Color: gray
  #c9ced6.
The ball and its shadow together are centered and fill about 60% of the image.
Nothing else: no second highlight, no shine streak, no hatching, no pattern on the ball, no ground
line. Four things only: circle, shadow edge, highlight, cast shadow.
```

### 3 · `pillar`

Objective: Cylinder with a shadow band down one side and a shadow across the ground.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: one plain round pillar (a tall cylinder) standing on the ground, with a band of shadow
down its right side and its long shadow lying across the ground.
VIEW: this image is not a flat front view. The pillar stands upright and is seen from slightly
above, so its round top is drawn as a flat ellipse, about three times as wide as it is tall. The
pillar is about three times as tall as it is wide. It is opaque: nothing hidden is drawn, and there
are no dashed lines.
LIGHT: it comes from the left, fairly low, so the right side of the pillar is in shadow and the
shadow on the ground runs level to the right.
- Top: one complete flat ellipse. Color: cream #f6e7b8.
- Sides: exactly two straight upright lines of the same length, one down from the far left end of
  the top ellipse and one down from its far right end.
- Bottom: one curve joining the lower ends of the two sides: the front half of an ellipse the same
  size as the top one, bulging downward.
- Shadow band: exactly one straight upright line inside the body, parallel to the sides, about one
  quarter of the pillar's width in from the right side. It starts on the front edge of the top
  ellipse and ends on the bottom curve, and touches both on purpose. It splits the body into a wide
  lit part on the left and a narrow band on the right.
- Colors of the body: the wide lit part is pale green #b9dc8a; the narrow band is leaf green #4f9d4a.
- Ground shadow: one long flat band lying on the ground, reaching level to the right from the foot
  of the pillar, about as long as three quarters of the pillar's height. It is made of two straight,
  level, parallel lines and one rounded end. The upper line starts on the pillar's right side, a
  little above that side's lower end. The lower line starts on the bottom curve, halfway between the
  curve's lowest point and its right end. The band is about one fifth as tall as the pillar is
  wide. At the far right the two lines are joined by one rounded end, curved like the right end of
  the top ellipse. The pillar hides the band's left end; this is the only overlap in the image. It
  has the same bold dark outline as everything else. Color: gray #c9ced6.
The pillar stands left of the center so that pillar and shadow together are centered and fill
about 70% of the image.
Nothing else: no base block, no capital, no grooves, no bricks, no cracks, no highlight, no
hatching, no ground line. About 8 lines in total.
```

### 4 · `pyramid`

Objective: Light side, dark side and a long pointed shadow from a low sun.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: one pyramid with a square base standing on the ground, a low sun on its left, and the
pyramid's long pointed shadow on its right.
VIEW: this image is not a flat front view. The pyramid is seen from slightly above, with one corner
of its base turned toward the viewer, so exactly two of its triangular faces show: a left face and
a right face. Hidden edges are not drawn.
LIGHT: it comes from the low sun on the left, so the left face is light, the right face is dark,
and the shadow on the ground is long and points to the right, away from the sun.
- Left face: a triangle. Its bottom edge runs from the far left corner of the base down to the
  front corner, which is the lowest point of the pyramid and sits under the tip. Color: yellow
  #f7cf46.
- Right face: a triangle. Its bottom edge runs from the front corner up to the far right corner of
  the base. Color: orange #f08a2c.
- The two faces share one edge, from the softly rounded tip at the top straight down to the front
  corner. It is drawn once, as a single line. The pyramid is five straight lines.
- Shadow: one long, narrow, pointed triangle lying on the ground to the right of the pyramid. Its
  first side is the bottom edge of the right face, drawn once and shared with the pyramid. From the
  far right corner of the base, one long straight line runs down to the right, parallel to the
  bottom edge of the left face. From the front corner, a second long straight line runs almost
  level to the right. The two lines meet in one sharp point, which lies to the right of the pyramid
  at a distance of about three quarters of the pyramid's width. It has the same bold dark outline
  as everything else. Color: gray #c9ced6.
- Sun: one plain circle, about one sixth as wide as the pyramid, to the left of the pyramid and low:
  its center is no higher than the middle of the pyramid's height. It touches nothing, with a clear
  white gap between it and the pyramid. No rays. Color: red #d8433b.
Sun, pyramid and shadow together are centered and fill about 75% of the image's width.
Nothing else: no bricks, no blocks, no door, no sand, no dunes, no ground line, no horizon, no
clouds, no rays, no hatching. Count the lines: seven straight lines and one circle.
```

### 5 · `clay-pot`

Objective: Round pot shaded with hatching, crossed where it is darkest.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: one round clay pot, shaded with pen hatching on its shadow side, and crosshatched where
the shadow is darkest.
VIEW: a flat front view, seen straight on. The opening of the pot is not seen: no ellipse.
LIGHT: it comes from the upper left, so the shadow is on the right part of the pot and is darkest
at the lower right. The shadow is shown only by pen lines, never by a darker color.
- Rim: a low, wide band with softly rounded corners along the top of the pot, about half as wide
  as the pot's widest part. Color: brown #8a5a33.
- Body: one smooth round shape hanging under the rim. It starts at the underside of the rim, a
  little narrower than the rim, swells out to a wide round belly, and rounds back in to a short,
  flat, level bottom edge. The underside of the rim is drawn once and shared. The whole body is one
  flat color with no lighter or darker zone. Color: orange #f08a2c.
- Hatching: exactly six straight lines on the right part of the body, parallel to one another, all
  slanting the same way (down to the left, like /), evenly spaced with clear gaps between them. The
  middle lines are the longest and the outer ones the shortest, so together they fill a crescent
  that follows the body's right edge. Each one floats: it touches neither the body's outline nor
  another hatch line.
- Crosshatching: exactly three more straight lines, parallel to one another, slanting the other way
  (down to the right, like \), lying over the lowest three hatch lines at the lower right of the
  body. Each of them crosses two or three hatch lines on purpose; this crossing is the point of the
  lesson. They also float clear of the body's outline.
Nothing else: no handles, no lid, no pattern, no stripes, no plant, no highlight, no cast shadow, no
ground line, no darker color on the shadow side. Count the hatch lines: six one way, three the
other way, nine in all.
```

### 6 · `glass-marble`

Objective: Shiny ball with a window highlight and a bright spot inside its shadow.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: one glass marble resting on the ground, with one window-shaped highlight on it and one
bright spot of light inside its cast shadow.
VIEW: the marble is a perfect circle. The ground is seen from slightly above, so the cast shadow
lying on it is drawn as a flat ellipse.
LIGHT: it comes from a window at the upper left. The highlight is the window's reflection on the
marble's upper left. The cast shadow falls on the ground to the right, and the light that passes
through the glass makes one bright spot in the middle of that shadow.
- Marble: one perfect circle. The whole marble is one flat color with no lighter or darker zone.
  Color: leaf green #4f9d4a.
- Window highlight: exactly one small four-sided shape in the upper left of the marble, like a
  small window pane that bends with the ball: its four sides are gently curved and its corners are
  soft. It is about one fifth of the marble's width and floats well inside the circle, touching
  nothing. It has its own bold dark outline and no cross or bars inside. Color: cream #f6e7b8.
- Cast shadow: one flat ellipse lying on the ground, a little wider than the marble and about one
  third as tall as it is wide. It starts under the marble and reaches out to the right. The marble
  overlaps it and hides its left end; this is the only overlap in the image. It has the same bold
  dark outline as everything else. Color: gray #c9ced6.
- Bright spot: exactly one small flat ellipse inside the part of the cast shadow that shows to the
  right of the marble, about one third as long as the shadow. It floats: it touches neither the
  shadow's outline nor the marble, with a clear band of gray all around it. It has its own bold dark
  outline. Color: pale green #b9dc8a.
The marble and its shadow together are centered and fill about 60% of the image.
Nothing else: no swirl or ribbon inside the marble, no second highlight, no shine streak, no
crescent shadow on the marble, no hatching, no ground line. Four shapes only: circle, highlight,
cast shadow, bright spot.
```

### 7 · `candle`

Objective: Flame with two glow rings, the light coming from inside the picture.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: one lit candle. Its flame is the light in this picture, and the light is drawn as exactly
two rings around the flame.
VIEW: a flat front view, seen straight on.
LIGHT: it comes from the flame itself, in the middle of the picture, and spreads evenly in every
direction. The two glow rings described below are named parts of this subject, drawn as plain
outlined circles: they are the one exception to the rule against glow.
- Candle: one plain upright bar with softly rounded corners and a level top, about three times as
  tall as it is wide, standing in the lower half of the image. Color: red #d8433b.
- Wick: exactly one short straight upright line from the middle of the candle's top up to the
  bottom of the flame. It touches both. It is a line, not a shape: the same charcoal line as
  everything else.
- Flame: one smooth teardrop, round at the bottom and coming to a soft point at the top, about as
  wide as half the candle and about as tall as the candle is wide. Color: orange #f08a2c.
- Inner glow ring: one perfect circle centered on the flame, about twice as wide as the flame is
  tall, so there is a clear band of color all around the flame. The area between the flame and
  this circle is one flat color: yellow #f7cf46.
- Outer glow ring: a second perfect circle with the same center, about one and a half times as
  wide as the first. The band between the two circles is one flat color: cream #f6e7b8.
- The top of the candle reaches up into the inner ring. The candle stands in front of both circles
  and hides the short part of each circle that passes behind it; the circles meet the candle's
  upright sides cleanly. This is the only overlap in the image.
The rings and the candle together are centered and fill about 72% of the image's height.
Nothing else: no holder, no dish, no drips, no melted wax, no smoke, no rays, no sparkles, no third
ring, no dark background, no shading on the candle. Count the circles: two.
```

### 8 · `desk-lamp`

Objective: Lamp with a pool of light and a box whose shadow points away from it.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: a desk lamp standing on a desk top, the pool of light it makes on the desk, and one small
box standing in that pool with its shadow pointing away from the lamp.
VIEW: this image is not a flat front view. Everything is seen from slightly above, so the pool of
light and the lamp's foot are drawn as flat ellipses, and the box shows three faces with parallel
edges staying parallel: no vanishing points. Everything is opaque; hidden edges are not drawn.
LIGHT: it comes from the lamp's bulb, inside the picture, at the upper left. The box stands to the
right of the lamp, so the box's shadow falls to the right, pointing away from the lamp.
- Pool of light: one large flat ellipse lying on the desk, about 80% of the image's width and about
  one third as tall as it is wide, in the lower half of the image. Color: cream #f6e7b8. The lamp's
  foot, the box and the box's shadow all lie inside it, with a clear band of cream around each.
- Lamp foot: one small flat ellipse inside the left part of the pool. Color: purple #7b4fa3.
- Lamp arm: one narrow straight bar, a closed shape, rising from the middle of the foot and leaning
  a little to the right, about half the image's height long. It passes in front of the pool's back
  edge and hides a short part of it. Color: purple #7b4fa3, the same as the foot; the foot's
  outline separates them.
- Lamp shade: one four-sided shape with straight sides, narrow at the top and wide at the bottom,
  like a bucket turned upside down, sitting on the upper end of the arm and tilted so its wide
  opening faces down and to the right, toward the box. Color: red #d8433b.
- Bulb: one half circle hanging from the middle of the shade's wide edge, its flat side shared with
  that edge and drawn once. Color: yellow #f7cf46.
- Box: one small cube inside the right part of the pool, about one fifth of the image's width,
  showing its top, its left face and its right face, the three faces meeting like the letter Y, nine
  straight lines. Top: pale green #b9dc8a. Left face, toward the lamp: leaf green #4f9d4a. Right
  face, away from the lamp: dark green #2f6b3a.
- Box shadow: one flat four-sided shape (a parallelogram) lying on the desk to the right of the box.
  Its first side is the bottom edge of the box's right face, drawn once and shared. From each end
  of that edge, one straight line runs down to the right, parallel to the bottom edge of the box's
  left face, about two thirds as long as an edge of the box. A fourth straight line closes the
  shape. It stays inside the pool of light. It has the same bold dark outline as everything else.
  Color: gray #c9ced6.
- There is a clear gap between the lamp and the box, and nothing else overlaps.
Nothing else: no cable, no switch, no plug, no books, no pencils, no desk edge, no wall, no rays or
beams from the bulb, no second shadow, no shadow under the lamp, no hatching.
```

### 9 · `window-light`

Objective: Room corner with a four-pane window and its slanted patch of light on the floor.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: the corner of an empty room: a back wall with one four-pane window, a side wall on the
left, the floor, and on the floor the slanted patch of light that the window throws.
VIEW: this image is not a flat front view of an object. It is a look into a room, drawn inside one
square panel with its own bold outline, about 76% of the image wide and centered on the white
paper. This panel is the one exception to the rule against frames. Nothing reaches outside it.
LIGHT: the sun shines in through the window from the upper left, so the patch of light lies on the
floor below the window and to its right, with its sides slanting down to the right.
- Corner line: one straight upright line from the panel's top edge, about one quarter of the way in
  from the left, down to a point a little below the middle of the panel.
- Floor line: one straight level line from the lower end of the corner line to the panel's right
  edge.
- Side wall line: one straight line from the lower end of the corner line slanting down to the
  left, ending on the panel's left edge a little above the bottom left corner.
- These three lines meet at one point and split the panel into three areas. Back wall, the large
  area at the upper right: blue #5b8fc7. Side wall, the narrow area on the left: purple #7b4fa3.
  Floor, the area along the bottom: brown #8a5a33.
- Window: one upright rectangle in the middle of the back wall, floating clear of the corner line,
  the floor line and the panel's edges. One straight upright line and one straight level line cross
  in its center and divide it into exactly four equal panes; both lines touch the rectangle's
  outline on purpose. No separate frame, no sill. All four panes: yellow #f7cf46. The four panes
  sharing one color is an exception to the rule about neighboring areas.
- Patch of light: one slanted four-sided shape (a parallelogram) on the floor, below the window and
  to its right, about as wide as the window. Its top and bottom edges are level; its two sides
  slant down to the right and are parallel. It floats clear of the floor line, the side wall line
  and the panel's edges. One line parallel to its slanted sides and one level line cross in its
  center and divide it into exactly four equal panes, like the window pushed over; both lines touch
  its outline on purpose. All four panes: cream #f6e7b8, the same kind of exception.
Nothing else: no curtains, no furniture, no door, no baseboard, no floorboards, no view through the
window, no sun, no rays or beams between the window and the patch, no hatching. Count the panes:
four in the window, four in the patch. About 19 straight lines in total.
```

### 10 · `night-street`

Objective: Street lamp, house and mailbox in one pool of light, every shadow pointing away.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. That includes hatch
lines, lines that divide a shape, and the outlines of shadows, highlights and patches of light. No
hairlines, no gray lines. The image is square.
FLAT LIGHT: this lesson is about light, so this image does have the light and shadow shapes described
below, and only those. Each one is a flat shape with its own bold dark outline and one flat color,
or a set of pen lines. No gradients, no soft edges, no blur, no glow, no transparency, no dark or
colored background: everything that is not described below is plain white paper.
SUBJECT: a small street scene at night: one street lamp in the middle, one simple house on its
left and one mailbox on its right, all three standing in the lamp's one pool of light, with the
house's and the mailbox's shadows pointing away from the lamp.
VIEW: the three things are drawn flat, from the front, standing side by side with their bottoms on
one level. The ground is seen from slightly above, so the pool of light lying on it is a flat
ellipse and the shadows are flat shapes lying on it.
LIGHT: it comes from the street lamp's lantern, inside the picture, in the middle. Shadows fall
away from the lamp: the house's to the left, the mailbox's to the right. The paper stays white:
night is not shown by a dark sky.
- Pool of light: one large flat ellipse lying on the ground, about 84% of the image's width and
  about one quarter as tall as it is wide. The three things stand on its level middle line, in
  front of its back edge, and each hides a short part of that back edge. Both shadows lie inside
  it. Color: cream #f6e7b8.
- Street lamp, in the middle, the tallest thing: a narrow straight upright post, a closed shape
  (dark green #2f6b3a). On top of it a lantern: a four-sided shape with straight sides, narrow at
  the bottom and wider at the top (yellow #f7cf46). On the lantern a cap: one low wide triangle, a
  little wider than the lantern (dark green #2f6b3a). Edges where these parts touch are drawn once.
- House, on the left, about one quarter of the image's width: a square wall (blue #5b8fc7); a roof
  that is one triangle sitting on the wall, a little wider than the wall (purple #7b4fa3); one door,
  an upright rectangle standing on the wall's bottom edge (brown #8a5a33); one square window beside
  the door, floating inside the wall, with no cross (yellow #f7cf46).
- Mailbox, on the right, the smallest thing, about half as tall as the house's wall: a narrow
  upright post, a closed shape (brown #8a5a33), carrying a box with a flat bottom, straight sides
  and a round arched top (blue #5b8fc7). One small narrow upright flag, a rectangle, is attached to
  the box's right side and stands up above the box's top (red #d8433b).
- House shadow: one flat four-sided shape lying on the ground to the LEFT of the house. Its right
  end is the lowest part of the house's left wall edge, drawn once and shared. Its bottom edge
  continues the house's bottom line level to the left; its top edge is parallel to that and a
  little shorter; its far left end is one slanted line. It is about one third as long as the house
  is wide, and low: about one eighth as tall as the house's wall. Color: gray #c9ced6.
- Mailbox shadow: the mirror image of that, smaller, lying on the ground to the RIGHT of the
  mailbox's post, starting at the lowest part of the post's right edge. Color: gray #c9ced6.
- Both shadows have the same bold dark outline as everything else, and both stay inside the pool
  of light with a clear band of cream around their free sides. The street lamp itself has no shadow.
- There is a clear gap between the house and the lamp, and between the lamp and the mailbox. Nothing
  overlaps except the three things standing in front of the pool's back edge.
Nothing else: no moon, no stars, no sky, no clouds, no road, no sidewalk, no fence, no plants, no
chimney, no smoke, no number or letters on the mailbox, no rays or beams from the lantern, no glow
rings, no hatching. Count the shadows: two, one pointing left and one pointing right.
```

## What to send back

The PNGs you like (any number per lesson), in `docs/curriculum/light-shadow/`, named
`<lesson-id>-<model>.png`. The usual failures to watch for on this path: a soft gradient across a
round form or a fading edge on a shadow, a shadow or highlight with no outline, a dark or blue night
background, rays or beams drawn from a light, a second shine spot, vanishing-point perspective on
the boxes, a shadow pointing toward the light, and hatch lines thinner than the outline.
