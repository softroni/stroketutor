# Forms — image-generation prompts

Source art for the ten `forms` lessons (Core level) in `plan.json`, written for a raster image model
(OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md).
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. For `still-life`, generate it last and also attach
  the kept `sphere`, `mug` and `stack-of-books` pictures.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/forms/<lesson-id>-<model>.png`, and record model, date and
  prompt version (`style-v2`) in the lesson's `--source`.

Things this path needs that the Starter paths did not, all asked for explicitly in the prompts so
the style prompt allows them:

- **A view from slightly above.** Every prompt has a VIEW paragraph that replaces "seen straight on".
  Boxes are drawn with parallel edges (no vanishing points: that belongs to Buildings), round forms
  with flat ellipses, and everything is opaque, so a hidden back edge or the back half of a bottom
  ellipse is never drawn.
- **One light direction, upper left, in all ten pictures.** On boxes it is three flat colors from the
  palette, lightest on top and darkest on the right (pale green / leaf green / dark green, cream /
  yellow / orange, gray / blue / purple). That also keeps the style prompt's rule that neighboring
  areas never share a color. Only `sphere` and `still-life` have hatching and a cast shadow, because
  only their objectives ask for them.
- **Shadows have an outline here.** The fruit bowl's shadow was gray with no outline; in this path
  every part has its own dark line, so a child has a line to draw and the trace has an edge to find.
- **Hatch lines, page lines and pips** are the same dark line and weight as the outlines, never
  thinner, and they float clear of the outline and of each other, so they trace as separate lines.

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
Match the attached image exactly in line color, line weight, corner rounding, flatness of color
and margins. The subject changes, and so does the view: follow the VIEW paragraph below.
```

## Lesson prompts

### 1 · `cube`

Objective: Box drawn from three visible faces.

```text
SUBJECT: one cube, drawn as a box from its three visible faces.
VIEW: this image is not a flat front view. The cube is seen from slightly above, with one upright
edge turned toward the viewer, so exactly three faces show: the top, the left side and the right
side. Edges that are parallel on the cube are drawn parallel: no vanishing points, no narrowing
toward the back. Hidden back edges are not drawn.
- Top face: a diamond lying flat, one corner pointing toward the viewer. Color: pale green #b9dc8a.
- Left face: a four-sided shape hanging from the top face's front left edge, with upright sides.
  Color: leaf green #4f9d4a.
- Right face: the mirror image of the left face, hanging from the top face's front right edge.
  Color: dark green #2f6b3a.
- The three faces share three edges, and those three edges meet at one point in the middle of the
  cube, like the letter Y. Each shared edge is drawn once, as a single line.
- All three faces look the same size. Exactly nine straight lines in total.
LIGHT: it comes from the upper left. It is shown only by the flat colors named here, lightest on
top and darkest on the right: no gradients, no hatching, no shadow.
Nothing else: no pattern on the faces, no ground. Count the lines: nine.
```

### 2 · `cylinder`

Objective: Two ellipses joined by straight sides.

```text
LINE WEIGHT: every line, including inner ellipses, page lines and hatch lines, is as bold as the
outline of the attached apple: about 1% of the image width (12 pixels on a 1254-pixel image), in the
same very dark charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one plain cylinder, like a tall tin with no label, a little taller than it is wide.
VIEW: this image is not a flat front view. The cylinder stands upright and is seen from slightly
above, so every circle on it is drawn as a flat ellipse, about three times as wide as it is tall.
It is opaque: nothing hidden behind it is drawn, and there are no dashed lines.
- Top: one complete ellipse. Color: yellow #f7cf46.
- Sides: exactly two straight upright lines, the same length, one down from the far left end of the
  top ellipse and one down from its far right end.
- Bottom: one curve joining the lower ends of the two sides. It is the front half of an ellipse of
  exactly the same size as the top one, so it bulges downward as much as the front of the top does.
- Body: the area between the top ellipse, the two sides and the bottom curve. Color: orange #f08a2c.
LIGHT: it comes from the upper left. It is shown only by the flat colors named here, lightest on
top and darkest on the right: no gradients, no hatching, no shadow.
Nothing else: no rim, no lid, no band, no seam. About 4 lines in total.
```

