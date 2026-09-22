# Buildings — image-generation prompts

Source art for the ten `buildings` lessons (Core level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. Once `house` is kept, attach it as a second
  picture to the later requests too: it fixes what a wall, a door and a window look like.
  The two perspective lessons (`house-in-two-point-perspective`, `city-street`) have their own
  reference line, because there the view does change.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/buildings/<lesson-id>-<model>.png`, and record model,
  date and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Lessons 1 to 8 are flat front views**, so the path reads as one family and the two perspective
  lessons at the end are the only new idea.
- **No ground.** The style prompt forbids a ground line, so every building stands on its own flat
  bottom edge on plain white paper. Doors and gates share that bottom edge. The tent's pegs stand in
  the white beside it, their feet level with its bottom edge.
- **Every part has its own dark outline**: doors, windows, the lamp room, the gallery, each roof and
  each blade are closed shapes; nothing is told apart by color alone.
- **Parts touch only where one is built on another**, and then along a shared straight edge drawn
  once (roof on walls, tower beside wall, lamp room on gallery, tier on roof). Windows, the barn's
  loft door, block lines, plank lines and rays float and touch nothing.
- **The only overlap on the path is the windmill's blades**, which have to pass in front of the cap
  and the top of the tower. Its prompt keeps the tower narrow and the blades on the diagonals so
  that as little as possible is hidden.
- **Lines divide a shape in one lesson**, touching its outline on purpose: the lighthouse's four
  band lines. The barn's two doors are two closed shapes that share their middle edge.
- **Dark insides are purple, never charcoal**: the tent's opening, the igloo's entrance and the
  castle's gate. A solid dark shape swallows its own outline when traced.
- **Windows are blue everywhere** (except the pagoda's small yellow ones against red), so no
  building is blue. The igloo is gray, because nothing inside a subject may be white.
- **Battlements and upturned roof corners are asked for by name**, with counts, because the style
  prompt otherwise forbids notches.
- **The two perspective pictures show their vanishing points** as small solid dots, and a horizon
  line: an exception to the style prompt, said in the prompt. They are what the lesson teaches, and
  the learner draws them first. No guide lines run from the corners to the dots.
- **No living things**: no people in the street, no animals at the barn, no birds, no flags with
  figures. No signs, numbers or lettering on any building.

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

For `house-in-two-point-perspective` and `city-street` only:

```text
Match the attached image exactly in line color, line weight, corner rounding and flatness of
color. The view changes: this image is drawn in perspective, exactly as the description says, and
it is wider than one subject, so the margins are smaller.
```

## Lesson prompts

### 1 · `house`

Objective: Square body, triangle roof, door and two windows.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective: no side wall, no roof surface seen
from above, nothing of the ground.
NO GROUND: the house stands on its own flat bottom edge on plain white paper. No ground line, no
grass, no path.
SUBJECT: one simple house: a square body, a triangle roof, exactly one door and exactly two windows.
- Body: one square with straight sides, as wide as it is tall. Color: yellow #f7cf46.
- Roof: one triangle sitting on the body, its peak above the middle of the body, about half as
  tall as the body. Its level bottom edge lies on the body's top edge and sticks out a little past
  the body on each side: where they meet they are one shared line, drawn once.
  Color: red #d8433b.
- Door: exactly one upright rectangle in the middle of the body's bottom, about a quarter as wide
  as the body and half as tall. Its bottom edge is part of the body's bottom edge: one shared line.
  Its other three sides stand inside the body. Color: brown #8a5a33.
- Windows: exactly two squares of the same size, one to the left and one to the right of the door,
  in the upper half of the body, level with each other. Each window floats: a clear strip of
  yellow, at least four line-widths wide, lies between it and the body's outline, the roof and the
  door. Color: blue #5b8fc7.
The whole house fills about 70% of the image.
Nothing else: no chimney, no smoke, no doorknob, no window panes or crosses, no curtains, no
steps, no fence, no bushes, no sun. Five lines in total. Count: one door, two windows.
```

### 2 · `tent`

Objective: Triangle tent with an open flap and pegs.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective: nothing of the tent's side or of the
ground shows.
NO GROUND: the tent stands on its own flat bottom edge on plain white paper. No ground line, no grass.
SUBJECT: one triangle camping tent with its entrance open, one flap folded back, and exactly two
ropes with exactly two pegs.
- Tent: one large triangle with three straight sides, a little wider than it is tall, its peak
  above the middle of its level bottom edge. Color: orange #f08a2c.
- Opening: one tall narrow triangle in the middle of the tent. Its bottom side is part of the
  tent's bottom edge (one shared line), about a quarter as long as that edge; its point is
  straight above, two thirds of the way up the tent, well below the tent's peak.
  Color: purple #7b4fa3.
- Flap: exactly one folded-back flap, on the right of the opening: one narrow triangle. One of its
  sides is the opening's right side (one shared line, drawn once); its bottom side runs along the
  tent's bottom edge to the right, as long as the opening is wide; its third side is a straight
  line from the opening's point down to the right end of that bottom side. The flap stays well
  inside the tent. Color: yellow #f7cf46.
- Ropes: exactly two single bold straight lines, one on each side, the same charcoal line as the
  outlines, with no color: not cords, not tubes. Each starts on the tent's slanted side, one
  third of the way down from the peak, and runs outward and down to the top of a peg.
- Pegs: exactly two short single bold straight lines, one on each side, standing in the white
  well outside the tent's bottom corners. Each leans away from the tent, is about as long as a
  tenth of the tent's height, and has its foot level with the tent's bottom edge. The rope ends
  exactly at the peg's top end: the two lines meet in a point, like an upside-down V. A clear gap
  of white, at least five line-widths, lies between each peg and the tent's corner.
The whole tent with its ropes fills about 72% of the image width.
Nothing else: no seam line, no poles sticking out of the peak, no zipper, no stitching, no
window, no campfire, no trees, no ground. Seven lines in total. Count: one flap, two ropes, two pegs.
```

### 3 · `igloo`

Objective: Dome with a curved entrance and block lines.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the entrance facing the viewer. No perspective: no
tunnel sticking out, nothing of the ground.
NO GROUND: the igloo stands on its own flat bottom edge on plain white paper. No ground line, no
snow, no snowflakes.
SUBJECT: one igloo: a dome, an arched entrance and exactly eight block lines.
- Dome: one half circle with a straight, level bottom edge, twice as wide as it is tall.
  Color: gray #c9ced6.
- Entrance rim: one arch (an upside-down U with a level bottom) in the middle of the dome's
  bottom, about a third as wide as the dome and 40% as tall. Its bottom edge is part of the dome's
  bottom edge: one shared line. Color: blue #5b8fc7.
- Entrance opening: one smaller arch of the same shape inside the rim, standing on the same bottom
  edge, leaving an even band of blue, about four line-widths wide, up one side, over the top and
  down the other. Color: purple #7b4fa3.
- Row lines: exactly two single bold straight level lines across the dome, one at half the dome's
  height (clear above the entrance rim) and one at three quarters of its height. Each stops a
  little short of the dome's outline at both ends and touches nothing.
- Block lines: exactly six short single bold upright lines. Two in the bottom row, one on each
  side of the entrance, halfway between the rim and the dome's outline; three in the middle row,
  evenly spaced; one in the top row, in the middle. Each stops a little short of the row lines and
  the outlines above and below it, and touches nothing. The uprights of one row never stand
  directly above those of the row below.
The whole igloo fills about 65% of the image width.
Nothing else: no ice texture, no cracks, no shine, no smoke hole, no flag, no snow, no fishing
hole, no animals. Eleven lines in total. Count: two row lines, six block lines.
```

### 4 · `barn`

Objective: Wide barn with a gambrel roof and crossed doors.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view of the barn's end wall, seen straight on. No perspective: no side wall,
no roof surface, nothing of the ground.
NO GROUND: the barn stands on its own flat bottom edge on plain white paper. No ground line, no
grass, no hay.
SUBJECT: one wide barn: a wide body, a gambrel roof (the barn roof with two slopes on each side),
a pair of doors with a cross on each, and one small loft door.
- Body: one wide rectangle with straight sides, about twice as wide as it is tall.
  Color: red #d8433b.
- Roof: one closed shape with five straight sides sitting on the body. A level bottom edge that
  lies on the body's top edge and sticks out a little past it on each side (one shared line, drawn
  once); from each end of it a steep side rising and leaning inward, to about 60% of the roof's
  height; then from each of those a gentle, flatter side rising to meet the other at a peak above
  the middle. The roof is about as tall as the body. Color: brown #8a5a33.
