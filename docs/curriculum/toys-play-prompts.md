# Toys & Play — image-generation prompts

Source art for the ten `toys-play` lessons (Starter level) in `plan.json`, written for a raster
image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. `toy-shelf` is a small scene and uses the scene
  reference line instead.
- Square, 1024 × 1024 or larger, PNG, opaque white background. Make `dominoes` and `toy-shelf` as
  large as the tool allows: the dots and the small toys need the pixels.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/toys-play/<lesson-id>-<model>.png`, and record model,
  date and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Every lesson is a flat view, seen straight on.** Round things (balloon, yo-yo, spinning top) get
  their roundness from their outline and a few curved lines, never from shading.
- **Every part has its own dark outline**: the balloon's knot, every block, every bow on the kite's
  tail, the pin of the pinwheel, every domino dot, each drumstick. Nothing is told apart by color
  alone.
- **Parts touch only where one is attached to another**, along a shared edge drawn once (knot under
  the balloon, block on block, handle on the top, stick under the pinwheel, blades on the pin) or
  where a single line lands on an outline (the balloon's string, the yo-yo's string, the kite's
  tail). Everything else keeps a clear white gap.
- **Details are single bold lines**: the strings, the kite's tail, the drum's zigzag. Charcoal lines
  of the outline's weight, never tubes or ribbons.
- **Lines that cut a shape into colored areas are the exception that touches**: the kite's cross,
  the spinning top's stripe lines, the drum's rim lines and the dominoes' dividing lines reach the
  outline at both ends on purpose, so that every band is its own closed area. Two single lines
  cross only inside the kite, where the cross is the lesson.
- **Only the drumsticks overlap**, because the objective asks for crossed sticks: the front stick is
  whole and hides a short stretch of the back one. The blocks are stacked, not overlapped: each
  sits on the one below along a shared edge. In the toy shelf every toy stands apart.
- **Nothing is white inside a subject**: the dominoes are cream, not white. The only white inside an
  outline is paper showing through the yo-yo's finger loop.
- **No highlights, shading, texture or shadow anywhere**: no objective asks for one. No shine on the
  balloon or the yo-yo, no wood grain on the blocks or the shelf, no motion lines on the top or the
  pinwheel.
- **No living things and no faces**: the blocks carry no letters (no text anywhere), the drum and
  the top carry no pictures.

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

For `toy-shelf` only (the same apple attached):

```text
Match the attached image exactly in line color, line weight, corner rounding and flatness of
color. This image is a small scene, not one subject, so the margins are smaller and the parts are
smaller, but every line stays exactly as bold as in the attached image.
```

## Lesson prompts

### 1 · `balloon`

Objective: Oval with a small knot and a wavy string.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the balloon floating upright with its string hanging
straight down below it. No perspective, no tilt.
SUBJECT: one balloon: an oval, exactly one small knot under it, and exactly one wavy string.
- Balloon: one single closed outline, an upright oval, a little taller than it is wide, rounder
  at the top and very slightly narrower at the bottom, like an egg standing on its narrow end.
  Color: red #d8433b.
- Knot: exactly one small knot hanging from the bottom of the oval: a small closed shape like a
  short, wide triangle with its point up, about a tenth of the balloon's width wide and half as
  tall, with rounded corners. Its top is attached to the balloon and shares a short stretch of
  the oval's outline: one line drawn once. Color: watermelon pink #ee5a6a.
- String: exactly one single bold line, the same charcoal line as the outline, with no color: not
  a tube, not a closed shape. It starts on the bottom edge of the knot and hangs down in a lazy
  wave, bending once to the left and once to the right, like a soft letter S, and ends in the
  air below with a round line end. It is about as long as the balloon is tall and touches
  nothing but the knot.
The balloon with its knot and string fills about 72% of the image height; the balloon alone is
about 45% of the image width.
Nothing else: no shine spot, no highlight, no second balloon, no ribbon, no bow, no hand, no
cloud, no shadow. Three lines in total. Count: one oval, one knot, one string.
```

### 2 · `kite`

Objective: Diamond with a cross inside and a tail with three bows.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the kite standing upright, point up, tail hanging
straight down. No perspective, no tilt.
SUBJECT: one kite: a diamond, exactly one cross inside it, and exactly one tail with exactly three
bows.
- Diamond: one single closed outline with exactly four straight sides and four corners: one
  corner at the top, one at the left, one at the right and one at the bottom. It is taller than
  it is wide, about four tall to three wide, and the left and right corners sit above the middle
  of its height, so the top half is shorter than the bottom half. The corners are gently rounded.
