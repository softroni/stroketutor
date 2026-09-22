# Rooms — image-generation prompts

Source art for the ten `rooms` lessons (Advanced level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. Every picture on this path is in perspective, so
  the reference line says that the view changes. Once `corridor` is kept, attach it as a second
  picture to `window-seat` and `my-room`: it fixes what a room box looks like.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/rooms/<lesson-id>-<model>.png`, and record model, date and
  prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph**, and here it adds that far-away lines are as
  bold as near ones: image models thin lines out with distance, and hairlines trace in pieces.
- **Every picture shows its vanishing point** as a small solid dot (the bed shows two, on a horizon
  line; the tiled floor has a short horizon through its dot). It is what the path teaches, and the
  learner draws it first. No guide lines run from the corners to the dot. In the three room scenes
  and the open door the dot sits on a colored area, where the view really vanishes.
- **Every part has its own dark outline**: every wall, door, tread, book and tile is a closed shape;
  nothing is told apart by color alone. The two patches of light (`open-door`, `window-seat`) have
  bold outlines like everything else, and are a flat lighter color: yellow on the floor, pink on
  the red cushion.
- **No shading anywhere.** Faces of one box get different colors (front, side, top), which is how a
  flat picture says "box"; no face is a darker tone of another.
- **Parts touch only along a shared edge drawn once** (a tread on a riser, a door on the floor line,
  a headboard on the bed's top). Windows, cupboard doors, the sink, the pillow, the knob and the
  fold line float.
- **Lines divide a shape on purpose** in five lessons: the floor's grid, the bookcase's two shelf
  lines, the blanket's two lines, the corner lines of the three room boxes, and the band of light.
- **Overlap only where the objective asks for it**: the table hides most of the chair
  (`table-and-chair`), and the bed and desk stand in front of the floor and walls (`my-room`).
  Everywhere else nothing is in front of anything: the open door swings away into its own opening,
  the handrail stands in the white beside the steps, the tap rises into the white behind the
  counter.
- **Details are single bold lines**: shelf lines, handrail posts and rail, the fold line. The tap
  is a closed cane shape with an outline on both sides, never a colored tube.
- **One color scheme for the room boxes**: side walls yellow, floor gray, ceiling cream (gray in the
  bay, which has no floor); windows blue as on the Buildings path; doors brown.
- **No living things**, no lettering on book spines, no pictures on walls.

## Style prompt (`style-v2`) — identical for every path

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

## Reference line (with the published apple attached) — the same for all ten

```text
Match the attached image exactly in line color, line weight, corner rounding and flatness of
color. The view changes: this image is drawn in perspective, exactly as the description says, and
where the description calls it a scene the margins are smaller.
```

## Lesson prompts

### 1 · `tiled-floor`

Objective: Floor grid four tiles wide shrinking to one vanishing point.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands on a tiled floor and
looks along it. There is exactly one vanishing point. All upright edges stay perfectly upright; all level edges that face the viewer stay
perfectly level; every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point and a short horizon line. They are
what the lesson teaches.
SUBJECT: one patch of tiled floor, exactly four tiles wide and exactly four tiles deep, going away
toward one vanishing point, with nothing standing on it.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the middle of
  the image width, about one fifth of the way down from the top, about three line-widths across.
- Horizon: one short single bold straight level line through the dot, about 30% of the image
  width, the dot on its middle. A charcoal line with no color. It floats in the white and touches
  nothing but the dot.
- Floor outline: one closed shape with four straight sides: a long level front edge near the
  bottom of the image, about 80% of the image width; a level back edge about half as long, a
  little below the middle of the image; and two slanted side edges that both aim exactly at the
  vanishing point. The back edge stops well below the horizon: a clear white gap lies between the
  floor and the horizon line.
- Lines going away: exactly three single straight lines inside the floor, from the front edge to
  the back edge, evenly spaced along the front edge, each aiming exactly at the vanishing point.
  With the two side edges they cut the floor into four strips. They touch the front and the back
  edge on purpose and stop there: they do not run on to the dot.
- Lines across: exactly three single straight level lines inside the floor, from the left side
  edge to the right side edge, touching both on purpose. With the front and back edges they make
  four rows. The rows get thinner toward the back: the front row is the tallest, each row behind
  it clearly thinner than the one before.
- Tiles: the lines make exactly sixteen tiles, four in every row. They are colored like a
  checkerboard in two colors: the front left tile is blue #5b8fc7, the tile beside it cream
  #f6e7b8, and so on, so that no two tiles that share a side have the same color. Eight blue,
  eight cream.
The floor, the dot and the horizon line together fill about 70% of the image. Everything outside
the floor stays plain white paper.
Nothing else: no walls, no skirting board, no furniture, no guide lines from the floor to the
dot, no dashed lines, no tile pattern, no gaps or grout drawn as double lines, no shine, no
shadow. Eleven lines and one dot in total. Count: four tiles across, four rows, sixteen tiles.
```

### 2 · `open-door`

Objective: Door frame with the door swung open and a patch of light on the floor.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands in front of a doorway
and looks straight through it. The door frame faces the viewer flat. There is exactly one
vanishing point, in the middle of the doorway. All upright edges stay perfectly upright; all level edges that face the viewer stay
perfectly level; every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point, and it does show one patch of
light on the floor, with its own bold outline. They are what the lesson teaches.
SUBJECT: one door frame seen straight on, its door swung open into the room behind it, and one
patch of light lying on the floor in front of the doorway. No wall is drawn around the frame.
- Frame: one closed shape like a squared upside-down U: two upright posts joined by a level beam
  across the top, the same width all the way, about five line-widths. The two posts stand on one
  level: their flat feet are level with each other. Color: brown #8a5a33.
- Opening: the upright rectangle inside the frame, about twice as tall as it is wide. Its left,
  top and right edges are the frame's inner edges (shared lines, drawn once); its bottom edge, the
  threshold, is one level line joining the inner corners of the two feet. Color of everything
  seen through the opening that is not the door: cream #f6e7b8.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the middle of
  the opening's width, a little above the middle of its height, about three line-widths across.
  It floats on the cream and touches nothing.
- Door: one closed shape with four straight sides, inside the opening, swung away from the
  viewer on hinges on the LEFT. Its left edge is the opening's whole left edge (shared line, drawn
  once). Its right edge is a shorter upright line, about one third of the way across the opening,
  well to the left of the dot. Its top edge slants down from the opening's top left corner and
  its bottom edge slants up from the opening's bottom left corner, and both aim exactly at the
  vanishing point. Color: orange #f08a2c.
