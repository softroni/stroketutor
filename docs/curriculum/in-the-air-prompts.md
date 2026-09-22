# In the Air — image-generation prompts

Source art for the ten `in-the-air` lessons (Core level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. `busy-sky` has its own reference line and wants
  the kept `hot-air-balloon`, `airplane` and `drone` attached as well, so make it last.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/in-the-air/<lesson-id>-<model>.png`, and record model,
  date and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **No sky.** Every subject floats on plain white paper: no clouds, sun, birds or motion lines. The
  only air that is drawn is the one an objective names, the jet's vapor trail, as two floating lines.
- **Three views, each chosen so the objective's parts all show flat.** Side view, nose on the right:
  blimp, airplane, helicopter. Front view: hot air balloon, parachute crate. From straight above:
  glider (long wings), drone (four arms as an X), jet (swept wings). The paper airplane is a flat fan
  of three triangles. No ¾ views.
- **Every part has its own dark outline**: windows, canopies, the camera, fins and wings are closed
  shapes; nothing is told apart by color alone. Nothing is white (the airplane and the paper are cream).
- **Ropes, parachute lines, the rotor, the skids, the drone's arms and the vapor trail are single
  lines as bold as the outlines**: never thinner, never a colored tube or ribbon, and only white
  lies on both sides of them. No line crosses a colored area.
- **Wings and fins never overlap a body.** Each is attached along a shared stretch of the body's
  outline, drawn once (one wing above and one below the airplane's tube; a wing on each side of the
  glider and the jet). Those junctions are what to zoom into after tracing.
- **Lines divide a shape in one lesson**, touching its outline on purpose: the balloon's two stripe
  lines. They start and end at separate points and never meet, so no three lines share a point
  (the paper airplane's nose is the one exception, and it is the lesson).
- **Circles touch nothing**, except the drone's rotors, where an arm line ends on each circle's edge:
  the junction to check first after tracing. Windows and the camera keep a strip of color all around.
- **Thin parts have a minimum width** (the glider's wings, the helicopter's boom, the jet's body), so
  their color survives the trace.
- **No dark fills**: nothing large is dark green or brown except the small basket and crate; dark
  solids swallow their outlines.
- **No highlights, shading, texture, flame, smoke or shadow** in any picture: no objective asks for one.
- **Nothing overlaps on this path, not even in the scene**: Busy Sky teaches depth by size alone.

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

For `busy-sky` only (attach the apple and the kept hot air balloon, airplane and drone):

```text
Match the attached apple exactly in line color, line weight, corner rounding, flatness of color
and margins. The other attached images show the hot air balloon, the airplane and the drone of this
course: draw them again here, at the sizes the description gives, the far ones simpler, as the
description says. This image is a small scene, not one subject.
```

## Lesson prompts

### 1 · `paper-airplane`

Objective: Folded dart from three triangles.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat drawing with no perspective: three flat triangles side by side, like a fan that opens
from one point. The plane's nose points to the right and a little upward.
NO SKY: the subject floats on plain white paper. No clouds, no sun, no birds, no ground, no
motion lines, no puffs of wind.
SUBJECT: one folded paper airplane, a dart, made of exactly three triangles. All three triangles
share one corner: the nose, the sharp point at the right. From the nose, exactly four straight
fold lines fan out to the left, and the three triangles are the three spaces between them.
Neighboring triangles share the fold line between them, drawn once.
- Top wing: the biggest triangle, on top. It runs from the nose back to a wing tip high at the upper
  left, the point of the plane that reaches furthest left and highest. Its back edge is one
  straight line. Color: cream #f6e7b8.
- Middle fold: a slim triangle under the top wing, about a third as wide as the top wing at its back
  end, but never narrower than six line-widths there. Its back edge is one short straight line.
  Color: gray #c9ced6.
- Body fold: a medium triangle at the bottom, hanging down under the middle fold, about two thirds
  as long as the top wing, so its back end stops well short of the wing tip. Its back edge is one
  straight line. Color: blue #5b8fc7.
- The three back edges together make one zigzag down the left side of the plane. Every side of every
  triangle is straight, and every corner is only gently rounded.
The whole paper airplane fills about 70% of the image width.
Nothing else: no dashed flight path, no loops, no motion lines, no extra crease lines inside the
triangles, no shading on the folds, no writing on the paper. Seven lines in total: four fold lines
from the nose and three back edges. Count: three triangles.
```

### 2 · `hot-air-balloon`

Objective: Striped balloon with a basket and ropes.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, upright. No perspective.
NO SKY: the subject floats on plain white paper. No clouds, no sun, no birds, no ground, no
motion lines, no puffs of wind.
SUBJECT: one hot air balloon: a striped balloon, a basket under it and exactly two ropes between them.
- Balloon: one closed shape like an upside-down light bulb: a big round top, with sides that narrow
  smoothly downward to a short, flat, level bottom edge (the mouth), about a quarter as wide as the
  balloon. It is a little taller than it is wide. The outline is one smooth curve and the flat
  mouth: no scallops, no bumps, no panels bulging.
- Stripes: exactly two single bold curved lines run down the balloon from its top curve to its
  mouth, dividing it into exactly three upright stripes of about equal width. The two lines are
  mirror images: the left one bows out to the left, the right one bows out to the right, like
  the lines on a beach ball seen from the side. They start at two separate points on the top curve,
  well apart from each other, and they end at two separate points on the mouth edge, splitting it
  in three. They never meet or cross. These lines touch the balloon's outline on purpose, at both ends.
  Stripe colors from left to right: red #d8433b, yellow #f7cf46, red #d8433b.
- Basket: one small closed box under the balloon, centered, a little wider than the mouth and
  a little narrower at its bottom than at its top, with four straight sides. Between the mouth
  and the top of the basket there is a clear gap of white, about as tall as the basket itself.
  Color: brown #8a5a33.
- Ropes: exactly two single bold straight lines, the same charcoal line as the outlines, with no
  color: not tubes, not ribbons. The left rope runs from the left corner of the mouth down to the top
  left corner of the basket; the right rope from the right corner of the mouth down to the top right
  corner of the basket. They lean outward a little going down and do not cross. Only white lies
  between them.
The whole hot air balloon, basket included, fills about 65% of the image's height.
Nothing else: no flame, no burner, no sandbags, no flags or bunting, no weave pattern or rim on the
basket, no people, no clouds, no horizontal bands on the balloon. Six lines in total. Count: three
stripes, two ropes.
```

### 3 · `parachute-crate`

Objective: Dome canopy with lines down to a box.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, upright. No perspective.
NO SKY: the subject floats on plain white paper. No clouds, no sun, no birds, no ground, no
motion lines, no puffs of wind.
SUBJECT: one cargo parachute carrying one crate: a dome canopy at the top, a box at the bottom and
exactly four lines between them.
- Canopy: one closed shape: a wide half-round dome, like the top half of a circle, about twice as
  wide as it is tall. Its bottom edge is not straight: it is made of exactly three shallow arches
  side by side, each curving upward like a bridge, all the same width. The arches meet in exactly
  four points that hang down: one at each end of the dome and two between. The dome's top is one
  smooth curve with no bumps. One flat color, with no panel lines inside. Color: orange #f08a2c.
- Crate: one closed square box with four straight sides, far below the canopy, centered under it,
  about a third as wide as the canopy. Color: brown #8a5a33.
- Plank lines: exactly two single bold straight level lines inside the crate, dividing its height in
  three. Each starts and ends a little inside the crate's outline and touches nothing.
- Lines: exactly four single bold straight lines, the same charcoal line as the outlines, with no
  color: not tubes, not ribbons. Each starts at one of the canopy's four hanging points and runs
  down to the crate's top edge. The two outer lines end exactly on the crate's two top corners. The
  two inner lines end on the crate's top edge, at two separate points between the corners, evenly
  spaced. The four lines lean inward going down; they never cross and never meet each other. Only
  white lies between them. They are about as long as the canopy is wide.
The whole parachute, canopy to crate, fills about 72% of the image's height.
Nothing else: no stripes or panels on the canopy, no vent hole at the top, no person, no straps or
label or arrows on the crate, no nails, no clouds. Eight lines in total. Count: three arches, four
lines, two plank lines.
```

### 4 · `blimp`

Objective: Long oval with tail fins and a small cabin.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the nose) on the right.
No perspective: nothing of the top, the underside, the front, the back or the far side shows.
NO SKY: the subject floats on plain white paper. No clouds, no sun, no birds, no ground, no
motion lines, no puffs of wind.
SUBJECT: one blimp (an airship): a long oval body, exactly two tail fins and one small cabin under it.
- Body: one closed shape, a long smooth oval lying level, about three times as long as it is tall,
  softly rounded at the nose on the right and a little more pointed at the tail on the left. One
  smooth curve, no bumps. Color: blue #5b8fc7.