### 3 · `cone`

Objective: Ellipse base rising to a point.

```text
LINE WEIGHT: every line, including inner ellipses, page lines and hatch lines, is as bold as the
outline of the attached apple: about 1% of the image width (12 pixels on a 1254-pixel image), in the
same very dark charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one plain cone standing on its round base, point at the top, like a party hat with no
pattern. It is about one and a half times as tall as it is wide.
VIEW: this image is not a flat front view. The cone stands upright and is seen from slightly
above, so every circle on it is drawn as a flat ellipse, about three times as wide as it is tall.
It is opaque: nothing hidden behind it is drawn, and there are no dashed lines.
- Base: one curve along the bottom, the front half of a flat ellipse, bulging downward, running
  from the far left of the cone to the far right.
- Sides: exactly two straight lines, one from each end of the base curve, rising and leaning
  inward to meet at one softly rounded point at the top, exactly above the center of the base.
- The whole cone is one area. Color: purple #7b4fa3.
Nothing else: no stripes, no band, no pompom, no shadow, no hatching. Exactly 3 lines in total.
```

### 4 · `sphere`

Objective: Circle with a hatched shadow side and a cast shadow.

```text
SUBJECT: one ball resting on the ground, with a hatched shadow side and a cast shadow. This lesson
is about light, so this image does have hatching and one shadow, exactly as described here.
LIGHT: it comes from the upper left, so the ball's shadow side is its lower right, and its cast
shadow falls on the ground to the right.
- Ball: one perfect circle. The whole ball is one flat color with no lighter or darker zone.
  Color: orange #f08a2c.
- Hatching: exactly five short straight lines on the lower right part of the ball, parallel to one
  another, all slanting the same way (down to the left, like /), evenly spaced with clear gaps. The
  middle line is the longest and the two outer ones the shortest, so together they fill a crescent
  that follows the ball's lower right edge. They are the same dark line as the outline, the same
  weight, and each one floats: it touches neither the circle nor another hatch line.
- Cast shadow: one flat ellipse lying on the ground, about as wide as the ball and very flat. It
  starts under the ball and reaches out to the right. The ball overlaps it and hides its left end;
  this is the only overlap in the image. It has the same dark outline as everything else.
  Color: gray #c9ced6.
The subject fills about 60% of the image.
Nothing else: no highlight, no shine spot, no curved band on the ball, no ground line, no second
shadow. Count the hatch lines: five.
```

### 5 · `dice`

Objective: Cube with pips that follow each face.

```text
SUBJECT: one die (a single dice), a cube with pips on its three visible faces.
VIEW: this image is not a flat front view. The die is seen from slightly above, with one upright
edge turned toward the viewer, so exactly three faces show: the top, the left side and the right
side. Edges that are parallel on the die are drawn parallel: no vanishing points, no narrowing
toward the back. Hidden back edges are not drawn.
- Top face: a diamond lying flat, one corner pointing toward the viewer. Color: cream #f6e7b8.
- Left face: a four-sided shape hanging from the top face's front left edge, with upright sides.
  Color: yellow #f7cf46.
- Right face: the mirror image of the left face. Color: orange #f08a2c.
- The three faces share three edges that meet at one point in the middle, like the letter Y. Each
  shared edge is one single line. Nine straight lines make the cube; its corners are only gently
  rounded, like every corner in the course.
- Pips: exactly six, each a small solid oval filled with the dark charcoal line color #26292e.
  Every pip lies flat on its face, squashed and slanted the same way as that face, never a
  perfect circle. Each is well inside its face, touching no edge and no other pip.
  - Top face: exactly one pip, in the center.
  - Left face: exactly two pips, on a diagonal, one near the upper left corner of the face and one
    near its lower right corner.
  - Right face: exactly three pips in a diagonal row from the upper left corner of the face,
    through its center, to its lower right corner.
LIGHT: it comes from the upper left. It is shown only by the flat colors named here, lightest on
top and darkest on the right: no gradients, no hatching, no shadow.
Nothing else: no shine, no second die. Count the pips: one, two and three.
```