- Knob: exactly one small circle floating on the door near its right edge, halfway up, touching
  nothing. Color: yellow #f7cf46.
- Patch of light: one closed shape with four straight sides lying on the floor in front of the
  doorway, below the threshold. Its top edge is the threshold (shared line, drawn once). Its two
  side edges start at the two ends of the threshold and spread apart as they come down toward the
  viewer, each one in line with the vanishing point, as if it had come from the dot. Its bottom
  edge is level, about as long as the whole frame is wide, and about a quarter of the opening's
  height below the threshold. It has the same bold dark outline as everything else. Color:
  yellow #f7cf46.
The frame and the patch of light together fill about 75% of the image height. The wall around
the frame and the floor around the patch stay plain white paper.
Nothing else: no wall color, no floor line, no hinges, no keyhole, no door panels, no window in
the door, no doormat, no shadow, no rays of light, no guide lines, no dashed lines, nothing seen
in the room behind. About sixteen lines and one dot in total. Count: one door, one knob, one
patch of light.
```

### 3 · `staircase`

Objective: Six steps climbing in one-point perspective with a handrail.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands at the foot of a
straight staircase and looks up it: the steps climb away from the viewer. There is exactly one
vanishing point, above the top step. All upright edges stay perfectly upright; all level edges that face the viewer stay
perfectly level; every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point. It is what the lesson teaches.
SUBJECT: one straight staircase of exactly six steps seen from the front, climbing away from the
viewer, with one handrail on its right side. No walls.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the middle of
  the image width, near the top of the image, about three line-widths across. It floats in the
  white above the staircase and touches nothing.
- Risers: exactly six. A riser is the upright front of a step: a level rectangle facing the
  viewer, much wider than it is tall. The first riser is at the bottom of the image, about 60% of
  the image width. Each riser above it is a little narrower and a little less tall than the one
  below, and all six are centered under the dot. Color: orange #f08a2c.
- Treads: exactly six. A tread is the flat top of a step, seen from above: a closed shape with
  four straight sides between one riser and the next. Its front edge is the top edge of the riser
  below it and its back edge is the bottom edge of the riser above it (shared lines, drawn once);
  its two short side edges aim exactly at the vanishing point. Each tread is less tall than the
  riser under it. The sixth tread is the landing at the top: its back edge is one level line with
  nothing above it. Color: cream #f6e7b8.
  From the bottom up the staircase reads: riser, tread, riser, tread, and so on, twelve colored
  areas in one stack, narrowing toward the dot. The top of the landing stays well below the dot,
  with a clear white gap between them.
- Handrail: exactly three single bold lines with no color, on the RIGHT side only. A lower post:
  one upright line rising from the top right corner of the first riser, about as tall as two
  risers. An upper post: one upright line rising from the top right corner of the sixth riser,
  clearly shorter. A rail: one straight line joining the tops of the two posts. The posts and the
  rail stand in the white beside the steps: they cross no line and cover no color.
The staircase, the handrail and the dot together fill about 75% of the image height. Everything
outside the steps stays plain white paper.
Nothing else: no side walls, no stringer boards, no carpet, no tread noses or overhangs, no extra
posts or balusters, no second handrail, no door at the top, no shadow, no guide lines, no dashed
lines. About forty lines and one dot in total. Count the steps: six risers, six treads.
```