- Seam line: one single bold straight level line along the side of the body, halfway up, about
  half as long as the body. It starts and ends well inside the body's outline and touches nothing.
  A line with no color.
- Top fin: one closed shape standing on top of the body near the tail: a slanted four-sided fin
  with straight sides, leaning back toward the tail, about a quarter as tall as the body. Its bottom
  edge is the body's outline: fin and body share that stretch of line, drawn once. Color: red #d8433b.
- Bottom fin: the same fin, mirrored, hanging under the body near the tail, straight below the top
  fin, sharing its top edge with the body's outline in the same way. Color: red #d8433b.
- The fins do not overlap the body and nothing of them shows inside the body.
- Cabin: one small closed shape hanging under the middle of the body's belly, a little toward the
  nose: a low box about a fifth as long as the body and about a third as tall as it is long, with
  two rounded bottom corners. Its top edge is the body's outline, shared, drawn once.
  One flat color with no windows. Color: yellow #f7cf46.
- Between the cabin and the bottom fin there is a long stretch of plain belly line.
The whole blimp fills about 72% of the image width.
Nothing else: no windows, no propellers or engines, no ropes, no side fin on the body, no stripes,
no panels or extra seams, no writing or logo on the body, no clouds. Five lines in total. Count:
two fins, one cabin.
```

### 5 · `airplane`

Objective: Tube body with wings, tail and four windows.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the nose) on the right.
No perspective: nothing of the top, the underside, the front, the back or the far side shows.
NO SKY: the subject floats on plain white paper. No clouds, no sun, no birds, no ground, no
motion lines, no puffs of wind.
SUBJECT: one passenger airplane: a tube body, exactly two wings, one tail fin and exactly four windows.
- Body: one closed shape, a long level tube about five times as long as it is tall, with a fully
  rounded nose on the right. Toward the tail on the left the belly line sweeps gently upward to
  meet the straight top line in a blunt rounded end. One smooth outline, no bumps. Color: cream #f6e7b8.
- Near wing: one closed four-sided shape with straight sides, hanging under the middle of the body
  and swept back: it slants down and toward the tail. It is about twice as long as the body
  is tall, and narrower at its tip than where it joins the body. Its top edge is the body's belly line:
  wing and body share that stretch of line, drawn once. The wing does not overlap the body and
  nothing of it shows inside the body. Color: red #d8433b.
- Far wing: the same kind of shape, a little shorter, standing on the body's top line straight
  above the near wing, slanting up and toward the tail. Its bottom edge is the body's top line,
  shared, drawn once. Color: red #d8433b.
- Tail fin: one closed four-sided shape with straight sides standing on the top line at the tail
  end, swept back, about as tall as the body. Its bottom edge is the body's top line, shared, drawn
  once. Between the tail fin and the far wing there is a long stretch of plain top line.
  Color: red #d8433b.
- Windows: exactly four complete circles in one level row along the side of the body, all the same
  size, evenly spaced, each about a third as tall as the body. The row sits between the nose and
  the tail fin. Every window floats: a strip of the body's cream shows all around it, and it
  touches no outline, no wing and no other window. The gap between two windows is at least as wide
  as a window. Color: blue #5b8fc7.
The whole airplane fills about 75% of the image width.
Nothing else: no cockpit window, no door, no engines under the wing, no small tail wings, no
wheels, no stripe along the body, no writing or logo, no propeller, no clouds. Eight lines in
total. Count: four windows, two wings, one tail fin.
```