- Doors: exactly two upright rectangles of the same size, side by side in the middle of the body's
  bottom, sharing their middle upright edge (one shared line, drawn once). Together they make a
  square about 40% as wide as the body. Their bottom edges are part of the body's bottom edge.
  Color: cream #f6e7b8.
- Crosses: on each door exactly two single bold straight diagonal lines crossing each other in
  the middle of the door like a letter X. Each line starts and ends a little inside the door's
  corners and touches no outline. Four diagonal lines in all.
- Loft door: exactly one small square floating in the middle of the roof shape, below the peak,
  with a clear strip of brown all around it. Color: cream #f6e7b8.
The whole barn fills about 72% of the image width.
Nothing else: no windows, no boards or plank lines, no roof trim, no weather vane, no silo, no
fence, no hay bales, no animals, no tractor. Nine lines in total. Count: two doors, one X on each.
```

### 5 · `windmill`

Objective: Tower with four crossed blades and a small door.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the blades facing the viewer. No perspective.
NO GROUND: the windmill stands on its own flat bottom edge on plain white paper. No ground line,
no grass, no hill.
SUBJECT: one old windmill: a narrow tower, a cap, exactly four blades crossed like a letter X, one
small door and one round window.
- Tower: one tall closed shape with four straight sides, narrow at its flat top and about twice as
  wide at its flat foot, about three times as tall as its foot is wide. Color: cream #f6e7b8.
- Cap: one small half-round dome sitting on the tower's top, a little wider than the top. Its
  level bottom edge and the tower's top edge are one shared line. Color: red #d8433b.
- Hub: one small complete circle in the middle of the cap. Color: brown #8a5a33.
- Blades: exactly four long narrow rectangles of the same size with plain straight sides, each
  about as long as half the tower's height and about one sixth as wide as it is long. They stand
  out from the hub on the four diagonals, like a letter X: up-left, up-right, down-left and
  down-right, evenly spaced. One short end of each blade touches the hub's circle; the blades do
  not touch each other. The two lower blades pass in front of the cap and the top corners of the
  tower and hide what is behind them: this is the only overlap in the image. Beyond that they
  stand out in the white, clear of the tower's sides. Color: yellow #f7cf46.
- Door: exactly one small arched door (a rectangle with a round top) in the middle of the tower's
  bottom. Its bottom edge is part of the tower's bottom edge: one shared line. About a quarter as
  wide as the tower's foot. Color: brown #8a5a33.
- Window: exactly one small complete circle floating in the tower, halfway between the door's top
  and the lower blades, touching nothing, with cream all around it. Color: blue #5b8fc7.
The whole windmill, blades included, fills about 72% of the image height.
Nothing else: no lattice, slats or lines on the blades, no spars, no balcony, no bricks, no
steps, no clouds, no birds, no tulips. Nine lines in total. Count the blades: four.
```