### 4 · `bookshelf`

Objective: Three shelves in perspective with books standing and leaning.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in one-point perspective. The bookcase is a box whose front faces
the viewer flat. The viewer is a little to the right of it and above it, so its right side and
its top also show, going away toward exactly one vanishing point up and to the right.
All upright edges stay perfectly upright; all level edges that face the viewer stay
perfectly level; every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point. It is what the lesson teaches.
SUBJECT: one bookcase with exactly three shelves holding exactly eight books, some standing and
some leaning.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the white up
  and to the right of the bookcase, about three line-widths across, touching nothing.
- Front: one upright rectangle, about one and a half times as tall as it is wide, in the lower
  left of the image. Inside it a second rectangle, leaving an even band about five line-widths
  wide all around. The band is the wood of the case. Color of the band: brown #8a5a33.
- Shelf lines: exactly two single bold level lines across the inner rectangle, touching its left
  and right sides on purpose, cutting it into three equal compartments one above another. The
  books stand on these two lines and on the inner rectangle's bottom edge: three shelves.
  Color of the three compartments behind the books: cream #f6e7b8.
- Right side: one closed shape with four straight sides: the front's right edge (shared line), a
  shorter upright far edge to the right of it, and a top and a bottom edge that both aim exactly
  at the vanishing point. It is narrow: about a quarter as wide as the front. Color: orange
  #f08a2c.
- Top: one closed shape with four straight sides: the front's top edge (shared line), the right
  side's top edge (shared line), a left edge that aims exactly at the vanishing point, and a
  level back edge joining them. Color: yellow #f7cf46.
- Standing books: an upright rectangle standing on its shelf, whose bottom edge is the shelf
  (shared line). Standing books that are side by side share the side between them: one line,
  drawn once. They have different heights, and none reaches the top of its compartment.
- Leaning books: a rectangle of the same kind, tilted. Only one bottom corner stands on the
  shelf and only one top corner touches the side of the standing book it leans on, like a ladder
  against a wall; a small cream triangle shows between them.
- Top shelf, from the left: two standing books, red #d8433b and then blue #5b8fc7, and one
  purple #7b4fa3 book leaning to the left onto the blue one.
- Middle shelf, from the right: two standing books, blue #5b8fc7 at the far right and then
  watermelon pink #ee5a6a, and one leaf green #4f9d4a book leaning to the right onto the pink one.
- Bottom shelf: two standing books in the middle, dark green #2f6b3a and red #d8433b.
  On every shelf a clear strip of cream lies between the books and the two sides of the
  compartment, and above the books.