### 6 · `glider`

Objective: Slim body with long, thin wings.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat view from straight above, looking down on the glider, as on a map. The nose points
straight up to the top of the image. The left half and the right half are mirror images. No
perspective.
NO SKY: the subject floats on plain white paper. No clouds, no sun, no birds, no ground, no
motion lines, no puffs of wind.
SUBJECT: one glider (a sailplane with no engine): a slim body, exactly two long, thin wings, exactly
two small tail wings and one canopy.
- Body: one closed shape, upright, long and slim like a stretched teardrop: a rounded nose at the
  top, widest a quarter of the way down, then narrowing steadily to a small blunt end at the bottom
  (the tail). About eight times as long as it is wide at its widest, and never narrower than five
  line-widths. Color: orange #f08a2c.
- Wings: exactly two closed shapes, one on each side of the body, a third of the way down from the
  nose, reaching straight out to the left and to the right, level. Each wing is long and thin with
  straight front and back edges, a little narrower at its rounded tip than at the body, and about
  as long as the whole body. Each wing is at least six line-widths wide at the body and at least four
  at the tip, so that its color shows clearly. Where a wing joins the body, its inner end is the
  body's outline: wing and body share that stretch of line, drawn once. The wings do not cross
  over the body and nothing of them shows inside the body. Color: yellow #f7cf46.
