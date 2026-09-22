# Coast — image-generation prompts

Source art for the ten `coast` lessons (Advanced level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. Once `striped-tower` is kept, attach it as a
  second picture to `spiral-lighthouse`, `lighthouse-beam` and `storm-at-the-point`: it fixes what a
  tower, a lantern room and a roof look like on this path.
- Five lessons keep the flat front view and use the first reference line. The other five change
  the view or show a waterline or a horizon (`bell-buoy`, `wooden-pier`, `boathouse`,
  `lighthouse-beam`, `storm-at-the-point`) and use the second one.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/coast/<lesson-id>-<model>.png`, and record model, date
  and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Water is never filled.** The sea is plain white paper everywhere, shown only by lines: the
  buoy's ripple rings, a waterline under the boathouse and the night tower, a horizon behind the
  pier and the storm. The only water with a color is the storm's three waves, which are closed
  shapes. A waterline or a horizon is an exception to the style prompt, and each prompt that has
  one says so.
- **No sky, even at night.** The night lesson stands on white paper like every other: the night is
  told by a dark purple tower, yellow lit windows and two cream beams, not by a dark background.
  No moon, no stars, no clouds anywhere on the path.
- **Every part has its own dark outline**: bands, panes, the lens, beams, waves and the pieces of a
  reflection are closed shapes; nothing is told apart by color alone.
- **Parts touch only where one is built on another**, and then along a shared edge drawn once
  (lantern room on tower, roof on lantern room, tower on pier, hut on floor, house on rock).
- **Posts, stilts, rails and ripples are single bold lines**, never tubes or planks, on the whole
  path: the harbor pier's posts, the wooden pier's twelve posts, the boathouse's stilts, the
  gallery's railing.
- **Lines divide a shape on purpose in five lessons**, touching its outline at both ends: band
  lines on the towers, stripe lines on the huts, the glass bars of the lantern room.
- **Curved bands follow one rule**: the tower is round and seen from slightly above, so every band
  line and every level edge on it bows gently downward in the middle, all by the same amount, like
  the front of the cylinder in Forms.
- **Overlap is kept for `beach-huts`**, where it is the lesson, and there only the front hut hides
  a narrow strip of its two neighbors. The storm scene is laid out so that nothing overlaps.
- **A beam of light is a closed cream wedge** with its own outline, attached to the lantern room by
  its narrow end. It is opaque and crosses nothing.
- **A reflection is a few closed pieces with white gaps between them**, under a waterline: that is
  what "broken" means here. No wavy edges, no zigzags.
- **Dark things are purple, never charcoal**: the night tower and its roof. A solid dark shape
  swallows its own outline when traced.
- **No living things**: no gulls, no keeper, no sailors, no fish. No lettering or numbers on the
  buoy, the huts or the ship.

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

For `harbor-light`, `beach-huts`, `striped-tower`, `spiral-lighthouse` and `lantern-room`:

```text
Match the attached image exactly in line color, line weight, corner rounding, flatness of color,
margins and overall feel. Only the subject changes.
```

For `bell-buoy`, `wooden-pier`, `boathouse`, `lighthouse-beam` and `storm-at-the-point`:

```text
Match the attached image exactly in line color, line weight, corner rounding and flatness of
color. The subject changes, and so does the view: follow the VIEW paragraph below. Where the
description asks for a waterline or a horizon line, draw it, and keep everything else white paper.
```

## Lesson prompts

### 1 · `bell-buoy`

Objective: Cone cage on a floating drum with a waterline ellipse and two ripple rings.

```text
LINE WEIGHT: every line, including the ripple rings and the bar lines, is as bold as the outline of
the attached apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the
same very dark charcoal. No hairlines, no gray lines. The image is square.
VIEW: this image is not a flat front view. The buoy floats upright and is seen from slightly
above, so every circle on it and around it is drawn as a flat ellipse, about three times as wide
as it is tall. It is opaque: nothing hidden behind it is drawn, and there are no dashed lines.
NO FILLED WATER: the water is plain white paper. It is shown only by the ripple rings.
SUBJECT: one bell buoy floating in calm water: a round drum, a cone-shaped cage standing on it
with a bell and a lamp, and exactly two ripple rings around it.
- Drum top: one complete flat ellipse, about 40% of the image width. Color: gray #c9ced6.
- Drum sides: exactly two short straight upright lines, the same length, one down from the far
  left end of the top ellipse and one down from its far right end, each about as long as the top
  ellipse is tall.
- Waterline: one curve joining the lower ends of the two sides. It is the front half of an ellipse
  of exactly the same size as the top one, bulging downward. This is where the drum meets the water.
- Drum body: the area between the top ellipse, the two sides and the waterline. Color: red #d8433b.
- Cage: one tall cone drawn as a single closed shape standing on the middle of the drum's top. Its
  foot is a small curve, the front half of a flat ellipse about half as wide as the drum's top,
  lying inside the top ellipse with gray showing in front of it and on both sides. Two straight
  bars rise from the two ends of that curve and lean together to the lamp at the top. The cone is
  about one and a half times as tall as the drum's top is wide. The back edge of the drum's top
  passes behind the cone and is hidden by it. Color: yellow #f7cf46.
- Bars: exactly two single bold straight lines floating on the cone, side by side, leaning
  together like the cone's sides, from near its foot to two thirds of the way up. They touch
  nothing, and a clear strip of yellow lies between them.
- Bell: one small bell shape, like an upside-down cup with a flat bottom, floating low on the cone
  between the two bar lines. It touches neither bar and nothing else. Color: brown #8a5a33.
- Lamp: one small complete circle sitting on the cone's top, where the two sides end. The sides end
  on the circle's outline. Color: leaf green #4f9d4a.
- Ripple rings: exactly two flat ellipses lying on the water around the drum, centered under it:
  the first about one and a half times as wide as the drum, the second about twice as wide. Each
  is a single bold line with no color. The back of each ring would pass behind the drum, so each
  ring is open at the back: it starts a clear gap of white away from the drum's left side, runs
  around the front, and ends a clear gap of white away from the drum's right side. The rings touch
  neither the drum nor each other, and the white between them stays white paper.
The buoy with its rings fills about 72% of the image height.
Nothing else: no filled water, no waves, no horizon, no chain, no numbers or letters, no rivets,
no cross bars on the cage, no clapper, no shine on the lamp, no birds. Eleven lines in total.
Count: two bar lines, one bell, one lamp, two ripple rings.
```

### 2 · `harbor-light`

Objective: Short tapered tower with one band and a lantern on the end of a pier.

```text
LINE WEIGHT: every line, including the pier's posts, is as bold as the outline of the attached
apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
VIEW: a flat side view, seen straight on. No perspective: every band line is straight and level.
NO WATER: the pier stands on plain white paper, as if the water had been taken away. No
waterline, no waves, no reflection, no ground line.
SUBJECT: one small harbor light standing on the right end of a pier.
- Pier deck: one long, low, flat slab with four straight sides, lying level across the image,
  about 75% of the image width long and about three line-widths of color tall.
  Color: brown #8a5a33.
- Posts: exactly three single bold straight upright lines under the deck, all the same length,
  about one sixth of the deck's length: one under the deck's left end, one under its middle, one
  under its right end, each a little in from the end. Each starts on the deck's bottom edge and
  goes straight down. Their feet are level and touch nothing. Charcoal lines with no color.
- Tower: one short closed shape with four straight sides standing on the right end of the deck,
  wider at its flat foot than at its flat top, about twice as tall as its foot is wide. Its foot is
  about one quarter of the deck's length. Its bottom edge and the deck's top edge are one shared
  line. Exactly two single bold straight level lines cross it from side to side, touching both
  sides on purpose, and divide it into exactly three bands of equal height: one red band between
  two cream ones. Band colors from the top down: cream #f6e7b8, red #d8433b, cream #f6e7b8.
- Lantern: one box standing on the middle of the tower's top, a little narrower than the top and
  about as tall as it is wide. Its bottom edge and the tower's top edge are one shared line.
  Color: yellow #f7cf46.
- Roof: one small triangle with a gently rounded peak sitting on the lantern, a little wider than
  it. Its bottom edge and the lantern's top edge are one shared line. Color: red #d8433b.
The pier with the tower fills about 75% of the image width; the rest of the deck, to the left of
the tower, is bare.
Nothing else: no door, no windows, no panes in the lantern, no gallery, no railing, no rays or
beams of light, no planks, no ladder, no mooring posts on top of the deck, no boats, no water, no
birds. Nine lines in total. Count: three posts, one red band.
```

### 3 · `beach-huts`

Objective: Three overlapping striped huts with pitched roofs.

```text
LINE WEIGHT: every line, including the stripe lines, is as bold as the outline of the attached
apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective: no side walls show.
NO GROUND: the huts stand on their own flat bottom edges, all on one level, on plain white paper.
No sand, no ground line, no sea.
SUBJECT: a row of exactly three small beach huts, all the same size and shape. The middle hut
stands in front; the left hut and the right hut stand behind it, each with a narrow strip of its
inner side hidden by the middle hut. This overlap is what the lesson teaches.
- Each hut is two closed shapes: an upright wall with four straight sides, a little taller than
  wide, and on it a pitched roof: one triangle with a gently rounded peak, a little wider than the
  wall on both sides. The roof's bottom edge and the wall's top edge are one shared line.
- Stripes: on each wall exactly two single bold straight upright lines run from the wall's top
  edge to its bottom edge, touching both on purpose, and divide the wall into exactly three
  upright stripes of equal width: a colored stripe, a cream stripe, a colored stripe.
- Door: in the middle stripe of each hut, one small upright door with four straight sides, narrower
  than the stripe, standing on the wall's bottom edge (shared line) and about half as tall as the
  wall, with a clear strip of cream on both sides and above it. Color: brown #8a5a33 on all three.
- Middle hut, complete, nothing hidden: stripes red #d8433b, cream #f6e7b8, red #d8433b.
  Roof: gray #c9ced6.
- Left hut, behind: stripes blue #5b8fc7, cream #f6e7b8, blue #5b8fc7. Roof: orange #f08a2c. The
  middle hut hides a narrow strip along its right side: about half of its right blue stripe and
  the right corner of its roof. Its lines stop exactly on the middle hut's outline.
- Right hut, behind: stripes leaf green #4f9d4a, cream #f6e7b8, leaf green #4f9d4a.
  Roof: yellow #f7cf46. The middle hut hides a narrow strip along its left side in the same way.
- Both stripe lines, the whole cream stripe and the whole door of each side hut stay in full view.
The row of huts fills about 82% of the image width.
Nothing else: no windows, no doorknobs, no planks, no steps, no bunting, no flags, no numbers, no
sand, no sea, no sun, no towels, no people. Fifteen lines in total. Count: three huts, three
stripes on each, three doors.
```

### 4 · `striped-tower`

Objective: Tall tapered lighthouse with four bands that curve around it.

```text
LINE WEIGHT: every line, including the band lines, is as bold as the outline of the attached
apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
VIEW: the lighthouse stands upright and is seen from the front. The tower is round, like a tall
cone with its top cut off, and it is seen from very slightly above. So every level edge on it is
not straight: it is a gentle curve that bows downward in the middle, like a shallow smile, and
every such curve bows by the same small amount. The two sides of the tower stay straight. The
tower is opaque: no back edges, no ellipses, no dashed lines.
NO GROUND: the lighthouse stands on its own curved foot on plain white paper. No rock, no sea, no
ground line.
SUBJECT: one tall lighthouse: a round tapered tower with exactly four bands, a gallery, a lantern
room and a roof.
- Tower: one tall closed shape: two straight sides leaning together, wider at the foot than at the
  top, about four times as tall as its foot is wide; a foot that is one gentle curve bowing
  downward; and a top that is one gentle curve bowing downward in the same way.
- Bands: exactly three single bold curved lines cross the tower from side to side, touching both
  sides on purpose, each bowing downward exactly like the foot. They divide the tower into
  exactly four bands of equal height. Band colors from the top down: red #d8433b, cream #f6e7b8,
  red #d8433b, cream #f6e7b8.
- Gallery: one low slab lying on the tower's top, a little wider than the top on both sides and
  about two line-widths of color tall, with short upright ends. Its bottom edge and its top edge
  both bow downward like the bands. Its bottom edge and the tower's top edge are one shared line.
  Color: gray #c9ced6.
- Lantern room: one box standing on the middle of the gallery, as wide as the tower's top and a
  little taller than wide, with straight upright sides. Its bottom edge and the gallery's top edge
  are one shared line; its top edge bows downward in the same way. Color: yellow #f7cf46.
- Roof: one small cone sitting on the lantern room, a little wider than it, with a gently rounded
  peak. Its bottom edge and the lantern room's top edge are one shared line. Color: red #d8433b.
The whole lighthouse fills about 78% of the image height.
Nothing else: no door, no windows, no panes in the lantern room, no railing posts, no rays or
beams of light, no rock, no water, no clouds, no birds. Seven lines in total. Count: four bands,
three curved band lines.
```

### 5 · `wooden-pier`

Objective: One-point perspective deck with six pairs of posts shrinking to the horizon.

```text
LINE WEIGHT: every line, including the smallest posts, is as bold as the outline of the attached
apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands at the near end of a
straight pier and looks along it, out to sea. There is exactly one vanishing point, in the middle
of the image width. All upright lines stay perfectly upright; all level lines stay level; the two
long edges of the deck aim exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image does show a horizon line and a vanishing point. They are what
the lesson teaches. The sea and the sky stay plain white paper.
SUBJECT: a wooden pier running straight out toward the horizon, with exactly six pairs of posts
along its two edges.
- Horizon: one single bold straight level line across the image, a little above the middle of its
  height, from 8% to 92% of the image width, unbroken. Nothing crosses it and nothing touches it
  except the dot. A charcoal line with no color.
- Vanishing point: exactly one small solid round dot in the charcoal line color on the middle of
  the horizon line, about three line-widths across.
- Deck: one closed shape with four straight sides: a wide level near edge across the bottom of the
  scene, about 60% of the image width; two long slanted edges rising from its two ends, both
  aiming exactly at the vanishing point; and a short level far edge that closes the shape a clear
  gap of white below the horizon, about one fifth as wide as the near edge. The deck is plain:
  one flat area. Color: brown #8a5a33.
- Posts: exactly twelve single bold straight upright lines, in exactly six pairs. Each post starts
  on one of the deck's slanted edges and rises straight up into the white beside the deck. In each
  pair, one post stands on the left edge and one on the right edge, level with each other and the
  same height. The first pair stands a little in from the near corners and is the tallest, about
  one sixth of the image height. Each pair farther away is shorter than the pair before it, and
  the pairs stand closer together as they go away. The sixth pair stands at the far corners and is
  the shortest, still at least four line-widths tall. The tops of the posts on each side lie on
  one straight line that aims at the vanishing point. Every post top stays a clear gap of white
  below the horizon. Charcoal lines with no color, with round ends: no caps, no ropes.
The whole scene fills about 84% of the image width, with clear white margin on all four sides.
Nothing else: no plank lines, no railing, no ropes or chains between the posts, no guide lines to
the dot, no dashed lines, no filled sea, no waves, no boats, no sun, no clouds, no birds, no
lamp posts, no benches. Fourteen lines and one dot in total. Count the posts: six on the left,
six on the right.
```

### 6 · `spiral-lighthouse`

Objective: Tower with one stripe winding around it three times.

```text
LINE WEIGHT: every line, including the stripe lines, is as bold as the outline of the attached
apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
VIEW: the lighthouse stands upright and is seen from the front. The tower is round and is seen
from very slightly above, so its foot, its top and the edges of the gallery and the lantern room
are gentle curves that bow downward in the middle, all by the same small amount. The two sides of
the tower stay straight. The tower is opaque: the part of the stripe that winds around the back
is not drawn, and there are no dashed lines.
NO GROUND: the lighthouse stands on its own curved foot on plain white paper. No rock, no sea, no
ground line.
SUBJECT: one tall lighthouse whose tower has one red stripe winding around it like the stripe on
a barber's pole. The stripe goes around exactly three times, so it shows on the front as exactly
three slanted red bands.
- Tower: one tall closed shape: two straight sides leaning together, wider at the foot than at the
  top, about four times as tall as its foot is wide; a foot that is one gentle curve bowing
  downward; and a top that bows downward in the same way.
- Stripe: exactly three slanted bands cross the front of the tower, one above another, evenly
  spaced, all slanting the same way: each rises from the tower's left side to its right side, its
  right end higher than its left end by about the band's own height. Each band lies between two
  single bold lines that run side by side from the left side of the tower to the right side,
  touching both sides on purpose; each line is a gentle curve that sags a little in the middle,
  like the foot, and is tilted. That makes exactly six stripe lines. The bands are all the same
  height, about one ninth of the tower's height, and the cream spaces between them are a little
  taller than the bands. No band touches another band, the foot or the top.
  Color of the three slanted bands: red #d8433b. Color of the four spaces, above, between and
  below the bands: cream #f6e7b8.
- Gallery: one low slab lying on the tower's top, a little wider than the top on both sides and
  about two line-widths of color tall, with short upright ends, its top and bottom edges bowing
  downward. Its bottom edge and the tower's top edge are one shared line. Color: gray #c9ced6.
- Lantern room: one box standing on the middle of the gallery, as wide as the tower's top and a
  little taller than wide. Its bottom edge and the gallery's top edge are one shared line.
  Color: yellow #f7cf46.
- Roof: one small cone sitting on the lantern room, a little wider than it, with a gently rounded
  peak. Its bottom edge and the lantern room's top edge are one shared line. Color: red #d8433b.
The whole lighthouse fills about 78% of the image height.
Nothing else: no level bands, no door, no windows, no panes in the lantern room, no railing posts,
no rays or beams of light, no rock, no water, no clouds, no birds. Ten lines in total. Count:
three slanted red bands, six stripe lines.
```

### 7 · `boathouse`

Objective: Hut on four stilts over the water with its broken reflection.

```text
LINE WEIGHT: every line, including the stilts and their reflections, is as bold as the outline of
the attached apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the
same very dark charcoal. No hairlines, no gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective: no side walls show. The reflection
lies straight below the hut, upside down, as in a mirror lying flat.
EXCEPTION TO THE STYLE: this image does show a waterline: one level line. It is what the lesson
teaches. The water itself stays plain white paper.
SUBJECT: one small boathouse standing on exactly four stilts over calm water, and under the
waterline its reflection, broken into separate pieces with white gaps between them.
- Waterline: one single bold straight level line across the image, a little below the middle of
  its height, from 10% to 90% of the image width. A charcoal line with no color.
- Floor: one long, low, flat slab with four straight sides, about 45% of the image width long and
  about three line-widths of color tall, lying level above the waterline. Color: brown #8a5a33.
- Stilts: exactly four single bold straight upright lines, evenly spaced, the outer two a little in
  from the ends of the floor. Each starts on the floor's bottom edge and goes straight down to
  the waterline, touching both on purpose. Each is about one quarter as long as the floor.
  Charcoal lines with no color.
- Walls: one closed shape with four straight sides standing on the floor, a little narrower than
  the floor and a little wider than tall. Its bottom edge and the floor's top edge are one shared
  line. Color: yellow #f7cf46.
- Roof: one triangle with a gently rounded peak sitting on the walls, a little wider than them on
  both sides. Its bottom edge and the walls' top edge are one shared line. Color: red #d8433b.
- Door: one wide door with four straight sides in the middle of the walls, standing on the walls'
  bottom edge (shared line), about two thirds as tall as the walls. Color: blue #5b8fc7.
- Reflection, below the waterline, from the top down, every piece floating and touching nothing:
  1. exactly four short single bold upright lines straight below the four stilts, each about half
     as long as its stilt, starting a clear gap of white below the waterline;
  2. a clear gap of white, then one level strip with four straight sides, as wide as the walls
     and about one third as tall. Color: yellow #f7cf46;
  3. a clear gap of white, then a second strip exactly like the first. Color: yellow #f7cf46;
  4. a clear gap of white, then one triangle pointing straight down, as wide as the roof and a
     little flatter than it. Color: red #d8433b.
  Every gap of white is at least four line-widths tall. The pieces have straight edges: no wavy
  edges, no zigzags. The door and the floor are not reflected.
The hut with its reflection fills about 80% of the image height.
Nothing else: no filled water, no ripples, no wave lines, no boat, no ladder, no windows, no
planks, no doorknob, no ropes, no horizon, no shore, no reeds, no birds. Sixteen lines in total.
Count: four stilts, four reflected stilt lines, two strips, one triangle.
```

### 8 · `lantern-room`

Objective: Close-up of the top: gallery railing, six glass panes, the lens and a domed roof.

```text
LINE WEIGHT: every line, including the railing and the glass bars, is as bold as the outline of
the attached apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the
same very dark charcoal. No hairlines, no gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective: every level edge is straight and level.
SUBJECT: a close-up of the top of a lighthouse, and only the top: the upper end of the tower, the
gallery with its railing, the glass lantern room with exactly six panes and the lens inside it,
and a domed roof. It stands on plain white paper; nothing is cropped by the edge of the image.
From the bottom up:
- Tower top: one low closed shape with four straight sides, a little wider at its flat bottom than
  at its flat top, about three times as wide as tall. It ends in a clean level edge at the bottom:
  the rest of the tower is simply not drawn. Color: red #d8433b.
- Gallery: one long, low, flat slab lying on the tower top, about one and a half times as wide as
  it, sticking out the same amount on both sides, about three line-widths of color tall. Its
  bottom edge and the tower top's top edge are one shared line. Color: gray #c9ced6.
- Lantern room: one wide box with four straight sides standing on the middle of the gallery, as
  wide as the tower top and about two thirds as tall as it is wide. Its bottom edge and the
  gallery's top edge are one shared line.
- Lens: one upright oval, like an egg standing on its end, in the middle of the lantern room. It
  stands on the lantern room's bottom edge, touching it, is about one quarter as wide as the
  lantern room, and its top stays a clear gap below the lantern room's top edge.
  Color: yellow #f7cf46.
- Glass bars: exactly four single bold straight upright lines from the lantern room's top edge to
  its bottom edge, touching both on purpose, two to the left of the lens and two to the right,
  evenly spaced, none touching the lens. And exactly one short single bold upright line above the
  lens, from the middle of the lantern room's top edge down to the top of the lens, touching both.
  Together with the lens they divide the glass into exactly six panes: two whole panes on the left,
  two whole panes on the right, and one on each side of the lens. All six panes are the same
  color, on purpose: blue #5b8fc7.
- Railing: on each side of the lantern room, on the part of the gallery that sticks out: exactly
  three single bold straight upright posts standing on the gallery's top edge, evenly spaced, the
  outer one at the gallery's end, all about half as tall as the lantern room; and exactly one
  single bold straight level rail lying along their tops, from the top of the outer post to the
  lantern room's side, touching it. No post touches the lantern room. That makes six posts and
  two rails. The spaces between the posts stay white paper. Charcoal lines with no color.
- Roof rim: one long, low, flat slab lying on the lantern room, a little wider than it on both
  sides, about two line-widths of color tall. Its bottom edge and the lantern room's top edge are
  one shared line. Color: gray #c9ced6.
- Dome: one half circle standing on the rim, as wide as the lantern room. Its flat bottom edge and
  the rim's top edge are one shared line. Color: red #d8433b.
- Ball: one small complete circle sitting on the very top of the dome, touching it at one point.
  Color: yellow #f7cf46.
The whole drawing fills about 78% of the image height and about 75% of its width.
Nothing else: no rings or lines on the lens, no glow, no rays or beams, no shine on the glass, no
cross bars, no door, no bricks, no weather vane, no lightning rod, no birds, no sky. Twenty lines
in total. Count: six blue panes, five glass bars, six posts, two rails.
```

### 9 · `lighthouse-beam`

Objective: Night tower with two pale wedges of light, lit windows and a reflection on the water.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. No perspective: every level edge is straight and level.
NO SKY: this is a night picture, but the drawing stands on plain white paper. No black, blue or
purple sky, no moon, no stars, no clouds, no glow. The night is shown only by the dark tower, its
lit windows and the two beams. Everything that is not named below is white paper.
EXCEPTION TO THE STYLE: this image does show a waterline: one level line. The water itself stays
plain white paper.
SUBJECT: one lighthouse at night on a small rock in the sea, sending out exactly two beams of
light, one to the left and one to the right, with exactly two lit windows and the light's
reflection on the water.
- Waterline: one single bold straight level line across the image, from 8% to 92% of the image
  width, about one fifth of the way up the image. A charcoal line with no color.
- Rock: one low, smooth mound in the middle of the waterline, about three times as wide as the
  tower's foot, with a flat bottom. Its flat bottom is part of the waterline: one shared line.
  Color: gray #c9ced6.
- Tower: one tall closed shape with four straight sides, wider at the foot than at the top, about
  three and a half times as tall as its foot is wide, with a flat top and a flat foot. Its foot
  rests on the middle of the mound's top: they share that one line. No bands. Color: purple #7b4fa3.
- Lit windows: exactly two small upright windows with four straight sides floating on the middle
  of the tower, one above the other with a clear stretch of purple between them, each with a
  clear strip of purple all around it. Color: yellow #f7cf46.
- Lantern room: one box standing on the middle of the tower's top, a little narrower than the top
  and about as tall as it is wide. Its bottom edge and the tower's top edge are one shared line.
  Color: yellow #f7cf46.
- Roof: one small triangle with a gently rounded peak sitting on the lantern room, a little wider
  than it. Its bottom edge and the lantern room's top edge are one shared line.
  Color: purple #7b4fa3.
- Beams: exactly two wedges of light, one on each side of the lantern room, the same size, like a
  mirror. Each is one closed shape with four straight sides: its narrow end is the middle half of
  the lantern room's side (one shared line); from there two straight edges run outward and spread
  apart, one rising a little and one falling a little; and one straight upright far edge closes
  it. Each beam is about 30% of the image width long, and its far end is about three times as tall
  as its narrow end. The beams are opaque flat shapes with a dark outline like everything else:
  nothing shows through them, and they cross nothing. They touch only the lantern room.
  Color: cream #f6e7b8.
- Reflection: exactly three short, flat bars with rounded ends floating on the water straight
  below the rock, one below another, the top one the longest, about as long as the tower's foot is
  wide, each one below it shorter. Each is a closed shape about two line-widths of color tall.
  The top bar starts a clear gap of white below the waterline, and clear gaps of white lie
  between the bars. They touch nothing. Color: yellow #f7cf46.
The whole scene fills about 84% of the image, with clear white margin on all four sides.
Nothing else: no dark background, no moon, no stars, no clouds, no glow around the lantern, no rays,
no gallery, no railing, no door, no panes, no waves, no ripples, no boats, no birds. Twelve lines
in total. Count: two beams, two lit windows, three reflection bars.
```

### 10 · `storm-at-the-point`

Objective: Lighthouse, keeper's house, rocks, three big waves, the beam and a small ship far out.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: everything is a flat side view, seen straight on. The tower is round, so the two band lines
on it bow gently downward in the middle; every other level edge is straight and level. Far away
is shown only by size: the ship is very small.
EXCEPTION TO THE STYLE: this image is a small scene, not one subject, and it does show a horizon
line. The sea and the sky stay plain white paper: no filled water, no dark sky.
SUBJECT: a stormy point of land: a lighthouse and a keeper's house on a big rock at the right,
one small rock beside it, exactly three big waves rolling in from the left, one beam of light
pointing out to sea, and one small ship far out on the horizon. Nothing overlaps anything: a
clear gap of white, at least four line-widths, lies between every two things that are not built
on each other.
LAYOUT: the big rock fills the lower right of the scene. The three waves stand in a row along the
bottom left, and the small rock stands between the last wave and the big rock. The bottoms of the
waves and of both rocks are level with each other. The horizon runs across the left half of the
image above the waves, and the ship sits on it near its left end. The beam passes high above the
horizon and the ship.
- Big rock: one wide, low closed shape with a flat level bottom, a flat level top, a steep left
  side and a gentler right side, with soft corners, about 40% of the image width and about a third
  as tall as wide. Color: gray #c9ced6.
- Small rock: one small smooth mound with a flat bottom, a clear gap to the left of the big rock,
  about one sixth as wide as the big rock and lower than it. Color: brown #8a5a33.
- Lighthouse tower: one tall closed shape with two straight sides leaning together, wider at the
  foot than at the top, about four times as tall as its foot is wide, standing on the left part of
  the big rock's top. Its flat foot and the rock's top edge are one shared line. Exactly two
  single bold curved lines cross it from side to side, touching both sides on purpose, each
  bowing gently downward in the middle, and divide it into exactly three bands of equal height.
  Band colors from the top down: red #d8433b, cream #f6e7b8, red #d8433b.
- Lantern room: one box standing on the middle of the tower's flat top, a little narrower than the
  top. Its bottom edge and the tower's top edge are one shared line. Color: yellow #f7cf46.
- Lighthouse roof: one small triangle with a gently rounded peak sitting on the lantern room, a
  little wider than it. Shared bottom edge. Color: red #d8433b.
- Beam: exactly one wedge of light pointing left, out to sea. It is one closed shape with four
  straight sides: its narrow end is the middle half of the lantern room's left side (one shared
  line); two straight edges run to the left and spread apart, one rising a little and one falling
  a little; one straight upright far edge closes it. It is about 35% of the image width long. It
  is an opaque flat shape with a dark outline: nothing shows through it, it crosses nothing, and
  it touches only the lantern room. Color: cream #f6e7b8.