The bookcase and the dot together fill about 75% of the image.
Nothing else: no book titles, no bands or lines on the book spines, no books lying flat, no
ornaments, no feet under the case, no back legs, no inside walls of the compartments, no shadow,
no guide lines, no dashed lines. About thirty-eight lines and one dot in total. Count: three
shelves, eight books, two of them leaning.
```

### 5 · `table-and-chair`

Objective: Table with a chair tucked under it, both from the same vanishing point.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands in front of a table and
looks down on it a little. A chair is pushed in under the far side of the table, facing the
viewer. There is exactly one vanishing point, above the table, and the table and the chair both
use it. All upright edges stay perfectly upright; all level edges that face the viewer stay
perfectly level; every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point. It is what the lesson teaches.
Here the table does hide part of the chair: that is what "tucked under" means.
SUBJECT: one table with four legs and, tucked under its far side, one chair. Of the chair only
three parts show: its backrest above the table, and its seat and two front legs under the table.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the middle of
  the image width, near the top of the image, about three line-widths across. It floats in the
  white and touches nothing.
- Table top: one closed shape with four straight sides, seen from above: a level front edge a
  little above the middle of the image height, about 75% of the image width; a shorter level back
  edge above it; two slanted side edges that both aim exactly at the vanishing point.
  Color: yellow #f7cf46.
- Table edge: one long thin level rectangle hanging under the table top's front edge (shared
  line), exactly as wide as the front edge, about four line-widths tall. Color: orange #f08a2c.
- Front table legs: exactly two upright narrow rectangles, about four line-widths wide, hanging
  from the two ends of the table edge's bottom line (shared line) down to near the bottom of the
  image. Color: brown #8a5a33.
- Back table legs: exactly two more upright narrow rectangles hanging from the table edge's
  bottom line, set in from the front legs toward the middle, a little narrower, and only about
  half as long, because they are farther away. Color: brown #8a5a33.
- Chair backrest: one closed shape with upright sides and a level top, standing on the middle of
  the table top's back edge (shared line: the table hides everything below it). It is about a
  quarter as wide as the table's front edge and about as tall as it is wide, and it stays well
  below the dot. Color: blue #5b8fc7.
- Chair seat: one closed shape with four straight sides hanging under the middle of the table
  edge's bottom line (shared line), between the two back table legs with a clear white gap on
  each side: a level front edge lower down and a little wider than its top, and two short slanted
  side edges that both aim exactly at the vanishing point. Color: blue #5b8fc7.
- Chair legs: exactly two upright narrow rectangles hanging from the two ends of the seat's
  front edge (shared line), ending a little lower than the back table legs. Color: purple #7b4fa3.
Under the table everything between the legs stays plain white paper. No two legs touch.
The table, the chair and the dot together fill about 75% of the image.
Nothing else: no floor line, no rug, no tablecloth, no things on the table, no chair back legs,
no slats or rungs, no cushion, no drawer, no shadow, no guide lines, no dashed lines. About
thirty-one lines and one dot in total. Count: four table legs, two chair legs, one backrest.
```

### 6 · `bed`

Objective: Bed in two-point perspective with a pillow and a folded blanket.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in two-point perspective. The bed is a low box seen from its near
corner and from above, so three faces show: its top, its long side going away to the left, and
its foot end going away to the right. All upright edges stay perfectly upright. Every other
straight edge of the bed aims at one of two vanishing points.
EXCEPTION TO THE STYLE: this image does show a horizon line and two vanishing points. They are
what the lesson teaches.
SUBJECT: one simple box bed with a headboard, exactly one pillow and exactly one folded blanket,
below a horizon line with two vanishing points.
- Horizon: one single bold straight level line across the image, about one fifth of the way down
  from the top, from 6% to 94% of the image width. A charcoal line with no color. The whole bed
  lies below it and never touches it: a clear white gap stays between them.
- Vanishing points: exactly two small solid round dots in the charcoal line color, one on each
  end of the horizon line, each about three line-widths across.
- Near corner: one short upright edge where the long side and the foot end meet, a little to the
  right of the image's middle, in the lower part of the image.
- Long side: one closed shape with four straight sides going away to the left: the near corner,
  a shorter upright far edge, and a top and a bottom edge that both aim at the LEFT vanishing
  point. It is about four times as long as the near corner is tall. Color: brown #8a5a33.
- Foot end: one closed shape with four straight sides going away to the right: the near corner
  (shared with the long side, one line drawn once), a shorter upright far edge, and a top and a
  bottom edge that both aim at the RIGHT vanishing point. It is about twice as long as the near
  corner is tall. Color: orange #f08a2c.
- Top: one closed shape with four straight sides: the long side's top edge and the foot end's
  top edge (shared lines), a far right edge that aims at the LEFT vanishing point, and a far left
  edge that aims at the RIGHT vanishing point. Color: blue #5b8fc7.
- Headboard: one closed shape with four straight sides standing on the top's far left edge
  (shared line): two upright sides about as tall as the near corner, and a top edge that aims at
  the RIGHT vanishing point. Color: orange #f08a2c.