- Cross: exactly two single bold straight lines inside the diamond, the same charcoal line as the
  outline, with no color. One runs from the top corner straight down to the bottom corner. The
  other runs from the left corner straight across to the right corner. They cross at exactly one
  point and reach the outline at both ends, on purpose, so that they cut the diamond into exactly
  four triangles, each its own closed area. Colors: top left triangle red #d8433b, top right
  triangle yellow #f7cf46, bottom left triangle blue #5b8fc7, bottom right triangle leaf green
  #4f9d4a.
- Tail: exactly one single bold line, the same charcoal line as the outline, with no color. It
  starts on the bottom corner of the diamond and hangs down with two gentle bends, like a
  loose letter S, ending in the air below with a round line end. It is about half as long as the
  diamond is tall.
- Bows: exactly three bows on the tail, evenly spaced along it, the lowest one at the tail's end.
  Each bow is one small closed shape like a bow tie: two small triangles meeting point to point
  in a narrow waist, lying across the tail. Each bow sits in front of the tail, so the tail line
  runs into the top of the bow and out of its bottom, touching the bow's outline at those two
  points and nowhere else. The bows touch neither the diamond nor one another. Color: orange
  #f08a2c.
The kite with its tail fills about 78% of the image height.
Nothing else: no string held by anyone, no clouds, no wind lines, no pattern on the triangles, no
shine, no shadow. Seven lines in total, plus the three bows. Count: four triangles, one cross,
three bows.
```

### 3 · `building-blocks`

Objective: Square, rectangle and triangle blocks stacked in a tower.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the tower standing upright. No perspective: every
block shows one flat face only, with no top or side faces.
NO GROUND: the tower stands on plain white paper. No ground line, no table, no shadow.
SUBJECT: one tower of exactly five toy blocks, stacked: two rectangles, two squares and one
triangle.
- Bottom block: one long rectangle lying flat, about 60% of the image width wide and a fifth as
  tall as it is wide. Color: blue #5b8fc7.
- Middle blocks: exactly two squares of the same size standing on the bottom block, side by side,
  one near its left end and one near its right end, with a clear gap of white between them
  about as wide as one square. Each square is about a third of the bottom block's width wide.
  Each square's bottom edge rests on the bottom block's top edge and shares it: one line drawn
  once. Colors: left square red #d8433b, right square leaf green #4f9d4a.
- Upper block: one rectangle lying flat across the tops of both squares, the same size as the
  bottom block, like a bridge, so that between the two squares a rectangle of white paper shows
  through. Its bottom edge rests on both squares' top edges and shares them. Color: yellow
  #f7cf46.
- Top block: exactly one triangle standing on the middle of the upper block, point up, with a
  base about a third of the block's width wide and about as tall as its base. Its base rests on
  the upper block's top edge and shares it. Color: purple #7b4fa3.
- Every block is one single closed outline with straight sides and gently rounded corners, and
  every block's outline is drawn in full, including the shared edges, so each block is its own
  closed shape. The blocks are exactly lined up: the tower is the same on the left and on the
  right.
The tower fills about 68% of the image height.
Nothing else: no letters, numbers or pictures on the blocks, no wood grain, no side faces, no
extra blocks, no fallen block, no shadow. Five lines in total. Count: two rectangles, two squares,
one triangle.
```

### 4 · `yo-yo`

Objective: Circle with an inner ring and a string ending in a finger loop.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on: the yo-yo's flat round face turned toward the viewer,
its string rising straight up above it. No perspective.
SUBJECT: one yo-yo: a circle with exactly one inner ring, and exactly one string ending in exactly
one finger loop.
- Outer circle: one single closed outline, a perfect circle, about 50% of the image width across,
  in the lower part of the image.
- Inner circle: exactly one smaller circle inside it, with the same center, about half as wide.
  The ring between the two circles is one flat area. Color of the ring: red #d8433b. Color of the
  inner circle: yellow #f7cf46. The inner circle holds nothing: no dot, no star, no letter.
- String: exactly one single bold line, the same charcoal line as the outline, with no color: not
  a tube, not a closed shape. It starts on the top of the outer circle, exactly at its topmost
  point, and rises straight up with one very gentle bend, about as long as the yo-yo is tall.