### 6 · `lighthouse`

Objective: Tall striped tower with a lamp room and rays.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective: the bands are straight and level, not
curved around the tower.
NO GROUND: the lighthouse stands on its own flat bottom edge on plain white paper. No rock, no
sea, no waves, no ground line.
SUBJECT: one tall lighthouse: a striped tower, a gallery, a lamp room with a roof, and exactly six
rays of light.
- Tower: one tall closed shape with four straight sides, wider at its flat foot than at its flat
  top, about four times as tall as its foot is wide. Exactly four single bold level lines cross
  it from side to side, touching both sides on purpose, and divide it into exactly five bands of
  equal height. Band colors from the top down: red #d8433b, cream #f6e7b8, red #d8433b,
  cream #f6e7b8, red #d8433b.
- Gallery: one low, flat slab lying on the tower's top, a little wider than the top on both sides
  and about two line-widths of color tall. Its bottom edge and the tower's top edge are one shared
  line. Color: gray #c9ced6.
- Lamp room: one box standing on the middle of the gallery, as wide as the tower's top and a
  little taller than wide. Its bottom edge and the gallery's top edge are one shared line.
  Color: yellow #f7cf46.
- Roof: one small triangle with a gently rounded peak sitting on the lamp room, a little wider
  than it. Its bottom edge and the lamp room's top edge are one shared line. Color: red #d8433b.
