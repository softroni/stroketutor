# On the Water — image-generation prompts

Source art for the ten `on-the-water` lessons (Core level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. Once `sailboat` is kept, attach it as a second
  picture to the later requests too: it fixes what a hull, a mast line and a sail look like.
  `harbour` has its own reference line and wants the kept `sailboat` and `tugboat` attached.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/on-the-water/<lesson-id>-<model>.png`, and record model,
  date and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Flat side views, bow on the right**, so the path reads as one family.
- **No water under the nine single boats.** The style prompt forbids a ground line, and a waterline
  would cut every hull in two. Each boat is drawn whole, down to its keel. Water appears only where
  an objective names it: the speedboat's splash wake and the harbor's waves, both as floating lines.
- **Every part has its own dark outline**: windows, portholes, shields, the bumper, the cabin roof
  are closed shapes with a strip of their neighbor's color around them; nothing is told apart by
  color alone.
- **Masts, rods, the periscope, the bowsprit, the paddle's shaft, the scroll and every wave are
  single lines as bold as the outlines**: never thinner, never a colored pole or tube. Hull stripes
  and plank lines float inside the hull and touch nothing.
- **Parts stand apart** with a clear white gap (paddle and canoe, wake and stern, sail and deck, one
  sail and the next, everything in the harbor). Parts touch only where one is attached to another,
  and then along a shared straight edge drawn once (cabin on deck, stack on roof, deck on deck,
  sail on mast, flag on mast, tower on rock). Nothing overlaps on this path, not even in the scene.
- **A square sail hides its mast**: the mast's line stops at the sail's bottom edge and starts again
  at its top edge, so no line crosses a colored area. Those T-junctions, and the sailboat's sail on
  its mast, are what to zoom into after tracing.
- **Lines divide a shape in two lessons**, touching its outline on purpose: the longship's four
  stripe lines and the lighthouse's two band lines. Their prompts say so.
- **Circles touch nothing**: portholes, the tug's window and the five shields each keep a strip of
  color all around, because a circle that another outline touches traces with a dent.
- **No living things**: the pirate ship's flag and sails are plain (said in capitals), and the
  longship's prow ends in a plain scroll line, not a dragon's head.
- **No highlights, shading, texture, smoke or shadow** in any picture: no objective asks for one.

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

For `harbour` only (attach the apple, the kept sailboat and the kept tugboat):

```text
Match the attached apple exactly in line color, line weight, corner rounding, flatness of color
and margins. The other attached images show the sailboat and the tugboat of this course: draw them
again here, smaller and simpler, as the description says. This image is a small scene, not one subject.
```

## Lesson prompts

### 1 · `sailboat`

Objective: Hull with a mast and one triangle sail.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the bow) of the boat on
the right. No perspective: nothing of the deck's surface, the front, the back or the far side shows.
NO WATER: the boat is drawn whole, from its top down to its keel, as if lifted out of the water,
on plain white paper. No waterline, no waves, no reflection.
SUBJECT: one small sailboat: a hull, a mast and exactly one triangle sail.
- Hull: one closed shape like a shallow bowl: a straight, level top edge (the deck), a pointed
  bow on the right that leans outward, a shorter, steeper stern on the left, and a gently curved
  bottom joining them. About four times as long as it is tall. Color: blue #5b8fc7.
- Plank line: one single bold line along the side of the hull, level, halfway down. It starts and
  ends a little inside the hull's outline and touches nothing. A line with no color.
- Mast: one single bold straight upright line, the same charcoal line as the outlines, with no
  color: not a pole, not a tube. It stands on the deck a little in front of the middle of the hull
  and rises about as high as the hull is long.
- Sail: exactly one right-angled triangle behind the mast (on its left). Its upright side lies on
  the mast: sail and mast share that one line, drawn once. Its bottom side is level and runs from
  the mast toward the stern; its third side slants from the top of the mast down to the back end
  of the bottom side. The three sides are straight. The mast shows a short way above the sail's
  top corner, and a short way below the sail: between the sail's bottom side and the deck there
  is a clear gap of white, about four line-widths tall. Color: cream #f6e7b8.
The whole sailboat fills about 70% of the image.
Nothing else: no second sail, no flag or pennant, no boom drawn apart from the sail's bottom side,
no ropes, no rudder, no portholes, no cabin, no sailor, no water. Four lines in total. Count: one sail.
```

### 2 · `canoe`

Objective: Long curved boat with a paddle.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the bow) of the canoe on
the right. No perspective: nothing of the deck's surface, the front, the back or the far side shows.
NO WATER: the canoe is drawn whole, from its top down to its keel, as if lifted out of the water,
on plain white paper. No waterline, no waves, no reflection.
SUBJECT: one canoe with one paddle lying above it.
- Canoe: one single smooth closed shape, long and low, about six times as long as it is tall,
  like a slice of melon lying on its back. Its top edge is one long gentle curve, lowest in the
  middle and rising toward both ends; its bottom edge is one fuller curve. The two curves meet at
  each end in an upturned, softly rounded tip. Both ends are the same. Color: leaf green #4f9d4a.