- Tail wings: exactly two small closed shapes, one on each side of the body just above its bottom
  end, shaped like the wings but only about a fifth as long. Each shares its inner end with the
  body's outline in the same way. Color: yellow #f7cf46.
- Canopy: one small closed upright oval floating inside the body near the nose, between the nose
  and the wings. A strip of the body's orange shows all around it and it touches nothing.
  Color: blue #5b8fc7.
From wing tip to wing tip the glider fills about 78% of the image width.
Nothing else: no propeller, no engine, no wheels, no stripes, no flaps or lines on the wings, no
numbers or writing, no tow rope, no clouds. Six lines in total. Count: two wings, two tail wings.
```

### 7 · `helicopter`

Objective: Bubble cabin, tail boom, rotor and skids.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on from the side, with the front (the nose) on the right.
No perspective: nothing of the top, the underside, the front, the back or the far side shows.
NO SKY: the subject floats on plain white paper. No clouds, no sun, no birds, no ground, no
motion lines, no puffs of wind.
SUBJECT: one small helicopter: a bubble cabin, a tail boom, a rotor on top and skids underneath.
- Cabin: one closed shape like a big egg lying on its side, the rounder, bigger end at the front
  (right). One smooth curve, no bumps. About one and a half times as long as it is tall.
  Color: red #d8433b.
- Window: one closed shape floating inside the front half of the cabin: like a quarter of a pie
  with every corner well rounded, its curved side following the cabin's nose. A strip of the
  cabin's red, at least three line-widths wide, shows all around it; it touches nothing.
  Color: blue #5b8fc7.
- Tail boom: one closed shape, a long slim bar reaching level from the upper back of the cabin to
  the left, about one and a half times as long as the cabin, a little narrower toward its rounded
  far end, and never narrower than five line-widths. Its right end is the cabin's outline: boom
  and cabin share that stretch of line, drawn once. Color: orange #f08a2c.
- Rotor: exactly two single bold straight lines, the same charcoal line as the outlines, with no
  color: not blades with a shape, not tubes. A short upright mast line stands on the very top of the
  cabin. A long level blade line lies across the top of the mast, its middle on the mast's top
  end, like a wide capital T. The blade line is about twice as long as the cabin and touches
  nothing but the mast. Between the blade line and the tail boom there is clear white.
- Skids: exactly three single bold lines under the cabin, with no color. One long level skid line
  lies below the belly, a little longer than the cabin, its front end (right) curling gently
  upward like the tip of a ski. Exactly two short straight strut lines join the cabin's belly to
  the skid line, one toward the front and one toward the back, leaning slightly apart. Between the
  belly and the skid line there is a clear gap of white, about five line-widths tall.
The whole helicopter, rotor and tail included, fills about 75% of the image width.
Nothing else: no tail rotor, no tail fin, no door, no second window, no wheels, no lights, no
stripes, no writing, no spinning blur or motion lines around the rotor, no pilot, no clouds. Eight
lines in total. Count: one mast and one blade line, one skid and two struts.
```

