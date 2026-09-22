# Wheels — image-generation prompts

Source art for the ten new `wheels` lessons (Core level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.
`classic-red-car` is already published on this path and is left alone.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. Once `school-bus` or `car` is kept, attach it as a
  second picture to the later requests too: it fixes what a wheel in its arch looks like.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/wheels/<lesson-id>-<model>.png`, and record model, date
  and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Ten flat side views, front on the right**, so the path reads as one family. No lesson turns
  the vehicle: a three-quarter view is too hard for this age. The last lesson, the ambulance, is
  the capstone because it has the most named parts, not because its view changes.
- **A wheel is two complete circles: a gray tire ring and a cream hub.** Circles that another outline
  touches trace with a dent, so **no wheel touches anything**: the body's bottom edge rises in a wheel
  arch and an even white gap runs between arch and tire. The monster truck's body rides over its
  wheels the same way. Tires are gray, not black: a solid dark shape swallows its own outline when
  traced, and the monster truck's tread lines have to show on the tire.
- **Every part has its own dark outline**: windows, hubs, track wheels, the ambulance's cross and
  roof light and the number's circle are closed shapes with a strip of the body's color all around them; nothing is told apart
  by color alone.
- **Details are single lines as bold as the outlines**: the bus's and the ambulance's stripe, the
  dump truck's lift arm, the train's coupling, the tread lines, the digit 7, the motorcycle's fork and handlebars, and the
  whole frame of the bicycle. Never thinner, never a colored tube. Named parts that are solid in life
  (the excavator's arm, the exhaust, the spoiler) are closed shapes and are asked to be thick.
- **Parts stand apart** with a clear white gap (the tilted bed, the bucket, the engine and its car).
  Parts touch only where one is attached to another, and then along a shared straight edge drawn
  once (cab on frame, boiler on frame, tank on engine), which traces cleanly. Nothing overlaps on
  this path.
- **Lines have to meet shapes in two lessons**: the bicycle's frame lines meet each other and the
  hubs, and cross the wheels' circles; the motorcycle's fork starts at the front hub and crosses the
  tire. Those junctions are what to zoom into after tracing.
- **The race car's number is the one exception to the style prompt's "no numbers"**: its prompt says
  so in capitals. If the model still refuses or adds more lettering, regenerate.
- **The ambulance is cream, not white**: the style prompt allows no white inside a subject, and a
  white body would vanish into the background when traced. Its cross is a plain red plus sign.
- **The bicycle is see-through** (white inside the wheels and the frame), the one exception to
  "nothing is left white"; its prompt says so.
- **No road, ground or shadow** in any picture, and no highlights, shading or texture: no objective
  asks for one.

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

### 1 · `school-bus`

Objective: Long box with four windows and two wheels.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the bus on the
right. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one school bus: a long box with exactly four windows and exactly two wheels.
- Body: one long box with gently rounded corners, about two and a half times as long as it is
  tall, with a flat roof and upright front and back ends. Its bottom edge is straight except for
  the two wheel arches, one near each end. Color: yellow #f7cf46.
- Windows: exactly four windows in one level row along the upper half of the body, all the same
  size, each a square with gently rounded corners. They are evenly spaced, with a clear strip of
  yellow between neighbors and all around them: no window touches another window or the body's
  outline. Color: blue #5b8fc7.
- Stripe: one single bold straight line along the side of the body, level, halfway between the
  windows and the wheel arches. It starts and ends a little inside the body's outline and touches
  nothing. It is a line, the same charcoal as the outlines, with no color: not a band, not a bar.
- Wheels: exactly two, the same size, each about 17% of the image width across. Each wheel
  is two complete circles, one inside the other, sharing one center: the outer circle is the tire
  and the inner circle is the hub, half as wide as the tire. The ring between them is gray #c9ced6;
  the hub is cream #f6e7b8.
  No spokes, no bolts, no tread marks.
- Wheel arches: over each wheel, the body's bottom edge
  rises in a round arch. Between the arch and the tire there is a clear gap of white paper,
  about three line-widths wide and even all the way around.
  No wheel touches or overlaps anything; the lower part of each wheel hangs below the arch.
The whole bus fills about 70% of the image width.
Nothing else: no door, no windshield, no headlights, no bumpers, no mirrors, no stop sign, no
lettering, no driver, no road. Ten lines in total. Count: four windows, two wheels.
```

### 2 · `car`

Objective: Rounded body with two wheels and side windows.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the car on the
right. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one small car with a rounded body, exactly two side windows and exactly two wheels.
- Body: one single smooth outline: a low rounded hood at the front, a high rounded roof like a
  dome over the middle, and a low rounded trunk at the back, all flowing into each other with no
  sharp corners. Its bottom edge is straight except for the two wheel arches. About two and a half
  times as long as it is tall. Color: orange #f08a2c.
- Windows: exactly two side windows under the roof dome, side by side, with an upright strip of
  orange between them. Each is its own closed shape with gently rounded corners: level along the
  bottom, upright along the middle strip, and curved along the top and outer side to follow the
  roof. The rear window mirrors the front one. A clear strip of orange runs all around them: no
  window touches the other window or the body's outline. Color: blue #5b8fc7.
- Wheels: exactly two, the same size, each about 17% of the image width across. Each wheel
  is two complete circles, one inside the other, sharing one center: the outer circle is the tire
  and the inner circle is the hub, half as wide as the tire. The ring between them is gray #c9ced6;
  the hub is cream #f6e7b8.
  No spokes, no bolts, no tread marks.
- Wheel arches: over each wheel, the body's bottom edge
  rises in a round arch. Between the arch and the tire there is a clear gap of white paper,
  about three line-widths wide and even all the way around.
  No wheel touches or overlaps anything; the lower part of each wheel hangs below the arch.
The whole car fills about 70% of the image width.
Nothing else: no door lines, no door handle, no headlights or taillights, no bumpers, no mirror,
no antenna, no driver, no road. Seven lines in total. Count: two windows, two wheels.
```

### 3 · `dump-truck`

Objective: Cab with a tilted box bed.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the truck on the
right. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one dump truck: a cab at the front and a box bed behind it, tilted up as if tipping
its load out of the back.
- Frame: one long, low, level bar with gently rounded corners, running the whole length of the
  truck. Its top edge is straight. Its bottom edge is straight except for the two wheel arches, one
  under the cab and one near the back end. Color: brown #8a5a33.
- Cab: one upright box with gently rounded corners, a little taller than wide, standing on the
  front third of the frame. The cab's bottom edge and the frame's top edge are one shared line,
  drawn once. Color: yellow #f7cf46.
- Cab window: one square window with gently rounded corners in the upper half of the cab, with
  a clear strip of yellow all around it. Color: blue #5b8fc7.
- Bed: one plain box with four straight sides and gently rounded corners, about twice as long as it
  is tall, behind the cab and above the back two thirds of the frame. It is tilted: its front end
  (the end near the cab) is lifted high and its back end is low, a tilt of about 25 degrees. The
  bed touches nothing: there is a clear gap of white between it and the cab, and a smaller clear gap
  of white between its low back corner and the frame. Color: orange #f08a2c.
- Lift arm: one single bold straight line standing between the frame and the underside of the
  bed, below the bed's raised front half, leaning slightly. It starts a little above the frame and
  ends a little below the bed, touching neither. A line with no color: not a tube, not a bar.
- Wheels: exactly two, the same size, each about 16% of the image width across. Each wheel
  is two complete circles, one inside the other, sharing one center: the outer circle is the tire
  and the inner circle is the hub, half as wide as the tire. The ring between them is gray #c9ced6;
  the hub is cream #f6e7b8.
  No spokes, no bolts, no tread marks.
- Wheel arches: over each wheel, the frame's bottom edge
  rises in a round arch. Between the arch and the tire there is a clear gap of white paper,
  about three line-widths wide and even all the way around.
  No wheel touches or overlaps anything; the lower part of each wheel hangs below the arch.
The whole truck fills about 70% of the image.
Nothing else: no load, no dirt falling out, no ribs or panels on the bed, no door line, no
headlights, no bumper, no exhaust, no driver, no ground. Nine lines in total.
```

### 4 · `train`

Objective: Engine with a smokestack pulling one car.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the train on the
right. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one small steam train: an engine with a smokestack, on the right, pulling exactly one
freight car, on the left.
ENGINE
- Engine frame: one long, low, level bar with gently rounded corners. Its top edge is straight;
  its bottom edge is straight except for two wheel arches. Color: brown #8a5a33.
- Boiler: one long, low box lying on the front two thirds of the frame, its front end (on the
  right) fully rounded like the end of a loaf, its back end upright. Color: red #d8433b.
- Cab: one upright box with gently rounded corners on the back third of the frame, right behind
  the boiler and clearly taller than it, with a flat roof. Color: dark green #2f6b3a.
- Cab window: one square window with gently rounded corners in the upper half of the cab, with
  a clear strip of dark green all around it. Color: blue #5b8fc7.
- Smokestack: one closed shape standing on top of the boiler near its front: narrow at the
  bottom and wider at its flat top, like a flowerpot. Color: purple #7b4fa3.
- Where boiler, cab and frame rest on each other, and where the smokestack stands on the boiler,
  they share one line, drawn once.
FREIGHT CAR
- Car frame: a shorter bar of the same height and at the same level as the engine's frame, with
  two wheel arches. Color: brown #8a5a33.
- Car box: one plain open box with upright sides and a flat top edge standing on the car frame,
  lower than the engine's cab. Color: orange #f08a2c.
- Coupling: one single short bold level line in the gap between the two frames. It starts a
  little away from the car frame and ends a little away from the engine frame, touching neither.
  Apart from this line the gap between engine and car is clear white, about as wide as one wheel.
- Wheels: exactly four, the same size, each about 11% of the image width across. Each wheel
  is two complete circles, one inside the other, sharing one center: the outer circle is the tire
  and the inner circle is the hub, half as wide as the tire. The ring between them is gray #c9ced6;
  the hub is cream #f6e7b8.
  No spokes, no rods between the wheels.
- Wheel arches: over each wheel, each frame's bottom edge
  rises in a round arch. Between the arch and the tire there is a clear gap of white paper,
  about three line-widths wide and even all the way around.
  No wheel touches or overlaps anything; the lower part of each wheel hangs below the arch.
  Two wheels are under the engine and two under the freight car.
The whole train fills about 78% of the image width.
Nothing else: no smoke, no steam, no bell, no dome, no cowcatcher, no headlamp, no load in the
car, no bands on the boiler, no rails, no ground, no driver. Sixteen lines in total. Count: one
smokestack, one car, four wheels.
```

### 5 · `excavator`

Objective: Cab on tracks with a bent arm and bucket.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side. The arm reaches toward the right, so the
right is the front. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one excavator (a digger): a cab on crawler tracks, with a bent arm ending in a bucket.
- Tracks: one long, low closed shape with straight top and bottom edges and fully rounded ends,
  like a stretched pill, at the bottom left of the picture. Color: gray #c9ced6.
- Track wheels: exactly three complete circles in a level row inside the tracks, all the same
  size, evenly spaced. A clear strip of gray surrounds each one: they touch neither each other nor
  the tracks' outline. Color: cream #f6e7b8.
- Body: one low box with gently rounded corners sitting on top of the tracks, a little shorter
  than the tracks. Its bottom edge and the tracks' top edge are one shared line, drawn once.
  Color: yellow #f7cf46.
- Cab: one upright box with gently rounded corners standing on the back (left) half of the
  body, sharing its bottom edge with the body's top edge. Color: orange #f08a2c.
- Cab window: one square window with gently rounded corners in the upper half of the cab, with
  a clear strip of orange all around it. Color: blue #5b8fc7.
- Arm, first part (the boom): one long straight bar with rounded ends, as thick as the tracks'
  wheels are wide: a solid part, not a thin tube. Its foot stands on the front (right) half of the
  body's top edge, and it rises steeply up and to the right. There is a clear gap of white between
  it and the cab. Color: orange #f08a2c.
- Arm, second part (the stick): a second straight bar of the same thickness, a little shorter.
  It starts at the top end of the boom, where the two bars touch end to end and make a bend like
  an elbow, and it slopes down and to the right. Color: yellow #f7cf46.
- Bucket: one closed scoop shape hanging from the low end of the stick: a straight top edge where
  it is attached, a rounded belly, and one blunt point at its lower front. Its open side faces
  back toward the tracks. There is a wide clear gap of white between the bucket and the tracks.
  Color: brown #8a5a33.
Boom and stick together look like an upside-down letter V with the bucket at its far end. The
whole excavator, arm included, fills about 72% of the image.
Nothing else: no teeth on the bucket, no pistons, hoses or hydraulic cylinders, no tread marks
on the tracks, no exhaust, no dirt, no ground, no driver. Ten lines in total. Count the track
wheels: three.
```

### 6 · `monster-truck`

Objective: Small body on giant treaded wheels.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the truck on the
right. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one monster truck: a small pickup body riding on two giant wheels with treads.
- Wheels: exactly two giant wheels side by side along the bottom, the same size, each about 30%
  of the image width across, with a clear gap of white between them about a quarter of a wheel
  wide. Each wheel is two complete circles sharing one center: the outer circle is the tire and
  the inner circle is the hub, a little less than half as wide as the tire, so the tire is a
  broad ring. The ring is gray #c9ced6; the hub is cream #f6e7b8. No spokes, no bolts.
- Treads: on each tire exactly eight short straight bold lines, evenly spaced around the ring
  like the eight points of a compass, each pointing at the center of the wheel. Every tread line
  floats in the gray ring: it starts a little inside the tire's outer circle and stops a little
  short of the hub, touching neither. The tire's outer circle stays a plain smooth circle: no
  bumps, no teeth, no notches.
- Body: one single outline in the shape of a small pickup truck: a short low hood at the front,
  a taller cab with a flat roof behind it, and a low flat bed at the back. It is about as long as
  the two wheels together and only about half as tall as one wheel. It rides above the wheels: its
  bottom edge rises in a wide, shallow arch over the top of each wheel, and between each arch and
  its tire there is a clear gap of white paper, about three line-widths wide and even all along.
  The body touches neither wheel. Color: purple #7b4fa3.
- Window: one side window in the cab, a square with gently rounded corners, with a clear strip
  of purple all around it. Color: blue #5b8fc7.
The whole truck fills about 70% of the image width.
Nothing else: no axles, springs or shock absorbers, no flames or decals, no number, no roll
bar, no lights, no bumpers, no exhaust, no dirt, no ground, no driver. Twenty-two lines in total.
Count: two wheels, eight tread lines on each.
```

### 7 · `race-car`

Objective: Low sleek body with a spoiler and a number.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the car on the
right. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one race car: a long, low, sleek body with a spoiler at the back and one number on
its side.
- Body: one single smooth outline, about four times as long as it is tall: a low, rounded,
  wedge-shaped nose at the front, a top line that rises gently into a low roof hump a little
  behind the middle, then falls to a short flat tail deck, and an upright back end. Its bottom edge
  is straight except for the two wheel arches. Color: red #d8433b.
- Window: one low side window inside the roof hump, a closed shape with gently rounded corners
  that follows the hump, with a clear strip of red all around it. Color: blue #5b8fc7.
- Spoiler: one closed shape like a capital letter T standing on the tail deck at the very back:
  a short upright post with a flat, level wing across its top. Post and wing are one outline and
  one color, and both are solid parts as thick as three line-widths or more, not thin lines.
  Only the foot of the post touches the body. Color: purple #7b4fa3.
- Number circle: one complete circle on the side of the body, between the two wheel arches and
  below the window, with a clear strip of red all around it. Color: yellow #f7cf46.
- Number: THIS IMAGE CARRIES ONE NUMBER, the single exception to the rule against numbers: the
  digit 7, inside the yellow circle. It is drawn with two straight bold strokes of the same
  charcoal line as the outlines: a level bar across the top and one slanted leg down from the
  bar's right end. No serifs, no crossbar, no outline around the digit. The 7 floats in the circle
  and does not touch its edge.
- Wheels: exactly two, the same size, each about 15% of the image width across. Each wheel
  is two complete circles, one inside the other, sharing one center: the outer circle is the tire
  and the inner circle is the hub, half as wide as the tire. The ring between them is gray #c9ced6;
  the hub is cream #f6e7b8.
  No spokes, no bolts, no tread marks.
- Wheel arches: over each wheel, the body's bottom edge
  rises in a round arch. Between the arch and the tire there is a clear gap of white paper,
  about three line-widths wide and even all the way around.
  No wheel touches or overlaps anything; the lower part of each wheel hangs below the arch.
The whole car fills about 75% of the image width.
Nothing else: no other numbers or letters, no sponsor marks, no stripes or flames, no door lines,
no lights, no exhaust, no driver or helmet, no speed lines, no road. Ten lines in total, counting
the 7 as two.
```

### 8 · `bicycle`

Objective: Two wheels, frame triangle, seat and handlebars.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the bicycle on the
right. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one bicycle, drawn almost entirely with single bold lines.
THIS SUBJECT IS SEE-THROUGH: the wheels and the frame are lines only, and white paper shows inside
the wheels and inside the frame. That is correct here and is the one exception to the rule that
nothing is left white. Do not fill the wheels or the frame with any color.
- Wheels: exactly two, the same size, each one single complete bold circle about 30% of the image
  width across, side by side with a gap between them about a third of a wheel wide. One circle per
  wheel: no second ring for a tire, no spokes.
- Hubs: one small complete circle at the exact center of each wheel, about one eighth as wide as
  the wheel. Color: gray #c9ced6. These are the only filled circles.
- Frame: exactly five single bold straight lines, the same charcoal line as the wheels, with no
  color. Name three points: the PEDAL POINT, midway between the wheels at the height of the hubs;
  the SEAT POINT, above it and a little to the back, level with the top of the wheels; and the
  STEERING POINT, at the same height as the seat point, above the back edge of the front wheel.
  1. seat point down to pedal point;
  2. seat point level across to steering point;
  3. pedal point up to steering point. These three lines make the frame triangle.
  4. back hub level across to pedal point;
  5. back hub up to seat point. These two make a smaller triangle behind the first.
  Lines that meet end exactly at the same point. The lines to the back hub stop at the edge of the
  hub's small circle.
- Fork: one single bold straight line from the edge of the front hub up and slightly backward,
  through the steering point, and on a short way above it.
- Handlebars: one single short bold line across the top end of the fork, level, like the top of
  a letter T.
- Seat: line 1 of the frame carries on a short way above the seat point as the seat post. On top
  of it sits the seat: one small closed shape, flat on top, pointed toward the front and rounded at
  the back. Color: brown #8a5a33.
The whole bicycle fills about 72% of the image width.
Nothing else: no pedals, no chain, no chain ring, no spokes, no fenders, no basket, no bell, no
lights, no kickstand, no grips, no rider, no ground. No frame tube is drawn as a double line or a
colored tube: each is one line. Twelve lines in total: two wheels, two hubs, five frame lines, one
fork, one handlebar, one seat.
```

### 9 · `motorcycle`

Objective: Two wheels, tank, seat, forks and an exhaust.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the motorcycle on the
right. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one motorcycle, simple and chunky like a toy, made of a few solid parts.
- Wheels: exactly two, the same size, each about 24% of the image width across. Each wheel
  is two complete circles, one inside the other, sharing one center: the outer circle is the tire
  and the inner circle is the hub, half as wide as the tire. The ring between them is gray #c9ced6;
  the hub is cream #f6e7b8.
  No spokes, no tread marks, no fenders.
  They stand side by side along the bottom with a gap between them about as wide as one wheel.
- Engine: one box with well rounded corners, low in the middle between the two wheels, about half
  as tall as a wheel, its top edge level with the tops of the tires. There is a clear gap of white
  between it and each wheel. Color: purple #7b4fa3.
- Tank: one closed teardrop shape lying on the front half of the engine's top edge: round and
  high at the front, tapering lower toward the back. Its flat underside and the engine's top edge
  are one shared line, drawn once. Color: red #d8433b.
- Seat: one low closed shape with rounded ends lying on the back half of the engine's top edge,
  directly behind the tank and lower than it, touching the tank end to end and ending level with
  the back of the engine. Color: brown #8a5a33.
- Exhaust: one long straight bar with a rounded back end, as thick as the seat: a solid part,
  not a thin tube. It is attached to the upper back of the engine, below the seat, and points
  backward and slightly upward, passing over the top of the back wheel with a clear gap of white
  between it and the tire. It ends above the back half of the back wheel. Color: yellow #f7cf46.
- Forks: one single bold straight line, the same charcoal line as the outlines, with no color:
  not a tube, not a bar. It starts at the edge of the front wheel's hub and rises leaning
  backward, crossing the front tire, to end a little higher than the top of the tank. It passes
  in front of the tank and the engine with a clear gap of white and touches neither.
- Handlebars: one single short bold line from the top end of the fork line, pointing backward
  and slightly upward, so that fork and handlebar together look like a walking cane.
The whole motorcycle fills about 72% of the image width.
Nothing else: no headlight, no mirrors, no fenders, no license plate, no chain, no footrests, no
kickstand, no engine details, no cooling fins, no stripes on the tank, no smoke, no rider, no
ground. Ten lines in total.
```

### 10 · `ambulance`

Objective: Van with a cross, a stripe, a roof light and two wheels.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front of the ambulance on the
right. No perspective: nothing of the front, the back, the top or the far side shows.
SUBJECT: one ambulance: a van with a tall box at the back and a lower cab at the front, with
exactly one cross, one stripe, one roof light, two windows and two wheels.
- Body: one single outline, about twice as long as it is tall. The back two thirds is a tall box
  with a flat roof and an upright back end. At the front of the box the top line steps down in a
  short slanted windshield line to a low, short hood with a gently rounded nose. All corners are
  gently rounded. Its bottom edge is straight except for the two wheel arches, one under the cab
  and one under the back half of the box. Color: cream #f6e7b8. The body is cream, not white.
- Cab window: one window in the cab, just behind the slanted windshield line: a closed shape
  with gently rounded corners, level along the bottom, upright along its back side, and slanted
  along its front side to follow the windshield line. A clear strip of cream runs all around it.
  Color: blue #5b8fc7.
- Box window: one small square window with gently rounded corners in the upper back corner of
  the box, with a clear strip of cream all around it. Color: blue #5b8fc7.
- Cross: one plain plus sign in the upper half of the box, centered between the two windows: one
  closed outline with twelve straight sides and four equal, thick, short arms, as tall as the
  cab window. It stands upright, not tilted. A clear strip of cream runs all around it: it
  touches nothing. Color: red #d8433b.
- Stripe: one single bold straight line along the side of the body, level, halfway between the
  cross and the wheel arches, running below both windows. It starts and ends a little inside the
  body's outline and touches nothing. It is a line, the same charcoal as the outlines, with no
  color: not a band, not a bar.
- Roof light: one small half-round dome standing on the roof of the box, above its front end:
  flat along the bottom, round on top, about as wide as the cab window is tall. Its flat bottom
  edge and the roof line are one shared line, drawn once. Color: red #d8433b.
- Wheels: exactly two, the same size, each about 17% of the image width across. Each wheel
  is two complete circles, one inside the other, sharing one center: the outer circle is the tire
  and the inner circle is the hub, half as wide as the tire. The ring between them is gray #c9ced6;
  the hub is cream #f6e7b8.
  No spokes, no bolts, no tread marks.
- Wheel arches: over each wheel, the body's bottom edge
  rises in a round arch. Between the arch and the tire there is a clear gap of white paper,
  about three line-widths wide and even all the way around.
  No wheel touches or overlaps anything; the lower part of each wheel hangs below the arch.
The whole ambulance fills about 70% of the image width.
Nothing else: no lettering, no "AMBULANCE" word, no star, snake or heartbeat symbol, no second
cross, no light rays or flashes around the roof light, no siren horns, no door lines, no handles,
no headlights, no bumpers, no mirrors, no antenna, no driver, no road. Ten lines in total. Count:
one cross, one stripe, one roof light, two windows, two wheels.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding shine on the windows, black tires, spokes, a
road or a driver despite the prompts, regenerate rather than keep it.