- Trim line: one single bold curved line inside the canoe, following its top edge a little below
  it. It starts and ends well short of the tips and touches nothing. A line with no color.
- Paddle: exactly one, floating in the white space above the canoe, lying almost level with its
  blade on the right, tilted so the blade end is a little lower. It is about half as long as the
  canoe. Between the paddle and the canoe there is a clear gap of white, at least five
  line-widths, all along. The paddle has three parts:
  - Blade: one closed shape like a long rounded leaf with a blunt rounded end, about four times
    as long as it is wide. Color: brown #8a5a33.
  - Shaft: one single bold straight line from the middle of the blade's inner end, about twice as
    long as the blade. A line with no color: not a pole, not a tube.
  - Grip: one single short bold line across the free end of the shaft, like the top of a letter T.
The canoe fills about 75% of the image width; canoe and paddle together sit in the middle of the image.
Nothing else: no seats, no ribs, no ropes, no second paddle, no paddler, no water. Five lines in
total. Count: one paddle.
```

### 3 · `tugboat`

Objective: Stubby boat with a smokestack and bumper.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the bow) of the tugboat on
the right. No perspective: nothing of the deck's surface, the front, the back or the far side shows.
NO WATER: the tugboat is drawn whole, from its top down to its keel, as if lifted out of the water,
on plain white paper. No waterline, no waves, no reflection.
SUBJECT: one tugboat: a short, deep, stubby boat with a cabin, a smokestack and a bumper rail.
- Hull: one closed shape, short and deep, only about twice as long as it is tall. Its top edge is
  straight and level. The bow on the right is tall and leans outward with a full rounded curve;
  the stern on the left is rounded; the bottom is nearly flat. Color: red #d8433b.
- Bumper: one long, narrow closed shape with fully rounded ends, like a stretched pill, lying along
  the top of the hull. It is about three line-widths thick and a little longer than the hull's top
  edge, so that it sticks out a little past the bow and past the stern. Its underside and the
  hull's top edge are one shared line, drawn once. Color: gray #c9ced6.
- Cabin: one upright box with gently rounded corners standing on the middle of the bumper, about
  a third as long as the hull and as tall as it is wide. Its bottom edge and the bumper's top edge
  are one shared line, drawn once. Color: yellow #f7cf46.
- Window: exactly one complete circle in the upper front part of the cabin's side, with a clear
  strip of yellow all around it. Color: blue #5b8fc7.
- Smokestack: one upright closed shape with straight sides and a flat top, a little taller than it
  is wide, standing on the back half of the cabin's roof. Its bottom edge and the roof are one
  shared line, drawn once. Color: orange #f08a2c.
- Stack band: one single bold level line across the smokestack near its top. It starts and ends a
  little inside the stack's outline and touches nothing. A line with no color.
The whole tugboat fills about 70% of the image width.
Nothing else: no smoke, no tires hanging on the side, no ropes, no mast, no flag, no lights, no
anchor, no door, no railing, no name, no crew, no water. Six lines in total. Count: one
smokestack, one window, one bumper.
```

### 4 · `speedboat`