- Finger loop: at the top end of the string, exactly one small loop: a small closed oval drawn
  as a line, about a seventh of the yo-yo's width across, standing upright, with the string
  joining it at its bottom point. The loop is empty: white paper shows inside it.
The yo-yo with its string and loop fills about 78% of the image height.
Nothing else: no groove drawn as a second ring, no shine spot, no highlight, no hand, no finger,
no motion lines, no shadow. Four lines in total. Count: two circles, one string, one loop.
```

### 5 · `dominoes`

Objective: Three tiles, each split by a line, with up to six dots a half.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on: three domino tiles standing upright side by side, their
dotted faces turned toward the viewer. No perspective: no top or side faces.
NO GROUND: the tiles stand on plain white paper. No ground line, no table, no shadow.
SUBJECT: exactly three domino tiles, each split into two halves by a line, with dots on the halves.
- Tiles: exactly three, all the same size, each one single closed outline: a tall rectangle
  standing upright, twice as tall as it is wide, with rounded corners. They stand in a row at the
  same height, evenly spaced, with a clear gap of white between neighbors about a third of a
  tile's width wide. No tile touches another. Color of every tile: cream #f6e7b8.
- Dividing lines: exactly one single bold straight line across the middle of each tile, from its
  left edge to its right edge, reaching the outline at both ends on purpose, so that each tile
  is cut into a top half and a bottom half, two squares. Both halves stay cream: this is the one
  place in the image where two neighboring areas share a color, and the line between them is
  what tells them apart.
- Dots: each dot is a small solid circle filled with the same very dark charcoal as the lines,
  about a tenth of a tile's width across, well inside its half, touching no edge, no line and no
  other dot. The dots are laid out as on a real domino and a die:
  - Left tile: top half exactly one dot, in the center. Bottom half exactly two dots, on a
    diagonal from the upper left to the lower right.
  - Middle tile: top half exactly three dots, on a diagonal from the upper left to the lower
    right, the middle one in the center. Bottom half exactly four dots, one in each corner.
  - Right tile: top half exactly six dots, in two upright columns of three, near the left and the
    right side of the half. Bottom half exactly no dots: empty cream.
The three tiles together fill about 72% of the image width.
Nothing else: no numbers, no colored dots, no shine, no wood grain, no side faces, no fallen tile,
no shadow. Six lines in total, plus sixteen dots. Count the dots: one, two, three, four, six, and
an empty half. Sixteen dots in all.
```

### 6 · `spinning-top`

Objective: Rounded body with three stripes, a pointed tip and a short handle.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on, the top standing perfectly upright on its point, handle
up. No perspective, no tilt, no spinning.
NO GROUND: the top stands on plain white paper. No ground line, no shadow.
SUBJECT: one spinning top: a rounded body with exactly three stripes, ending in one pointed tip at
the bottom, with exactly one short handle on top.
- Body: one single closed outline, the same on the left and on the right, like an onion or a
  spinning top seen from the side: a gently rounded top, wide round shoulders, widest a little
  above the middle of its height, then curving in and down to one sharp point at the bottom
  center, the tip. It is about as wide as it is tall, not counting the handle.
- Stripe lines: exactly two single bold curved lines across the body, the same charcoal line as
  the outline, with no color, one above the other. Each runs from the left edge of the body to
  the right edge, reaching the outline at both ends on purpose, and bows gently downward in the
  middle, like a smile, to show the body is round. The upper line crosses the body a little
  above its widest point; the lower line crosses it a little below the widest point. They cut
  the body into exactly three bands, the stripes, each its own closed area: the top band, the
  middle band, and the bottom band, which narrows down into the point. Colors: top band red
  #d8433b, middle band yellow #f7cf46, bottom band blue #5b8fc7.
- Handle: exactly one short, stubby handle rising from the top center of the body: a narrow
  closed shape about a sixth of the body's width wide and about a quarter of the body's height
  tall, with straight sides and a rounded top, like a short peg. Its bottom end is attached to
  the body and shares a short stretch of the body's outline: one line drawn once. Color: brown
  #8a5a33.