- Keeper's house: a small house standing on the right part of the big rock's top, a clear gap to
  the right of the tower, about one third as tall as the tower: one wall shape with four straight
  sides, a little wider than tall, its bottom edge shared with the rock's top, yellow #f7cf46;
  one triangle roof with a gently rounded peak on it, a little wider than the wall, shared edge,
  orange #f08a2c; exactly one door standing on the wall's bottom edge at the left, brown #8a5a33;
  exactly one small square window floating in the wall at the right, blue #5b8fc7.
- Waves: exactly three big waves in a row, each one closed shape: a flat level bottom, a long
  smooth back rising from the left, and at the top right a crest that curls over to the right
  into one round hook, then a hollow front falling back down to the bottom. The left wave is the
  smallest and the right wave the biggest, about as tall as the big rock; all three have the same
  shape. They lean toward the rocks. Color: blue #5b8fc7 for all three.
- Horizon: one single bold straight level line from 8% of the image width to the big rock's steep
  left side, ending exactly on the rock's outline, a little below the rock's top. It passes a
  clear gap of white above the top of the biggest wave. A charcoal line with no color.
- Ship: one very small ship sitting on the horizon near its left end, about 8% of the image width
  long: a hull like a shallow bowl with a straight level top, whose flat bottom lies on the
  horizon line (one shared line), purple #7b4fa3; and one small upright box standing on the
  middle of the hull, shared edge, cream #f6e7b8.
The whole scene fills about 86% of the image, with clear white margin on all four sides.
Nothing else: no filled sea, no dark sky, no clouds, no rain, no lightning, no spray or foam dots,
no wave lines, no gallery, no railing, no door or windows on the tower, no chimney, no smoke, no
fence, no path, no flag, no sails, no birds, no people. Nineteen lines in total. Count: three
waves, two rocks, three bands on the tower, one beam, one ship.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding filled water, a dark sky, stars, a glow
around the lantern, see-through beams, bricks, planks, gulls or foam despite the prompts, regenerate
rather than keep it.