- Rays: exactly six single bold straight lines in the white beside the lamp room, three on the
  left and three on the right, fanning outward like the rays of a sun: one level, one tilted up,
  one tilted down on each side. All six are the same length, about as long as the lamp room is
  wide. Each starts a clear gap of white, at least four line-widths, away from the lamp room and
  touches nothing. Charcoal lines with no color: not beams, not yellow wedges.
The whole lighthouse fills about 75% of the image height.
Nothing else: no door, no windows, no panes in the lamp room, no railing posts, no rock, no
water, no boats, no clouds, no birds, no stars, no glow. Fourteen lines in total. Count: five
bands, six rays.
```

### 7 · `castle`

Objective: Two towers with battlements and a drawbridge.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective on the castle itself.
NO GROUND: the castle stands on its own flat bottom edge on plain white paper. No ground line, no
moat, no water, no hill.
SUBJECT: one small castle: exactly two towers with a wall between them, square battlements along
every top, an arched gate, and a lowered drawbridge.
- Towers: exactly two tall upright rectangles of the same size, one at each end, each about
  three times as tall as wide. The top edge of each tower is cut into battlements: exactly two
  square notches, leaving exactly three square teeth of equal width. The notches are part of the
  tower's one outline, with square corners. Color: gray #c9ced6.
- Wall: one wide shape between the towers, about half as tall as they are and about twice as wide
  as one tower, standing on the same level bottom. Its left and right sides are the towers'
  inner sides (shared lines, drawn once). Its top edge is cut into battlements the same way:
  exactly two square notches, leaving exactly three square teeth. Color: cream #f6e7b8.
- Gate: exactly one arched opening (a rectangle with a round top) in the middle of the wall's
  bottom, about a third as wide as the wall and half as tall. Its bottom edge is part of the
  wall's bottom edge. Color: purple #7b4fa3.
- Drawbridge: one closed shape with four straight sides hanging below the gate, lying flat toward
  the viewer: its level top edge is the gate's bottom edge (one shared line, drawn once), its
  level bottom edge is one and a half times as long, and two slanted sides join them. It is about
  as tall as the gate is wide. Exactly two single bold level plank lines float inside it, evenly
  spaced, touching nothing. Color: brown #8a5a33.
- Windows: exactly one small narrow arched window floating in the upper half of each tower, below
  the battlements, touching nothing. Two in all. Color: blue #5b8fc7.
The whole castle with its drawbridge fills about 75% of the image.
Nothing else: no chains, no flags, no pointed tower roofs, no bricks or stone lines, no portcullis
bars, no moat, no banners, no shields, no knights, no horses. Ten lines in total. Count: two
towers, three teeth on each tower and on the wall, two plank lines.
```

### 8 · `pagoda`