### 8 · `drone`

Objective: Quadcopter with four arms, rotors and a camera.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat view from straight above, looking down on the drone, as on a map. The drone looks
the same turned a quarter turn: the four arms make a big letter X. No perspective.
NO SKY: the subject floats on plain white paper. No clouds, no sun, no birds, no ground, no
motion lines, no puffs of wind.
SUBJECT: one quadcopter drone: a body in the middle, exactly four arms, exactly four rotors and
one camera.
- Body: one closed square with well-rounded corners, in the center of the image, its sides level
  and upright, about a quarter as wide as the whole drone. Color: purple #7b4fa3.
- Camera: one small complete circle floating in the very middle of the body, about a third as
  wide as the body. A strip of the body's purple shows all around it; it touches nothing.
  Color: blue #5b8fc7.
- Rotors: exactly four complete circles, all the same size, each a little smaller than the body,
  one out beyond each corner of the body: upper left, upper right, lower left, lower right. Each
  rotor is well clear of the body and of the other rotors. Color: gray #c9ced6.
- Blades: inside each rotor circle, exactly one single bold straight line through the middle of
  the circle, slanted, like a propeller seen from above. It starts and ends a little inside the
  circle and touches nothing. All four blade lines slant the same way: from lower left to upper
  right. Lines with no color.
- Arms: exactly four single bold straight lines, the same charcoal line as the outlines, with no
  color: not bars, not tubes. Each arm runs diagonally from one rounded corner of the body outward
  to the nearest rotor circle. It starts exactly on the body's outline and ends exactly on the
  circle's outline: it does not go inside the body or inside the circle. Each arm is about as long
  as the body is wide. Only white lies on both sides of an arm.
The whole drone fills about 70% of the image.
Nothing else: no legs or landing feet, no antenna, no lights, no rings of motion around the rotors,
no second blade in a rotor, no detail inside the camera circle, no package, no shadow, no clouds.
Fourteen lines in total. Count: four arms, four rotors, four blade lines, one camera.
```

### 9 · `jet`

Objective: Pointed body with swept wings and a vapor trail.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat view from straight above, looking down on the jet, as on a map. The jet flies level
to the right: its nose points straight to the right side of the image. The upper half and the
lower half are mirror images. No perspective.
NO SKY: the subject floats on plain white paper. No clouds, no sun, no birds, no ground, no
motion lines, no puffs of wind.
SUBJECT: one jet with a vapor trail: a pointed body, exactly two swept wings, exactly two small
tail wings, one canopy, and behind it exactly two trail lines.
- Body: one closed shape, long, slim and level, like a dart: a sharp pointed nose at the right
  (only gently rounded), widest in the middle, narrowing a little to a flat, blunt tail end at the
  left. About seven times as long as it is wide, and never narrower than six line-widths.
  Color: gray #c9ced6.
- Wings: exactly two closed triangles with straight sides, one on the upper side of the body and
  one on the lower side, mirror images. Each is swept back: its front edge slants from the middle
  of the body outward and back toward the tail, to a wing tip that lies further left than where the
  wing began; its back edge runs from the tip straight in to the body. Each wing reaches out about
  one third of the body's length. Its inner side is the body's outline: wing and body share that
  stretch of line, drawn once. The wings do not cross over the body. Color: red #d8433b.
- Tail wings: exactly two small closed triangles, shaped like the wings but about a third their
  size, one on each side of the body at the tail end, sharing their inner side with the body's
  outline in the same way. Between a tail wing and the wing in front of it there is a clear stretch
  of plain body outline. Color: red #d8433b.
- Canopy: one small closed level oval, pointed a little toward the nose, floating inside the body
  between the nose and the wings. A strip of the body's gray shows all around it and it touches
  nothing. Color: blue #5b8fc7.
- Vapor trail: exactly two single bold straight level lines behind the jet, to the left of its tail,
  the same charcoal line as the outlines, with no color: not clouds, not puffs, not ribbons, not
  dashed. They are parallel, one a little above the body's center line and one the same distance
  below it, about as far apart as the body is wide. Each is about one third as long as the body.
  Between the tail end and the start of each trail line there is a clear gap of white, about five
  line-widths. The trail lines touch nothing.
The whole picture, jet and trail together, fills about 80% of the image width.
Nothing else: no flame, no smoke puffs, no clouds, no missiles or tanks under the wings, no tail
fin seen from the side, no stripes, stars, numbers or markings, no panel lines, no motion lines other
than the two trail lines. Eight lines in total. Count: two wings, two tail wings, two trail lines.
```