- Blanket: a band across the foot of the bed. Exactly two single straight lines across the top,
  both aiming at the RIGHT vanishing point, each running from the long side's top edge to the
  top's far right edge and touching both on purpose. The first is about one tenth of the way
  along the bed from the foot end, the second about four tenths. The band between them is the
  folded blanket. Color of the band: red #d8433b. The top stays blue on both sides of it.
- Fold line: exactly one single straight line floating along the middle of the red band, aiming
  at the RIGHT vanishing point, stopping short of both of the band's ends and touching nothing.
- Pillow: exactly one soft four-sided shape with rounded corners lying on the top near the
  headboard, its sides following the bed's edges. It floats: a clear strip of blue, at least four
  line-widths wide, lies between it and the headboard, the blanket and the top's edges.
  Color: cream #f6e7b8.
The bed is about 70% of the image width; with the horizon line the picture is about 88% wide.
The floor and the wall stay plain white paper.
Nothing else: no bed legs, no mattress line, no second pillow, no pattern on the blanket, no
blanket hanging over the side, no wrinkles, no rug, no guide lines from the corners to the dots,
no dashed lines, no shadow, no labels or letters. About eighteen lines and two dots in total.
Count: one pillow, one blanket band, one fold line.
```

### 7 · `corridor`

Objective: Hallway with three doors on each side shrinking to the far end.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands in the middle of a
straight hallway and looks along it to the wall at its far end. There is exactly one vanishing
point, in the middle of the image. All upright edges stay perfectly upright; all level edges that face the viewer stay
perfectly level; every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point. It is what the lesson teaches.
This image is a scene, not one subject: it is a square picture of the inside of the hallway, and
the scene's own outer edge is a bold outline.
SUBJECT: the inside of a straight hallway with exactly three doors along its left wall and
exactly three doors along its right wall.
- Outer frame: one large square with straight sides, about 84% of the image width, centered. It
  is the near end of the hallway. Everything else is inside it.
- Far wall: one small upright rectangle in the very middle of the frame, about a quarter as wide
  and a quarter as tall as the frame. Color: orange #f08a2c.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the very
  middle of the far wall, about three line-widths across. It floats on the orange and touches
  nothing.
- Corner lines: exactly four single straight lines, one from each corner of the outer frame to
  the matching corner of the far wall, touching both on purpose. Each aims exactly at the
  vanishing point. They cut the space between the frame and the far wall into four areas.
- Floor: the area at the bottom. Color: gray #c9ced6.
- Ceiling: the area at the top. Color: cream #f6e7b8.
- Left wall and right wall: the two areas at the sides. Color of both: yellow #f7cf46.
- Doors: exactly six, three on the left wall and three on the right wall, the right wall a
  mirror of the left. Each door is one closed shape with four straight sides: two upright sides,
  a bottom edge that lies on the wall's bottom corner line (shared line, drawn once), and a top
  edge that aims exactly at the vanishing point. The doors are all the same real size, so they
  shrink toward the far end: on each wall the nearest door is the tallest and widest, the middle
  one smaller, the farthest the smallest. A clear strip of yellow wall, at least four line-widths
  wide, lies between one door and the next, between the nearest door and the outer frame, between
  the farthest door and the far wall, and above every door. Color of all six: brown #8a5a33.
The scene fills about 84% of the image, with clear white margin on all four sides.
Nothing else: no doorknobs, no door frames or panels, no door on the far wall, no window, no
lamps, no skirting boards, no floor boards or tiles, no carpet, no pictures on the walls, no
people, no shadow, no guide lines, no dashed lines, no lettering. Thirty lines and one dot in
total. Count: three doors on the left, three on the right.
```

### 8 · `kitchen-counter`

Objective: Counter with a sink, a tap and two cupboard doors in perspective.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands in front of a kitchen
counter and looks down on it a little: its front faces the viewer flat and its top goes away
toward exactly one vanishing point, above its middle. All upright edges stay perfectly upright; all level edges that face the viewer stay
perfectly level; every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point. It is what the lesson teaches.
SUBJECT: one kitchen counter with exactly one sink in its top, exactly one tap behind the sink
and exactly two cupboard doors on its front. No wall behind it.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the middle of
  the image width, near the top of the image, about three line-widths across. It floats in the
  white and touches nothing.
- Front: one level rectangle in the lower half of the image, about 76% of the image width and
  about half as tall as it is wide. Color: leaf green #4f9d4a.