Objective: Three stacked tiers with upturned roof corners.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective: no roof surface seen from above or below.
NO GROUND: the pagoda stands on its own flat bottom edge on plain white paper. No ground line, no
steps, no garden.
SUBJECT: one pagoda of exactly three tiers. A tier is a plain body with a roof on top of it. The
tiers are stacked and get smaller toward the top, so from the bottom up the image shows: body,
roof, body, roof, body, roof, and one spire line.
- Bodies: exactly three plain rectangles with straight sides, each wider than it is tall. The
  bottom one is the widest; the middle one is three quarters as wide; the top one is half as wide.
  All three are the same height. Color: red #d8433b.
- Lower two roofs: each is one closed shape lying on the body beneath it. It sticks out past that
  body by about a fifth of the body's width on each side, and it is low: about half as tall as
  a body. It has a straight, level bottom edge; at each end the bottom edge
  meets a pointed tip that turns upward; from each tip a smooth curve like a gentle slide sweeps
  inward and up to a short, level top edge, on which the next body stands. Bottom edge on body
  top, and body on roof top, are shared lines, drawn once. Color: dark green #2f6b3a.
- Top roof: the same shape with the same upturned tips, but its two curves sweep up to meet each
  other in one peak above the middle. Color: dark green #2f6b3a.
- The six roof tips (two on each roof) all turn up the same way and are the same size: one simple
  point each, no curls, no hooks, no ornaments.
- Spire: one single bold straight upright line rising from the top roof's peak, about as long as
  a body is tall. A charcoal line with no color: not a pole, no rings, no ball.
- Door: exactly one upright rectangle in the middle of the bottom body's bottom, its bottom edge
  part of the body's bottom edge. Color: brown #8a5a33.
- Windows: exactly one small square floating in the middle of the middle body and one in the
  middle of the top body, touching nothing. Two in all. Color: yellow #f7cf46.
The whole pagoda fills about 75% of the image height.
Nothing else: no roof tiles or ridge lines, no pillars, no railings, no lanterns, no bells, no
stairs, no trees, no clouds, no writing. Ten lines in total. Count: three bodies, three roofs, six
upturned tips.
```

### 9 · `house-in-two-point-perspective`

Objective: Box house with both walls receding to vanishing points.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: this one image is drawn in two-point perspective. The house is a box seen from its corner,
at eye level, so two walls show, one going away to the left and one going away to the right. All
upright edges stay perfectly upright. Every other straight edge of the house aims at one of two
vanishing points.
EXCEPTION TO THE STYLE: this image does show a horizon line and two vanishing points. They are
what the lesson teaches.
SUBJECT: one simple box house with a pointed roof, in front of a horizon line with two vanishing
points.
- Horizon: one single bold straight level line across the image, a little below the middle,
  from 6% to 94% of the image width. It passes behind the house: the house hides its middle, so
  it shows as one piece to the left of the house and one to the right, each ending exactly on the
  house's outline. A charcoal line with no color.
- Vanishing points: exactly two small solid round dots in the charcoal line color, one on each
  end of the horizon line, each about three line-widths across.
- Near corner: the upright edge where the two walls meet, a little to the right of the image's
  middle. It is the tallest upright in the image; the horizon crosses behind it one third of the
  way up.
- Left wall: one closed shape with four straight sides, going away to the left: the near corner,
  a shorter upright far edge, and a top and a bottom edge that both aim at the LEFT vanishing
  point, so the wall gets narrower as it goes away. It is about one and a half times as long as
  the near corner is tall. Color: yellow #f7cf46.
- Right wall (the end wall, with the gable): one closed shape with five straight sides, going away
  to the right: the near corner (shared with the left wall, one line drawn once), a shorter
  upright far edge, a bottom edge that aims at the RIGHT vanishing point, and instead of a top
  edge two slanted roof edges rising to a peak above the middle of the wall. It is about as long
  as the near corner is tall. Color: orange #f08a2c.
- Roof: one closed shape with four straight sides above the left wall: its bottom edge is the
  left wall's top edge (shared line); its near edge is the gable's near slanted edge, from the top
  of the near corner up to the peak (shared line); its top edge, the ridge, runs from the peak
  away toward the LEFT vanishing point; and its far edge slants down from the end of the ridge
  to the top of the left wall's far edge, leaning the same way as the near edge.
  Color: red #d8433b.
- Door: exactly one upright four-sided shape in the middle of the right wall, standing on the
  wall's bottom edge (shared line). Its sides are upright; its top edge aims at the RIGHT
  vanishing point. Color: brown #8a5a33.
- Window: exactly one four-sided shape floating in the middle of the left wall, touching
  nothing. Its sides are upright; its top and bottom edges aim at the LEFT vanishing point.
  Color: blue #5b8fc7.
The house is about 55% of the image width; with the horizon line the picture is about 88% wide.
The sky and the ground stay plain white paper.
Nothing else: no guide lines from the corners to the dots, no dashed lines, no chimney, no
window panes, no doorknob, no roof overhang, no path, no ground color, no trees, no clouds, no
sun, no labels or letters. Nine lines and two dots in total.
```