Objective: Sleek pointed boat with a splash wake.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the bow) of the boat on
the right. No perspective: nothing of the deck's surface, the front, the back or the far side shows.
NO WATER: the boat is drawn whole, from its top down to its keel, as if lifted out of the water,
on plain white paper. No waterline, no waves, no reflection.
SUBJECT: one speedboat with a splash wake behind it.
- Hull: one single smooth closed shape, long and low, about five times as long as it is tall,
  like a wedge. The bow on the right comes to one sharp, slightly raised point. The top edge runs
  straight and level from the point back to the stern. The stern on the left is a short, straight,
  nearly upright edge. The bottom edge is one long gentle curve rising from the stern's foot to the
  point of the bow. Color: orange #f08a2c.
- Speed stripe: one single bold straight line along the side of the hull, level, a little below
  the top edge. It starts and ends a little inside the hull's outline and touches nothing. A line
  with no color.
- Windshield: one small closed shape with four straight sides standing on the top edge of the
  hull, a little in front of the middle: level along the bottom, where it shares one line with the
  hull's top edge, and leaning backward, so that its front side slants and its top is shorter than
  its bottom. Color: blue #5b8fc7.
- Splash wake: exactly three single bold curved lines in the white space behind the stern, on the
  left. Each one starts low, level with the bottom of the hull, sweeps up and away to the left,
  and curls over at its top like the top of a question mark. The one nearest the boat is the
  tallest, about as tall as the hull; the next is smaller; the last is the smallest. They are
  lines, the same charcoal as the outlines, with no color: not closed shapes, not filled. They
  touch neither each other nor the boat: clear gaps of white, at least three line-widths, lie
  between them and between the first one and the stern.
Boat and wake together fill about 78% of the image width.
Nothing else: no motor, no propeller, no seats, no steering wheel, no flag, no number, no drops of
water, no spray at the bow, no speed lines, no driver, no water surface. Six lines in total.
Count the wake lines: three.
```

### 5 · `fishing-boat`

Objective: Small boat with a cabin and a rod.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the bow) of the boat on
the right. No perspective: nothing of the deck's surface, the front, the back or the far side shows.
NO WATER: the boat is drawn whole, from its top down to its keel, as if lifted out of the water,
on plain white paper. No waterline, no waves, no reflection.
SUBJECT: one small fishing boat with a cabin and exactly one fishing rod.
- Hull: one closed shape like a shallow bowl, about three and a half times as long as it is tall:
  a straight, level top edge (the deck), a bow on the right that leans outward, a nearly upright
  stern on the left, and a gently curved bottom. Color: dark green #2f6b3a.
- Plank line: one single bold level line along the side of the hull, halfway down. It starts and
  ends a little inside the hull's outline and touches nothing. A line with no color.
- Cabin: one upright box with gently rounded corners standing on the front half of the deck, set
  back a little from the bow, about a third as long as the hull and a little taller than it is
  wide. Its bottom edge and the deck are one shared line, drawn once. Color: yellow #f7cf46.
- Cabin roof: one low flat slab with rounded ends lying on top of the cabin, about three
  line-widths thick and a little wider than the cabin, so it overhangs on both sides. Its underside
  and the cabin's top edge are one shared line. Color: brown #8a5a33.
- Window: exactly one square window with gently rounded corners in the upper half of the cabin's
  side, with a clear strip of yellow all around it. Color: blue #5b8fc7.
- Rod: exactly one single bold straight line, the same charcoal line as the outlines, with no
  color: not a pole, not a tube. It starts on the deck near the stern and leans out backward, up
  and to the left at about 50 degrees, reaching a little higher than the cabin's roof and out past
  the stern. A clear gap of white lies between the rod and the cabin.
- Fishing line: one single bold line hanging straight down from the tip of the rod, where the two
  lines meet exactly. It hangs behind the stern with a clear gap of white between it and the hull,
  and ends level with the bottom of the hull in one small upturned hook, like a letter J. The hook
  is part of the same line.
The whole boat, rod included, fills about 72% of the image width.
Nothing else: no fish, no net, no bait, no float, no reel, no mast, no flag, no lights, no anchor,
no buoys, no door, no fisher, no water. Seven lines in total. Count: one rod, one window.
```

### 6 · `submarine`