- Cupboard doors: exactly two upright rectangles of the same size side by side on the front, one
  in its left half and one in its right half. Each door floats: a clear strip of leaf green, at
  least four line-widths wide, lies between it and the front's outline and between the two doors.
  Color of both: pale green #b9dc8a.
- Top: one closed shape with four straight sides, seen from above: the front's top edge (shared
  line, drawn once), a shorter level back edge above it, and two slanted side edges that both aim
  exactly at the vanishing point. It is about a third as tall as the front. Color: cream #f6e7b8.
- Sink: one closed shape with four straight sides floating in the middle of the top: a level
  front edge, a shorter level back edge, and two slanted side edges that both aim exactly at the
  vanishing point. It is about a third as wide as the top, with a clear strip of cream all around
  it. Color: gray #c9ced6.
- Tap: one closed shape like a walking cane with an even width of about four line-widths: an
  upright post standing on the middle of the top's back edge (its flat foot lies on that edge),
  rising into the white above the counter, curving over to the RIGHT in one smooth half circle
  and ending in a short flat mouth that points down. The mouth stops high above the counter, with
  a clear white gap under it. The tap touches nothing but the back edge, and stays well below the
  dot. It has a bold dark outline on both sides, never a single colored stroke. Color: gray
  #c9ced6.
The counter, the tap and the dot together fill about 75% of the image. The wall behind and the
floor stay plain white paper.
Nothing else: no handles or knobs on the doors, no tap handles, no drain, no plug, no water, no
drops, no dishes, no tiles, no wall, no window, no drawers, no plinth or feet under the counter,
no shadow, no guide lines, no dashed lines. About twenty-two lines and one dot in total. Count:
one sink, one tap, two doors.
```

### 9 · `window-seat`

Objective: Bay window with a cushioned seat and light falling across it.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands in a room and looks
straight into a square bay: a small box-shaped nook with a window in each of its three walls and
a seat across its whole floor. There is exactly one vanishing point, in the middle of the middle
window. All upright edges stay perfectly upright; all level edges that face the viewer stay
perfectly level; every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point, and it does show one band of
light across the cushion, drawn with bold outlines. They are what the lesson teaches. This image
is a scene: the bay's own outer edge is a bold outline.
SUBJECT: a square bay window with exactly three windows, a cushioned seat, and one band of light
falling across the cushion.
- Bay opening: three straight lines, like a squared upside-down U, about 80% of the image width:
  a left upright, a level top and a right upright. The two uprights end on the seat's front edge.
- Seat front: one long level rectangle closing the bottom of the opening, exactly as wide as the
  opening and about a quarter as tall as the opening. Its top edge is the cushion's front edge.
  Color: brown #8a5a33.
- Back wall: one upright rectangle inside the opening, about half as wide as the opening, its
  middle a little above the middle of the opening. Color: cream #f6e7b8.
- Corner lines: exactly four single straight lines: one from each top corner of the opening to
  the matching top corner of the back wall, and one from each end of the seat front's top edge to
  the matching bottom corner of the back wall. Each touches both corners on purpose and aims
  exactly at the vanishing point. They make four areas around the back wall.
- Ceiling: the area at the top. Color: gray #c9ced6.
- Left wall and right wall: the two areas at the sides. Color of both: yellow #f7cf46.
- Cushion: the area at the bottom, the top of the seat, between the seat front's top edge and the
  back wall's bottom edge. Color: red #d8433b.
- Middle window: one upright rectangle floating in the middle of the back wall, with a clear
  strip of cream all around it. Color: blue #5b8fc7.
- Side windows: exactly two, one floating in the left wall and one in the right wall, the right a
  mirror of the left. Each is one closed shape with four straight sides: two upright sides, and a
  top and a bottom edge that both aim exactly at the vanishing point. A clear strip of yellow, at
  least four line-widths wide, lies all around each. Color: blue #5b8fc7.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the very
  middle of the middle window, about three line-widths across. It floats on the blue and touches
  nothing.
- Band of light: exactly two single straight lines across the cushion, side by side, each running
  from the cushion's back edge down to its front edge and touching both on purpose. Both lean the
  same way, their lower ends clearly farther LEFT than their upper ends, as light from the right
  window would fall. They do not aim at the vanishing point. The band between them is the light.
  Color of the band: watermelon pink #ee5a6a. The cushion stays red on both sides of it.
The scene fills about 82% of the image, with clear white margin on all four sides.
Nothing else: no window bars or panes, no curtains, no view outside, no pillows, no buttons or
seams on the cushion, no books, no plants, no rays of light in the air, no shadow, no light on
the walls, no guide lines, no dashed lines. About twenty-nine lines and one dot in total. Count:
three windows, one band of light.
```