### 10 · `city-street`

Objective: One-point perspective road with buildings on both sides.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands in the middle of a
straight street and looks along it. There is exactly one vanishing point, in the middle of the
image. All upright edges stay perfectly upright; all level edges that face the viewer stay level;
every edge that goes away from the viewer aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a vanishing point and a short horizon line. They are
what the lesson teaches. This image is a small scene, not one subject.
SUBJECT: a straight road running away to one vanishing point, with exactly two buildings along
its left side and exactly two along its right side. Only the walls that face the street show.
- Vanishing point: exactly one small solid round dot in the charcoal line color, in the middle of
  the image width, a little above the middle of its height, about three line-widths across.
- Road: one large triangle with three straight sides: a level bottom edge across the bottom of
  the scene, and two slanted edges rising from its two ends to meet exactly at the vanishing
  point. Color: gray #c9ced6.
- Center marks: exactly three short single bold straight upright lines floating on the road, one
  above another on its middle, in line with the vanishing point: the lowest the longest, the next
  shorter, the top one shortest, with clear gaps between them. They touch nothing.
- Left near building: one closed shape with four straight sides standing on the road's left edge:
  a tall upright near edge rising from the road's bottom left corner; a bottom edge that is the
  road's left edge (shared line, drawn once) for about 45% of the way to the vanishing point; a
  shorter upright far edge; and a top edge that aims at the vanishing point. Color: red #d8433b.
- Left far building: one more closed shape of the same kind directly behind it, clearly lower.
  Its near upright edge is the lower part of the near building's far edge (shared line, drawn
  once); its bottom edge carries on along the road's left edge for another 30% of the way; it has
  a short upright far edge; its top edge aims at the vanishing point. Color: yellow #f7cf46.
- Right near building and right far building: the same on the right side of the road, as in a
  mirror, but the right near building is a little lower than the left near one.
  Colors: right near building purple #7b4fa3, right far building orange #f08a2c.
- Horizon: one short single bold straight level line at the height of the vanishing point, from
  the left far building's far edge to the right far building's far edge, passing through the
  dot and touching both edges. The road's tip meets it at the dot. A charcoal line with no color.
- Windows: exactly six, all the same kind: a four-sided shape with upright sides and with top and
  bottom edges that aim at the vanishing point. Exactly two side by side, level with each other,
  in the upper half of each near building; exactly one in the upper half of each far building.
  Every window floats, with a clear strip of wall color all around it. Color: blue #5b8fc7.
The whole scene fills about 85% of the image, with clear white margin on all four sides. The sky
above the buildings and everything outside them stays plain white paper.
Nothing else: no sidewalks, no doors, no roofs, no flat building fronts facing the viewer, no
guide lines, no dashed lines, no cars, no street lamps, no traffic lights, no signs, no trees, no
people, no clouds, no sun, no lettering. Sixteen lines and one dot in total. Count: four
buildings, six windows, three center marks.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding bricks, roof tiles, window panes, chimney
smoke, a ground line, flags or guide lines despite the prompts, regenerate rather than keep it.