### 6 · `gift-box`

Objective: Cube with a lid, ribbon cross and bow.

```text
SUBJECT: one gift box: a cube-shaped box with a lid, a ribbon crossing over it and a bow on top.
VIEW: this image is not a flat front view. The box is seen from slightly above, with one upright
edge turned toward the viewer, so exactly three faces show: the top, the left side and the right
side. Edges that are parallel on the box are drawn parallel: no vanishing points, no narrowing
toward the back. Hidden back edges are not drawn.
- Box: the lower part. Two faces show, the left and the right, meeting at the upright edge nearest
  the viewer. Colors: left face blue #5b8fc7, right face purple #7b4fa3.
- Lid: a shallow box sitting on top, about a fifth as tall as the box below it and a little wider,
  so it sticks out slightly past the box on both sides. Three of its faces show: a diamond top and
  two narrow side strips. Colors: top gray #c9ced6, left strip blue #5b8fc7, right strip purple
  #7b4fa3. The lid's strips are the same colors as the box faces below them; that is intended.
- Ribbon: flat bands with a dark outline on both edges, all the same width, about a sixth of a
  face wide. One band runs down the middle of the left side, over the lid's strip and down the
  box's face to the bottom edge. One band does the same on the right side. On the lid's top, each
  band carries on across the diamond to the far edge, parallel to the top's edges, so the two
  bands cross in the center of the top. Colors: on the top cream #f6e7b8, on the left side yellow
  #f7cf46, on the right side orange #f08a2c.
- Bow: it sits in the center of the lid's top and hides the place where the bands cross. Exactly
  two loops, each a plump closed teardrop with its point at the center, one leaning up to the left
  and one up to the right, with no hole in them. Color: yellow #f7cf46. Between them, exactly one
  small round knot. Color: orange #f08a2c. No ribbon tails.
LIGHT: it comes from the upper left. It is shown only by the flat colors named here, lightest on
top and darkest on the right: no gradients, no hatching, no shadow.
Nothing else: no tag, no pattern on the paper, no creases in the bow, no sparkles.
```

### 7 · `soda-can`

Objective: Cylinder with a rim, tab and label band.

```text
SUBJECT: one soda can with a rim, a pull tab and a label band. The can is completely plain: no
brand, no logo, no letters, no picture. It is about twice as tall as it is wide, and it is a
straight cylinder: no sloping shoulder at the top, no narrowing at the bottom.
VIEW: this image is not a flat front view. The can stands upright and is seen from slightly
above, so every circle on it is drawn as a flat ellipse, about three times as wide as it is tall.
It is opaque: nothing hidden behind it is drawn, and there are no dashed lines.
- Rim: the top of the can is one complete ellipse with a second, smaller ellipse just inside it,
  making a narrow ring. Color of the ring: blue #5b8fc7.
- Lid: everything inside the smaller ellipse is one flat area. Color: gray #c9ced6.
- Tab: exactly one pull tab lying flat on the lid, a small rounded oval drawn as a closed shape,
  slightly toward the front of the lid. It touches neither ellipse and has no hole in it.
  Color: blue #5b8fc7.
- Sides: exactly two straight upright lines down from the far left and far right of the rim.
- Bottom: one curve joining the two sides, the front half of an ellipse the same size as the rim.
- Label band: exactly two curved lines across the body, each running from the left side to the
  right side and touching both, each bending exactly like the bottom curve. They mark off a wide
  band around the middle of the can, about a third of its height. Color of the band: cream #f6e7b8.
- Body above and below the band. Color: red #d8433b.
LIGHT: it comes from the upper left. It is shown only by the flat colors named here, lightest on
top and darkest on the right: no gradients, no hatching, no shadow.
Nothing else: no drops, no straw, no opening in the lid, no shine stripe, no bottom rim.
About 8 lines in total.
```