### 10 · `busy-sky` — superseded 2026-09-21

The prompt below was not used. The creator made a different scene — sun, cloud, the balloon of
lesson 2, a pine tree and a grassy hill — and asked for the lesson to be renamed to fit it. The
tenth lesson is now `balloon-over-the-hill`, "Balloon Over the Hill", objective "Sun, cloud, balloon
and pine tree in one scene", and its picture is `in-the-air/balloon-over-the-hill-openai.png`. The
prompt is kept as the record of what was asked for.

Objective: Balloon, airplane and drone at different sizes for depth.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat drawing with no perspective lines. Depth comes only from size: the biggest thing looks
nearest and the smallest looks furthest away. Each thing is drawn in the same view as in its own
image of this course (attached).
SUBJECT: a small sky scene made of exactly three separate flying things at three clearly different
sizes: one big drone, one medium hot air balloon and one small airplane. Nothing overlaps anything:
a clear gap of white, at least eight line-widths, lies between every two things. The far things
are drawn simpler, but every line in the image keeps the same bold weight: the small airplane's
lines are as bold as the big drone's.
LAYOUT: the drone fills the lower left of the image. The hot air balloon floats at the right, its
top a little above the middle of the image's height. The airplane is high in the upper left, above
the drone.
- Drone, the nearest and biggest, about 48% of the image width across, seen from straight above
  with its four arms making a letter X: a square body with well-rounded corners, purple #7b4fa3;
  one small complete circle floating in the middle of the body for the camera, blue #5b8fc7; exactly
  four complete rotor circles of the same size, one out beyond each corner of the body, gray #c9ced6,
  with nothing inside them; exactly four single bold straight arm lines with no color, each from a
  corner of the body to the nearest rotor circle, starting exactly on the body's outline and ending
  exactly on the circle's outline.
- Hot air balloon, in the middle distance, about 36% of the image height tall from its top to the
  bottom of its basket, upright: a balloon like an upside-down light bulb with a short flat mouth
  at the bottom; exactly two single bold curved lines from its top curve down to its mouth, mirror
  images that never meet, dividing it into exactly three upright stripes colored red #d8433b,
  yellow #f7cf46, red #d8433b from left to right; a small box basket below, brown #8a5a33, with a
  clear gap of white between mouth and basket; exactly two single bold straight rope lines with no
  color, from the mouth's two corners down to the basket's two top corners.
- Airplane, the furthest and smallest, about 24% of the image width long, a flat side view with its
  nose on the right: a level tube body with a rounded nose, cream #f6e7b8; one swept-back wing
  hanging under the middle of the body and one standing on top of it straight above, each sharing
  one edge with the body, red #d8433b; one swept-back tail fin standing on the top line at the tail,
  red #d8433b. It is too far away to show windows: no windows here.
The whole scene fills about 82% of the image, with clear white margin on all four sides.
Nothing else: no clouds, no sun, no birds, no ground, no horizon, no buildings, no kites, no blade
lines in the rotors, no flame in the balloon, no motion lines, no people. Twenty lines in total:
ten for the drone, six for the balloon, four for the airplane. Count: three things, three sizes.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding clouds, motion lines, a flame in the balloon,
shine on the windows or a spinning blur on the rotors despite the prompts, regenerate rather than keep it.