The top with its handle fills about 68% of the image height.
Nothing else: no motion lines, no swirl, no pattern on the bands, no shine spot, no string, no
separate metal tip, no ground, no shadow. Four lines in total. Count: three stripes, two stripe
lines, one point, one handle.
```

### 7 · `pinwheel`

Objective: Four folded blades around a center pin on a stick.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the wheel facing the viewer, the stick hanging straight
down. No perspective, no tilt, no turning.
SUBJECT: one pinwheel: exactly four blades around exactly one center pin, on exactly one stick.
- Pin: exactly one small circle in the center of the wheel, about 8% of the image width across.
  Color: yellow #f7cf46.
- Blades: exactly four, all the same size and shape, one pointing up, one right, one down and one
  left, like the four sails of a windmill. Each blade is one single closed shape, a long triangle:
  its narrow inner corner touches the pin's outline at one point, and its wide end is out toward
  the edge of the wheel. One long side of each blade is straight and the other bows outward in
  one gentle curve, and all four blades lean the same way around, clockwise, like a wheel about
  to turn: this is the fold. The blades are attached to the pin only; between neighboring blades
  a clear wedge of white paper stays open, at least three line-widths wide everywhere, and no
  blade touches or overlaps another. The wheel is about 58% of the image width across. Colors,
  going around clockwise from the top: red #d8433b, blue #5b8fc7, leaf green #4f9d4a, orange
  #f08a2c.
- Stick: exactly one straight stick hanging straight down from the wheel, drawn as a narrow
  closed shape about three line-widths thick and about as long as the wheel is wide, with a flat
  bottom end. Its top end disappears behind the lowest blade: it starts on the bottom outline of
  that blade and shares a short stretch of it, one line drawn once. Color: brown #8a5a33.
The pinwheel with its stick fills about 80% of the image height.
Nothing else: no motion lines, no wind, no fold lines inside the blades, no hand, no shine, no
shadow. Six lines in total. Count: four blades, one pin, one stick.
```

### 8 · `puzzle-piece`

Objective: Square with two round knobs and two matching notches.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the piece lying flat and square to the image edges.
No perspective, no tilt.
SUBJECT: one jigsaw puzzle piece: a square with exactly two round knobs sticking out and exactly
two matching round notches cut in.
- Piece: one single closed outline, based on a square with gently rounded corners, about 58% of
  the image width across. Out of the middle of its top edge sticks one round knob: the outline
  curves in a little, swells out into a round bump like a small mushroom head, and curves back
  in to the edge. Out of the middle of its right edge sticks a second knob, exactly the same.
  Into the middle of its left edge is cut one round notch, the exact mirror of a knob: the
  outline goes in through a narrow neck into a round hollow and comes back out. Into the middle
  of its bottom edge is cut a second notch, exactly the same. The knobs and notches are all the
  same size: each round part about a fifth of the square's width across. The knobs point up and
  right; the notches open left and down. The white paper shows inside the two notches.
  Color: blue #5b8fc7.
Nothing else: no picture on the piece, no second piece, no cut lines inside, no shine, no
shadow. One line in total. Count: two knobs, two notches.
```

### 9 · `toy-drum`

Objective: Drum with zigzag lacing between two rims and two crossed sticks.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on, the drum standing upright with the two sticks floating
crossed above it. No perspective: the drum is a plain upright shape, with no top face showing.
NO GROUND: the drum stands on plain white paper. No ground line, no shadow.
SUBJECT: one toy drum with zigzag lacing between two rims, and exactly two drumsticks crossed
above it.
- Drum: one single closed outline, a rectangle a little wider than it is tall, about 56% of the
  image width wide, with gently rounded corners.
- Rim lines: exactly two single bold straight lines across the drum, the same charcoal line as
  the outline, with no color, one a little below the top edge and one a little above the bottom
  edge, each from the left edge to the right edge, reaching the outline at both ends on purpose.
  They cut the drum into exactly three bands, each its own closed area: a narrow top rim, a wide
  middle, and a narrow bottom rim. Colors: top rim yellow #f7cf46, middle red #d8433b, bottom
  rim yellow #f7cf46.
- Lacing: exactly one single bold zigzag line inside the middle band, the same charcoal line,
  with no color, running from the left toward the right in exactly four V shapes: it goes down,
  up, down, up, down, up, down, up, with sharp points. Its upper points sit just below the top
  rim line and its lower points just above the bottom rim line. It floats: it touches neither
  rim line nor the drum's outline nor its own other parts, and it stops a little short of the
  left and right edges.
- Drumsticks: exactly two, floating above the drum with a clear gap of white between them and the
  drum's top edge. Each stick is one single closed shape: a narrow straight rod about three
  line-widths thick with a round ball at its top end, like a matchstick or a lollipop, about as
  long as the drum is tall. The two sticks cross each other in an X, balls up and out, rods
  down and in, crossing a little below their middles. The left-leaning stick is in front: its
  outline is whole. The other stick is behind it: its outline is drawn only where it shows,
  above and below the front stick, so the front stick hides a short stretch of it. This crossing
  is the only overlap in the image. Color of both sticks: brown #8a5a33.
The drum with the sticks above it fills about 76% of the image height.
Nothing else: no top face, no ellipse, no strap, no pattern on the bands, no shine, no music
notes, no ground, no shadow. Six lines in total plus the crossed sticks. Count: two rims, one
zigzag with four V shapes, two sticks.
```