### 8 · `mug`

Objective: Cylinder with a handle and an inner ellipse.

```text
LINE WEIGHT: every line, including inner ellipses, page lines and hatch lines, is as bold as the
outline of the attached apple: about 1% of the image width (12 pixels on a 1254-pixel image), in the
same very dark charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: one mug with a handle, holding hot chocolate. It is about as tall as it is wide, with
straight upright sides.
VIEW: this image is not a flat front view. The mug stands upright and is seen from slightly
above, so every circle on it is drawn as a flat ellipse, about three times as wide as it is tall.
It is opaque: nothing hidden behind it is drawn, and there are no dashed lines.
- Rim: the top is one complete ellipse with a second, smaller ellipse just inside it, making a
  narrow ring, the thickness of the mug's wall. Color of the ring: watermelon pink #ee5a6a.
- Drink: everything inside the smaller ellipse is one flat area, the drink filled almost to the
  brim. Color: brown #8a5a33. No inside wall shows.
- Sides: exactly two straight upright lines down from the far left and far right of the rim.
- Bottom: one curve joining the two sides, the front half of an ellipse the same size as the rim.
- Body: Color: red #d8433b.
- Handle: on the left side of the mug. One band bent like the letter C turned around, drawn as a
  closed shape with an outer curve and an inner curve, joined to the mug's left side near the top
  and again near the bottom. The white background shows through the hole of the handle; it is the
  only white inside the subject. Color: red #d8433b, the same as the body; that is intended.
LIGHT: it comes from the upper left. It is shown only by the flat colors named here, lightest on
top and darkest on the right: no gradients, no hatching, no shadow.
Nothing else: no steam, no marshmallows, no pattern, no saucer, no spoon. About 8 lines in total.
```

### 9 · `stack-of-books`

Objective: Three offset boxes with page lines.

```text
LINE WEIGHT: every line, including inner ellipses, page lines and hatch lines, is as bold as the
outline of the attached apple: about 1% of the image width (12 pixels on a 1254-pixel image), in the
same very dark charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: THREE books (not two): a stack of exactly three closed books lying flat, one on top of another. Each book is a
flat box, much wider than it is tall, and the three get smaller toward the top.
VIEW: this image is not a flat front view. The stack is seen from slightly above, with one upright
edge turned toward the viewer, so exactly three faces show: the top, the left side and the right
side. Edges that are parallel on the stack are drawn parallel: no vanishing points, no narrowing
toward the back. Hidden back edges are not drawn. All three books point the same way, so all their edges are
parallel to one another.
- Every book shows the same three faces: its cover on top (a flat diamond-like shape), its spine
  on the left side, and the edges of its pages on the right side.
- Offset: each book is smaller than the one below it and sits toward the back, so a strip of the
  lower book's cover shows along its two front edges, like a step. The books rest on each other
  and touch only there.
- Bottom book, the largest: cover leaf green #4f9d4a, spine dark green #2f6b3a.
- Middle book: cover yellow #f7cf46, spine orange #f08a2c.
- Top book, the smallest, its whole cover visible: cover blue #5b8fc7, spine purple #7b4fa3.
- Pages: the right side of every book is its block of pages. Color: cream #f6e7b8. On each one,
  exactly two straight page lines run along its length, parallel to its long edges and evenly
  spaced. Each line starts and ends a little inside the face and touches nothing. They are the
  same dark line as the outlines, the same weight.
LIGHT: it comes from the upper left. It is shown only by the flat colors named here, lightest on
top and darkest on the right: no gradients, no hatching, no shadow.
Nothing else: no titles, no letters, no bookmark, no pattern on the covers, no curved spines.
Count the books: three. Count the page lines: two on each book, six in all.
```

### 10 · `still-life`

Objective: Mug, books and a sphere with one light direction.