Objective: Oval body with a periscope and three portholes.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the submarine on the
right. No perspective: nothing of the top, the front, the back or the far side shows.
NO WATER: the submarine is drawn whole on plain white paper. No water, no waves, no bubbles.
SUBJECT: one submarine: an oval body with a small tower, one periscope and exactly three portholes.
- Body: one single smooth oval lying level, about two and a half times as long as it is tall,
  both ends evenly rounded. Color: yellow #f7cf46.
- Tower: one small upright box with well rounded top corners standing on the middle of the body's
  top, about one sixth as long as the body and about as tall as it is wide. Its foot follows the
  body's curve: tower and body share that one line, drawn once. Color: orange #f08a2c.
- Periscope: one single bold line, the same charcoal line as the outlines, with no color: not a
  pipe, not a tube. It rises straight up from the middle of the tower's top, about as high again as
  the tower, then turns a square corner and points a short way forward (to the right), like an
  upside-down letter L.
- Portholes: exactly three complete circles in one level row along the middle of the body's
  side, all the same size, each about one third as tall as the body, evenly spaced. A clear strip
  of yellow surrounds each one: they touch neither each other nor the body's outline. One circle
  each: no second ring, no bolts. Color: blue #5b8fc7.
The whole submarine fills about 65% of the image width.
Nothing else: no propeller, no fins, no rudder, no hatch, no rivets, no panel lines, no bubbles,
no light beam, no shine on the portholes, no crew, no water, no seabed. Six lines in total.
Count the portholes: three.
```

### 7 · `cruise-ship`

Objective: Long ship with stacked decks and windows.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the bow) of the ship on
the right. No perspective: nothing of the deck's surface, the front, the back or the far side shows.
NO WATER: the ship is drawn whole, from its top down to its keel, as if lifted out of the water,
on plain white paper. No waterline, no waves, no reflection.
SUBJECT: one cruise ship: a long hull with exactly two decks stacked on it like steps, exactly
seven windows and one funnel.
- Hull: one closed shape, long and low, about six times as long as it is tall. Its top edge is
  straight and level. The bow on the right is pointed and leans outward; the stern on the left is
  a short, slightly leaning edge with a rounded lower corner; the bottom is straight and level.
  Color: blue #5b8fc7.
- Hull stripe: one single bold level line along the side of the hull, halfway down. It starts and
  ends a little inside the hull's outline and touches nothing. A line with no color.
- Lower deck: one long, low box with gently rounded top corners standing on the hull, about two
  thirds as long as the hull and about as tall as the hull, set a little nearer the stern than the
  bow. Its bottom edge and the hull's top edge are one shared line, drawn once. Color: cream #f6e7b8.
- Upper deck: a second box of the same height standing on the middle of the lower deck, about two
  thirds as long as the lower deck, so the decks step in at both ends. Its bottom edge and the
  lower deck's top edge are one shared line. Color: yellow #f7cf46.
- Windows: exactly seven, all the same size, each a square with gently rounded corners, about half
  as tall as a deck. Exactly four in one level row on the lower deck and exactly three in one
  level row on the upper deck, evenly spaced. A clear strip of the deck's color surrounds each
  one: no window touches another window or a deck's outline. Color: blue #5b8fc7.
- Funnel: one closed shape with straight sides and a flat top standing on the middle of the upper
  deck, a little taller than it is wide, leaning slightly backward. Its bottom edge and the upper
  deck's top edge are one shared line. Color: red #d8433b.
The whole ship fills about 80% of the image width.
Nothing else: no smoke, no portholes in the hull, no lifeboats, no railings, no masts, no flags,
no antennas, no pool, no anchor, no name, no passengers, no water. Twelve lines in total. Count:
two decks, four windows below, three windows above, one funnel.
```

### 8 · `pirate-ship`

Objective: Big hull with two sails and a plain flag.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the bow) of the ship on
the right. No perspective: nothing of the deck's surface, the front, the back or the far side shows.
NO WATER: the ship is drawn whole, from its top down to its keel, as if lifted out of the water,
on plain white paper. No waterline, no waves, no reflection.
SUBJECT: one old wooden sailing ship of the kind in pirate stories: a big hull, exactly two
sails and exactly one plain flag.
- Hull: one single closed shape, big and deep, about three times as long as it is tall at the
  stern. Its top edge is stepped: at the stern, on the left, a raised block (the stern castle)
  stands one step higher than the rest, about a quarter of the hull's length; the step down is
  one short upright edge; from there the top edge runs straight and level to the bow. The bow on
  the right leans outward and ends in a rounded point; the stern is a nearly upright edge; the
  bottom is one long gentle curve. Color: brown #8a5a33.