### 10 · `toy-shelf`

Objective: Shelf with blocks, a top, a drum and a kite leaning beside it in one scene.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective: every part shows one flat face only.
NO GROUND: everything stands on plain white paper. No ground line, no wall, no floor, no shadow.
SUBJECT: a small scene: one low toy shelf with three toys standing on it, and one kite leaning
against the shelf's right end. Every toy is a very simple version of the toys earlier in this
course, with fewer lines.
- Shelf: one long flat board, a rectangle lying flat about 62% of the image width wide and about
  a fourteenth as tall as it is wide, in the lower half of the image, drawn as one single closed
  outline. Under it stand exactly two short legs, one near each end, each a small standing
  rectangle about three times as tall as the board is thick and about as wide as the board is
  thick. Each leg's top edge is attached to the board's bottom edge and shares it: one line
  drawn once. Color of the board and both legs:
  brown #8a5a33.
- On the board, from left to right, each toy standing on the board's top edge and sharing it, with
  a clear gap of white between neighboring toys at least as wide as the drum's rim is tall:
  1. Blocks: exactly one square block, one single closed outline, color blue #5b8fc7, with exactly
     one triangle block standing on the middle of its top edge, point up, its base a little
     narrower than the square, color red #d8433b.
  2. Spinning top: exactly one, standing on its point: one single closed outline with a rounded
     top and shoulders narrowing to a sharp point at the bottom, cut by exactly one bold curved
     stripe line across its middle, from edge to edge, bowing gently downward, into two bands.
     Colors: upper band yellow #f7cf46, lower band leaf green #4f9d4a. A short peg handle on top,
     one narrow closed shape, color brown #8a5a33. No other stripes.
  3. Drum: exactly one, a rectangle a little wider than tall with rounded corners, cut by exactly
     two bold straight rim lines from edge to edge into three bands: top rim yellow #f7cf46,
     middle red #d8433b, bottom rim yellow #f7cf46. Inside the middle band exactly one floating
     bold zigzag line of exactly three V shapes. No sticks.
  The three toys are about the same height, each about a third of the board's width, and stand
  clear of the board's ends.
- Kite: exactly one, leaning against the right end of the shelf, standing on the white paper
  outside the shelf: a diamond, taller than wide, tilted a little to the left so that its left
  corner rests against the right end of the board, touching the board's outline at that one
  point, and its bottom corner is level with the bottom of the legs. Inside it exactly one
  cross: two bold straight lines from corner to corner, reaching the outline at both ends, so
  the diamond is cut into exactly four triangles. Colors: top left triangle red #d8433b, top
  right yellow #f7cf46, bottom left blue #5b8fc7, bottom right leaf green #4f9d4a. The kite has
  no tail here. It is about as tall as the shelf and its toys together.
- Every part is one single closed outline of its own, and every shared edge is drawn once. Apart
  from the toys standing on the board and the kite's one corner resting on the board's end,
  nothing touches anything.
The whole scene fills about 80% of the image width.
Nothing else: no balloon, no yo-yo, no dominoes, no pinwheel, no puzzle piece, no books, no
letters on the blocks, no drumsticks, no kite tail, no wall, no floor, no shadow. About eighteen
lines in total. Count: three toys on the shelf, two legs, one kite with four triangles.
```

## What to send back

The PNGs you like (any number per lesson), named `<lesson-id>-<model>.png`. Flat color and an even
dark line are what make them traceable; if a model keeps adding shine spots, gradients or faces
despite the style prompt, that model is the wrong one for the course, whatever it looks like.