```text
LINE WEIGHT: every line, including inner ellipses, page lines and hatch lines, is as bold as the
outline of the attached apple: about 1% of the image width (12 pixels on a 1254-pixel image), in the
same very dark charcoal. No hairlines, no gray lines. The image is square.
SUBJECT: a still life of three things standing in a row on a table, lit from one side: a ball, a
mug and a stack of two books. They are drawn in the same shapes as the three other attached
images, with less detail. This lesson is about light, so this image does have hatching and cast
shadows, exactly as described here.
VIEW: this image is not a flat front view. Everything is seen from slightly above. Circles are
drawn as flat ellipses, and the books show three faces, with parallel edges staying parallel: no
vanishing points. Everything is opaque; nothing hidden is drawn.
LIGHT: it comes from the upper left, for all three things alike. Tops are lightest, right sides
darkest, and every cast shadow falls on the table to the right.
- The three things stand side by side with their bottoms on about the same level. They do not
  touch or overlap: there is a clear white gap between each thing, and between each shadow and the
  next thing.
- Ball, on the left: one perfect circle. Color: orange #f08a2c. On its lower right, exactly three
  short straight hatch lines, parallel, slanting down to the left (like /), the middle one
  longest, each floating clear of the circle and of each other.
- Mug, in the middle, the tallest thing: rim ellipse with a smaller ellipse just inside it (ring:
  watermelon pink #ee5a6a), the drink inside (brown #8a5a33), two straight upright sides, a curved
  bottom, body red #d8433b, and a C-shaped handle on its left side in the same red, with the white
  background showing through the handle's hole.
- Books, on the right: exactly two flat books, the smaller one resting on the larger one and set
  toward the back. Each shows its cover on top, its spine on the left side and its pages on the
  right side. Bottom book: cover leaf green #4f9d4a, spine dark green #2f6b3a. Top book: cover blue
  #5b8fc7, spine purple #7b4fa3. Pages: cream #f6e7b8, with exactly one floating page line along
  each book's page side.
- Cast shadows: exactly three, one for each thing. Each of the three cast shadows has the same bold
  dark outline as everything else; a shadow without an outline is wrong. There is one for each thing, each a flat shape lying on the table with the
  same dark outline as everything else. Color: gray #c9ced6. The ball's and the mug's are flat
  ellipses that start under the thing and reach a short way to the right, their left ends hidden
  by the thing. The books' is a narrow slanted four-sided strip lying against the bottom edge of
  the page side, reaching a short way to the right.
Nothing else: no table edge, no cloth, no wall, no steam, no highlights, no hatching on the mug or
the books. Count the hatch lines: three. Count the shadows: three.
```

## First round, 2026-09-20 (OpenAI)

Kept: `cube`, `sphere`, `gift-box` (clean), `dice`, `soda-can` (pip and tab outlines from the color-edge
trace, `svg trace --ink-max-channel 0`, merged into the ink trace). Asked again: `cylinder` and `cone`
(hairline outlines, about 0.3% of the width, trace in pieces), `mug` (hairline inner ellipse),
`stack-of-books` (two books instead of three, thin gray page lines), `still-life` (not square, shadows
without outlines, hairline hatching). The LINE WEIGHT paragraph at the top of those five prompts came
from this round.

## Second round, 2026-09-20 (OpenAI)

New `cone`, `cylinder` and `mug` with the LINE WEIGHT paragraph: bold lines, all three trace clean. The
creator kept the two-book `stack-of-books` (the objective is now "Two offset boxes with page lines"; the
prompt above still describes three and is kept for the record); its thin page lines need
`svg from-image --min-area 10`. The new `still-life` is square and bold, mug left, ball middle, but its
shadows still have no outline, so their outlines come from the color-edge trace.

## What to send back

The PNGs you like (any number per lesson), in `docs/curriculum/forms/`, named
`<lesson-id>-<model>.png`. The usual failures to watch for on this path: a soft gradient across a
round form, a shine spot on the ball or the can, vanishing-point perspective on the boxes, dashed
hidden edges, a brand or letters on the can, steam over the mug, titles on the books, and pips drawn
as perfect circles instead of lying on their faces.