- Plank line: one single bold level line along the side of the hull, halfway down. It starts and
  ends a little inside the hull's outline and touches nothing. A line with no color.
- Bowsprit: one single bold straight line from the point of the bow, pointing forward and
  upward at about 30 degrees, about one sixth as long as the hull. A line with no color.
- Masts: exactly two single bold straight upright lines, the same charcoal line as the outlines,
  with no color: not poles, not tubes. The main mast stands on the deck at the middle of the hull
  and is about as tall as the hull is long; the front mast stands halfway between it and the bow
  and is three quarters as tall.
- Sails: exactly two, one on each mast. Each sail is one closed shape, a little wider than it is
  tall: level, straight top and bottom edges, and two sides that bow gently outward as if filled
  with wind. Each sail is centered on its mast and hides the part of the mast behind it: the
  mast's line stops exactly at the sail's bottom edge and starts again exactly at its top edge.
  No line crosses a sail. The main sail is the larger. Below each sail a clear gap of white, about
  five line-widths tall, shows the mast above the deck; between the two sails there is a clear gap
  of white, at least four line-widths wide. Color of both sails: cream #f6e7b8.
- Flag: exactly one plain flag at the very top of the main mast: a small rectangle, a little longer
  than tall, flying to the left. Its short right side lies on the mast: flag and mast share that
  one line. Above the main sail the mast shows bare for a short way before the flag. The flag is
  one flat color with nothing on it. Color: red #d8433b.
The whole ship fills about 75% of the image height.
Nothing else: NOTHING ON THE FLAG AND NOTHING ON THE SAILS: no skull, no bones, no emblem, no
stripes. No cannons, no portholes, no windows, no anchor, no ropes or rigging, no crow's nest, no
railings, no lantern, no figurehead, no rudder, no crew, no water. Eleven lines in total, counting
each mast as the two pieces that show. Count: two masts, two sails, one flag.
```

### 9 · `longship`

Objective: Curved hull with a scroll prow, striped sail and five shields.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the bow) of the ship on
the right. No perspective: nothing of the deck's surface, the front, the back or the far side shows.
NO WATER: the ship is drawn whole, from its top down to its keel, as if lifted out of the water,
on plain white paper. No waterline, no waves, no reflection.
SUBJECT: one longship, the long open wooden ship of the old north: a curved hull with a scroll
at the prow, one striped sail and exactly five round shields.
- Hull: one single smooth closed shape, long and low, curved like a wide smile, about five times
  as long as its middle is tall. The top edge and the bottom edge are two long curves, lowest in
  the middle. At both ends the hull sweeps upward into a narrow neck. The stern neck, on the
  left, rises about as high as the hull's middle is tall and ends in a plain rounded tip. The
  prow neck, on the right, rises twice as high and ends in a plain rounded tip that leans
  slightly forward. In the middle the hull is deep enough to carry the shields. Color: brown #8a5a33.
- Scroll: one single bold spiral line growing from the tip of the prow neck: it curls forward,
  down and inward, like a coil of rope, with exactly one and a half turns, about as wide across as
  one shield. It touches only the tip of the prow. It is a line, the same charcoal as the
  outlines, with no color. IT IS A PLAIN SCROLL: no head, no eye, no mouth, no teeth, no animal.
- Shields: exactly five complete circles in one row along the side of the hull, following its
  gentle curve, all the same size, each about 8% of the image width across, evenly spaced. A clear
  strip of brown surrounds each one: they touch neither each other nor the hull's outline. One
  circle each: no center boss, no rim, no cross, no pattern. Colors from left to right:
  red #d8433b, yellow #f7cf46, red #d8433b, yellow #f7cf46, red #d8433b.
- Mast: one single bold straight upright line standing on the top edge of the hull at its middle,
  with no color: not a pole, not a tube.
- Sail: exactly one, one closed shape, wider than it is tall, about half as wide as the hull is
  long: level, straight top and bottom edges, and two sides that bow gently outward. It is centered
  on the mast and hides the part of the mast behind it: the mast's line stops exactly at the
  sail's bottom edge and starts again at its top edge, showing a short way above the sail. Below
  the sail a clear gap of white, about five line-widths tall, shows the mast above the hull.
- Stripes: exactly four single bold upright lines divide the sail into exactly five upright
  stripes of equal width. These four lines are the exception to floating detail lines: each one
  runs from the sail's top edge to its bottom edge and touches both. Stripe colors from left to
  right: red #d8433b, cream #f6e7b8, red #d8433b, cream #f6e7b8, red #d8433b.
The whole ship fills about 78% of the image width; the top of the sail is the highest point.
Nothing else: no dragon head, no tail, no oars, no oar holes, no plank lines, no ropes, no flag,
no weather vane, no rudder, no crew, no water. Fourteen lines in total, counting the mast as the
two pieces that show. Count: five shields, five stripes, one scroll.
```