### 10 · `my-room`

Objective: Bed, desk and window in one room in one-point perspective.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines, no thinner lines for far-away things: a line at the back is exactly as bold as a line
at the front. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands at the open end of a
bedroom and looks straight at its back wall. There is exactly one vanishing point, in the middle
of the image. All upright edges stay perfectly upright; all level edges that face the viewer stay
perfectly level; every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point. It is what the lesson teaches.
This image is a scene, not one subject: the room's own outer edge is a bold outline. Here the bed
and the desk do stand in front of the floor and the walls and hide the part of them that is
behind: that is what a room is.
SUBJECT: the inside of a bedroom with exactly one window on the back wall, exactly one bed along
the left wall and exactly one desk along the right wall.
- Outer frame: one large square with straight sides, about 86% of the image width, centered. It
  is the open near end of the room. Everything else is inside it.
- Back wall: one level rectangle in the very middle of the frame, about 40% as wide and 36% as
  tall as the frame. Color: pale green #b9dc8a.
- Corner lines: four straight lines, one from each corner of the outer frame to the matching
  corner of the back wall, each aiming exactly at the vanishing point. They make the floor
  (bottom), the ceiling (top) and the left and right walls. The two lower ones are partly hidden
  by the bed and the desk and show again behind them.
  Colors: floor gray #c9ced6, ceiling cream #f6e7b8, both side walls yellow #f7cf46.
- Window: exactly one level rectangle floating in the middle of the back wall, about half as
  wide as the back wall, with a clear strip of pale green all around it. Color: blue #5b8fc7.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the very
  middle of the window, about three line-widths across. It floats on the blue and touches
  nothing.
- Bed: a low box standing on the floor against the left wall, its foot end toward the viewer,
  made of exactly three closed shapes with straight sides:
  1. foot end: one level rectangle facing the viewer flat, wider than tall, standing on the floor
     near the front left with a strip of gray floor in front of it; its left edge is where the
     bed meets the left wall. Color: orange #f08a2c.
  2. top: from the foot end's top edge (shared line) two side edges go away, both aiming exactly
     at the vanishing point, to a shorter level back edge. It stops well before the back wall.
     Color: blue #5b8fc7.
  3. right side: from the foot end's right edge (shared line) a bottom edge goes away along the
     floor, aiming exactly at the vanishing point, to a short upright far edge that rises to the
     top's back right corner. Its top edge is the top's right edge (shared line).
     Color: brown #8a5a33.
- Pillow: exactly one soft four-sided shape with rounded corners floating on the far end of the
  bed's top, with a clear strip of blue all around it. Color: cream #f6e7b8.
- Desk: a box of the same kind standing on the floor against the right wall, clearly taller than
  the bed and only about half as long, made of exactly three closed shapes with straight sides:
  1. front: one upright rectangle facing the viewer flat, standing on the floor near the front
     right with a strip of gray floor in front of it; its right edge is where the desk meets the
     right wall. Color: red #d8433b.
  2. top: from the front's top edge (shared line) two side edges go away, both aiming exactly at
     the vanishing point, to a shorter level back edge. The desk's top lies below the vanishing
     point, so it is seen from above. Color: watermelon pink #ee5a6a.
  3. left side: from the front's left edge (shared line) a bottom edge goes away along the floor,
     aiming exactly at the vanishing point, to a short upright far edge that rises to the top's
     back left corner. Color: purple #7b4fa3.
  A wide stretch of gray floor lies between the bed and the desk. They do not touch each other,
  the back wall or the outer frame.
The scene fills about 86% of the image, with clear white margin on all four sides.
Nothing else: no blanket, no headboard, no bed legs, no chair, no lamp, no drawers, no things on
the desk, no window bars or curtains, no view outside, no door, no rug, no floor boards, no
pictures or posters, no shelves, no toys, no shadow, no guide lines, no dashed lines, no
lettering. About thirty-seven lines and one dot in total. Count: one window, one bed, one pillow,
one desk.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps thinning the far lines, adding guide lines to the dot,
floor boards, door panels, window bars, shadows or gradients on the walls despite the prompts,
regenerate rather than keep it.