### 10 · `harbour`

Objective: Sailboat, tugboat and a lighthouse on waves.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: everything is a flat side view, seen straight on. Both boats point to the right. No
perspective anywhere.
SUBJECT: a small harbor scene made of three separate things above a row of waves: one sailboat,
one tugboat and one lighthouse. Nothing overlaps anything: a clear gap of white, at least five
line-widths, lies between every two things.
LAYOUT: the lighthouse stands in the middle of the image, the tallest thing, its rock a little
higher up than the boats. The sailboat is at the lower left and the tugboat at the lower right.
The waves lie in the white space under the two boats, along the bottom of the scene.
- Lighthouse tower: one tall closed shape with straight sides, wider at the foot than at the
  top, about four times as tall as its foot is wide, with a flat top and a flat foot. Exactly two
  single bold level lines cross it from side to side, touching both sides, and divide it into
  exactly three bands of equal height. Band colors from the top down: red #d8433b,
  cream #f6e7b8, red #d8433b.
- Lantern room: one small box standing on the middle of the tower's top, a little narrower than
  the top. Its bottom edge and the tower's top edge are one shared line. Color: yellow #f7cf46.
- Lighthouse roof: one small triangle with a rounded peak sitting on the lantern room, a little
  wider than it. Its bottom edge and the lantern room's top edge are one shared line.
  Color: red #d8433b.
- Rock: one low, smooth mound with a flat bottom under the tower, about three times as wide as the
  tower's foot. The tower's foot rests on the middle of the mound's top: they share that one line.
  Color: gray #c9ced6.
- Sailboat, about 28% of the image width long, bow on the right: a hull like a shallow bowl with a
  straight, level top edge, blue #5b8fc7; one single bold upright line for the mast, standing on
  the deck, with no color; one right-angled triangle sail behind the mast (on its left), its upright
  side lying on the mast as one shared line, its bottom side level with a clear gap of white
  above the deck, cream #f6e7b8. No plank line here.
- Tugboat, about 28% of the image width long, bow on the right: a short, deep hull with a straight,
  level top edge and a tall rounded bow, red #d8433b; a narrow bumper with rounded ends lying along
  the top of the hull, gray #c9ced6; an upright cabin box standing on the middle of the bumper,
  yellow #f7cf46, with exactly one complete circle window floating in its side, blue #5b8fc7; an
  upright smokestack with a flat top standing on the back half of the cabin's roof,
  orange #f08a2c. No band on the stack here. Parts that rest on each other share one line.
- Waves: exactly six short single bold wavy lines, each with exactly two soft humps, like a wide
  letter m with round tops. They are lines, the same charcoal as the outlines, with no color.
  Three lie in a level row under the boats and three in a second level row below the first,
  shifted sideways so that no wave sits straight under another. Every wave floats: it touches no
  boat, no rock and no other wave.
The whole scene fills about 82% of the image, with clear white margin on all four sides.
Nothing else: no filled water, no horizon, no sky, no sun, no clouds, no birds, no light beams, no
door or windows on the lighthouse, no railing, no pier, no buoys, no smoke, no flags, no people.
Twenty lines in total. Count: three bands on the tower, six waves, one sail, one window.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding water, smoke, shine on the windows, rigging, a
skull on the flag or a dragon's head despite the prompts, regenerate rather than keep it.
