# Sports — image-generation prompts

Source art for the ten `sports` lessons (Core level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. For `sports-bag`, also attach the kept
  `basketball` and `tennis-racket` pictures, and use that lesson's own reference line.
- Square, 1024 × 1024 or larger, PNG, opaque white background. Make `tennis-racket` and `sports-bag`
  as large as the tool allows: their string grids need the pixels.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/sports/<lesson-id>-<model>.png`, and record model, date and
  prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Every lesson is a flat view, seen straight on**: side views for the roller skate and the helmet,
  front views for the rest. Only the last lesson is seen from slightly above, like the fruit bowl,
  so that the open bag has a mouth.
- **Every part has its own dark outline**: pentagons, rings, finger holes, vents, the buckle, the
  toe stop and the shadow are closed shapes; nothing is told apart by color alone.
- **Parts touch only where one is attached to another**, and then along a shared edge drawn once
  (knob on bat, throat on racket head, blade on shaft, plate under boot, stem under cup). The bat
  and its ball, the pin and its ball, the stick and its puck stand apart with a wide white gap.
- **Details are single bold lines**: seams, stitches, strings, grip wrap, laces and the chin strap
  are charcoal lines of the outline's weight, never cords, tubes or ribbons. Stitches are charcoal,
  not red: the course has no colored lines.
- **Most detail lines float.** The ones that touch on purpose: the soccer ball's five seam lines
  (corner of the pentagon to the point of a patch), the pin's four ring lines (edge to edge), the
  skate's truck lines and the helmet's two strap lines.
- **Lines cross in two places only, because the objectives ask for it**: the basketball's seams
  (two crossings) and the racket's string grid. Every other line crosses nothing.
- **Balls are a little smaller than 70%**, as one big round shape reads larger than it measures.
- **Dark things are purple, never charcoal**: the soccer ball's patches, the finger holes, the
  puck's side, the vents, the inside of the bag. A solid dark shape swallows its own outline when
  traced.
- **White balls and the white pin are cream**: nothing inside a subject may be white. The one
  exception is the racket's string bed, which is see-through like the bicycle on the Wheels path;
  its prompt says so.
- **One shadow on the whole path**, under the soccer ball, because its objective asks for one. It
  has its own outline and floats clear of the ball, so the ball's circle stays whole.
- **No highlights, shading, texture or shadow anywhere else**: no shine on a ball or the trophy, no
  pebble grain on the basketball, no wood grain on the bat, no fabric texture on the bag.
- **No logos, letters or numbers** on anything: no brand on a ball, no plaque text on the trophy.
- **No living things**: no head in the helmet, no foot in the skate, no hands.

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

For `sports-bag` only (apple attached, and the kept basketball and tennis racket pictures):

```text
Match the first attached image exactly in line color, line weight, corner rounding and flatness of
color. This image is a small scene, not one subject, so the margins are smaller. The other attached
images show what the basketball and the tennis racket look like: draw them the same, smaller, in
the places the description gives.
```

## Lesson prompts

### 1 · `soccer-ball`

Objective: Ball with a center pentagon and five around it, with a curved shadow.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on. The ball is in the air, just above the ground.
SUBJECT: one soccer ball with exactly one center pentagon and exactly five dark patches around it,
and exactly one shadow on the ground below it. This image does have one shadow, exactly as
described here.
- Ball: one perfect circle, about 56% of the image width. Color: cream #f6e7b8.
- Center pentagon: exactly one regular pentagon with five straight sides, one corner pointing
  straight up, in the very middle of the ball. It is a little more than a quarter as wide as the
  ball. Color: purple #7b4fa3.
- Seam lines: exactly five short straight lines, single bold lines in the same charcoal as the
  outlines. One starts exactly on each corner of the center pentagon and runs straight outward,
  away from the middle of the ball, like the arms of a starfish. Each is about as long as one
  side of the pentagon and ends well short of the ball's outline.
- Edge patches: exactly five, one at the outer end of each seam line. Each patch is a pentagon
  that is cut off by the edge of the ball, so only its inner part shows: a wide, blunt triangle
  whose point is exactly the end of the seam line, whose two straight sides spread apart and run
  out to the ball's outline, and whose third side is the ball's outline itself, one line drawn
  once. All five are the same size. Between two neighboring patches a stretch of cream rim shows,
  about half as long as a patch is wide. Color: purple #7b4fa3.
- Shadow: exactly one very flat ellipse lying on the ground straight below the ball, about two
  thirds as wide as the ball and about a tenth as tall as it is wide. It floats: a clear gap of
  white, at least four line-widths tall, lies between the bottom of the ball and the top of the
  shadow. It has the same bold dark outline as everything else. Color: gray #c9ced6.
The ball and its shadow together fill about 68% of the image height.
Nothing else: no hexagon outlines, no other seam lines, no shine spot, no shading on the ball, no
ground line, no grass, no goal, no motion lines, no second shadow. About eighteen lines in total.
Count: one center pentagon, five seam lines, five edge patches, one shadow.
```

### 2 · `basketball`

Objective: Ball with two curved seam lines crossing a straight one.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on.
SUBJECT: one basketball with exactly three seam lines: exactly one straight line and exactly two
curved lines that cross it.
- Ball: one perfect circle, about 60% of the image width. Color: orange #f08a2c.
- Seam lines: single bold lines in the same charcoal as the outline, the same weight, never
  thinner, never doubled.
  1. The straight seam: exactly one level straight line across the very middle of the ball, from
     just inside the left side of the outline to just inside the right side.
  2. The left curved seam: exactly one smooth curve shaped like a closing bracket ). It starts just
     inside the outline at the upper left, halfway between the top of the ball and its leftmost
     point, bows gently toward the middle of the ball, crosses the straight seam halfway between
     the middle of the ball and the left end of the straight seam, and ends just inside the
     outline at the lower left.
  3. The right curved seam: the mirror image of the left one, shaped like an opening bracket (.
  The two curved seams each cross the straight seam once, at a clear right angle: these two
  crossings are the only places where lines cross or touch. The curved seams never touch each
  other; a wide band of orange lies between them. Every end of every seam stops a little short
  of the ball's outline: a strip of orange about two line-widths wide lies between the end and
  the outline.
Nothing else: no upright seam down the middle, no fourth line, no pebble texture, no dots, no
shine spot, no shading, no logo, no lettering, no hoop, no shadow. Four lines in total.
Count the seams: one straight, two curved.
```

### 3 · `bat-and-ball`

Objective: Tapered bat with a knob beside a ball with two curved rows of stitches.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, as if the bat and the ball lay on a sheet of paper.
SUBJECT: one baseball bat with exactly one knob, and beside it one baseball with exactly two
curved rows of stitches. The bat and the ball do not touch.
- Bat: one long closed shape lying on the diagonal, its handle end at the lower left and its
  thick end at the upper right, leaning about 50 degrees up from level. It tapers: narrow and
  even along the handle, then swelling smoothly to a thick barrel about three times as wide as
  the handle, ending in a rounded tip. Both long sides are smooth, simple curves. The bat is
  about 80% of the image's diagonal in length. Color: brown #8a5a33.
- Knob: exactly one small flattened oval across the handle's lower left end, like the head of a
  nail, about twice as wide as the handle. It is attached to the handle: they share one short
  edge, drawn once. Color: orange #f08a2c.
- Ball: one perfect circle in the empty lower right corner, below the barrel, about 27% of the
  image width. A clear gap of white, at least five line-widths wide, lies between the ball and
  the bat everywhere. Color: cream #f6e7b8.
- Stitches: exactly two curved rows, one in the left half of the ball and one in the right half,
  as in a mirror. Each row is exactly five short straight marks, single bold lines in the same
  charcoal as the outlines, each about four line-widths long. The five marks of a row lie one
  above the other like the rungs of a ladder, along a curve that bows toward the middle of the
  ball: the left row follows the shape of a closing bracket ), the right row an opening
  bracket (. Each mark lies across that curve, and the marks fan slightly to follow it. There is
  NO seam line: the curve itself is not drawn, only the ten marks. Every mark floats: it touches
  neither the ball's outline nor another mark, with a clear gap of cream at least two
  line-widths wide between neighbors.
The bat and the ball together fill about 72% of the image.
Nothing else: no seam curve, no V-shaped stitches, no red thread, no grip tape, no wood grain, no
ring or label on the bat, no logo, no glove, no shadow. Thirteen lines in total. Count: one knob,
two rows, five marks in each row, ten marks in all.
```

### 4 · `tennis-racket`

Objective: Oval head with a crosshatched string grid and a wrapped grip.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
This applies to the strings and the wrap lines most of all: they are exactly as bold as the
outlines.
VIEW: a flat front view, seen straight on, the racket standing upright with its head at the top.
SUBJECT: one tennis racket: an oval head with a string grid of exactly four upright and exactly
four level strings, a throat, and a grip with exactly four wrap lines.
- Head: an upright oval frame drawn with exactly two ovals, one inside the other, the same shape,
  with an even band between them about four line-widths wide all around. The outer oval is about
  38% of the image width and 46% of its height. Color of the band: red #d8433b.
- String bed: the area inside the inner oval is see-through and stays plain white, like the
  paper. This is the one exception to the rule that nothing is left white.
- Strings: exactly four upright straight lines and exactly four level straight lines inside the
  inner oval, evenly spaced, forming a grid of squares. They are single bold charcoal lines, the
  same weight as the outlines. The strings cross one another; nowhere else in the image do lines
  cross. Every string floats at both ends: it stops a little short of the inner oval, with a gap
  of white about two line-widths wide, so the outer strings are shorter than the middle ones.
  The gaps between neighboring strings are wide: at least five line-widths.
- Throat: exactly one small closed shape under the head, like a funnel: its top side is a stretch
  of the head's outer oval at its lowest point (one shared line, drawn once), and its two
  straight sides lean toward each other down to the width of the grip. It is solid, with no
  hole in it, about 9% of the image height tall. Color: gray #c9ced6.
- Grip: exactly one tall narrow rounded rectangle straight under the throat, about 7% of the
  image width and 25% of its height. Its top side is the throat's bottom side: one shared line.
  Its bottom corners are rounded. Color: blue #5b8fc7.
- Wrap lines: exactly four short slanted lines inside the grip, parallel, evenly spaced from top
  to bottom, all leaning the same way (like /). Single bold charcoal lines. Each floats: it
  starts and ends a little inside the grip's outline and touches nothing.
The racket fills about 80% of the image height and stands in the middle.
Nothing else: no ball, no open triangle in the throat, no butt cap, no bumper strip, no
logo or letter on the strings, no shine, no shadow. Sixteen lines in total. Count: four upright
strings, four level strings, four wrap lines.
```

### 5 · `bowling-pin`

Objective: Pin with a narrow neck and two red rings, a ball beside it.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on.
NO GROUND: the pin and the ball stand on nothing. No ground line, no lane, no shadow. The pin's
flat bottom and the lowest point of the ball are at the same height.
SUBJECT: one bowling pin with a narrow neck and exactly two red rings, and beside it one bowling
ball. The pin and the ball do not touch.
- Pin: one tall upright shape, the same on the left and on the right, on the left of the image.
  From the top down: a small round head, a narrow neck about two thirds as wide as the head, a
  long smooth swelling to a wide belly about twice as wide as the head (widest in the lower
  third), then narrowing a little to a short flat level bottom edge. Both sides are smooth,
  simple curves. About 70% of the image height tall and 21% of the image width at the belly.
- Rings: exactly four level lines cross the neck from the pin's left side to its right side,
  one above the other, evenly spaced about three line-widths apart. They are single bold
  charcoal lines, nearly straight, and each touches the pin's outline exactly at both ends.
  They divide the pin into five areas. From the top down: the head, cream #f6e7b8; the first
  ring, red #d8433b; a band between the rings, cream #f6e7b8; the second ring, red #d8433b; the
  body, cream #f6e7b8. So there are exactly two red rings, with one cream band between them.
- Ball: one perfect circle on the right of the pin, about 36% of the image width, a little more
  than half as tall as the pin. A clear gap of white, at least five line-widths wide, lies
  between the ball and the pin. Color: blue #5b8fc7.
- Finger holes: exactly three small circles on the ball, in its upper middle, set as a small
  triangle: two side by side and one centered below them. Each is about a seventh as wide as the
  ball, a complete circle with its own bold outline. They float: a clear strip of blue, at least
  three line-widths wide, lies between any two of them and between them and the ball's outline.
  Color: purple #7b4fa3.
The pin and the ball together fill about 70% of the image, in the middle.
Nothing else: no second pin, no third ring, no crown or logo on the pin, no swirl or marbling on
the ball, no shine spot, no shading, no lane, no arrows, no shadow. Nine lines in total. Count:
two red rings, one ball, three finger holes.
```

### 6 · `hockey-stick`

Objective: Long shaft with an angled blade and a puck drawn as a flat cylinder.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view of the stick, seen straight on. Only the puck is seen from slightly
above, so that its top shows as a flat ellipse.
NO GROUND: no ice, no ground line, no shadow. The blade's bottom edge and the puck's lowest
point are at the same height.
SUBJECT: one ice hockey stick with a long shaft and one angled blade, and beside it one puck
drawn as a flat cylinder. The stick and the puck do not touch.
- Shaft: one long, narrow, straight bar, the same width all along (about 4.5% of the image
  width), leaning: its top end is at the upper left and its bottom end is lower and further
  right, about 65 degrees up from level. The top end is closed with a short, slightly rounded
  edge. The shaft is about 70% of the image height tall. Color: brown #8a5a33.
- Blade: one closed shape attached to the shaft's bottom end and pointing to the right, lying
  level: about a quarter as long as the shaft, about one and a half times as tall as the shaft
  is wide, with a flat level bottom edge and a rounded tip that turns up very slightly. The
  blade meets the shaft at a clear wide angle, like the foot of a letter L opened out. Where
  they meet, they share one short straight edge, drawn once: the shaft's bottom end.
  Color: orange #f08a2c.
- Puck: one flat cylinder to the right of the blade's tip, about 20% of the image width. It is
  drawn with exactly four lines: one complete flat ellipse for the top (about a quarter as tall
  as it is wide); one short upright straight line down from the ellipse's leftmost point and one
  from its rightmost point, both the same length, about as long as the ellipse is tall; and one
  curve joining their lower ends, which is the front half of the same ellipse. Nothing of the
  back of the bottom is drawn. A clear gap of white, at least four line-widths wide, lies
  between the puck and the blade. Color of the top: gray #c9ced6. Color of the side:
  purple #7b4fa3.
The stick and the puck together fill about 72% of the image width, in the middle.
Nothing else: no tape on the blade, no tape or knob at the top of the shaft, no stripes, no
lettering, no logo, no ice, no skate marks, no motion lines, no goal, no shadow. Six lines in
total. Count: one shaft, one blade, one puck.
```

### 7 · `roller-skate`

Objective: Laced boot on a plate with four wheels and a toe stop.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on, the toe pointing to the right. No perspective: a
roller skate has four wheels, two on each side, and from the side only the two near wheels show,
each hiding the one behind it exactly. Draw exactly two wheels.
NO GROUND: the wheels stand on nothing. No ground line, no shadow.
SUBJECT: one classic roller skate from the side: one laced boot on one plate, with wheels and
exactly one toe stop.
- Boot: one closed shape, a high-top boot. Its back is nearly upright; its top is a short level
  edge; from the front of the top the outline comes down at a slant over the front of the ankle,
  runs forward along the top of the foot and rounds over the toe; its bottom is one straight
  level edge from heel to toe. No separate heel, no sole, no tongue, no cuff. About 55% of the
  image width and 42% of its height. Color: red #d8433b.
- Laces: exactly four short straight lines inside the boot, along its slanted front, one above
  the other, parallel and evenly spaced, like the rungs of a ladder. Single bold charcoal lines,
  the same weight as the outlines, each about five line-widths long. Each floats: it touches
  neither the boot's outline nor another lace. No bow, no eyelets, no crossing laces.
- Plate: one long, thin, level bar straight under the boot, exactly as long as the boot's bottom
  edge, about 3.5% of the image height tall, with rounded ends. Its top side is the boot's bottom
  edge: one shared line, drawn once. Color: blue #5b8fc7.
- Wheels: exactly two complete circles of the same size, each about 16% of the image width, under
  the plate: the back one under the heel, a fifth of the way along the plate, and the front one
  two thirds of the way along. A clear gap of white, about as tall as the plate, lies between the
  top of each wheel and the plate. Plain circles, with no hub and no spokes. Color:
  yellow #f7cf46.
- Trucks: exactly two, one above each wheel, joining it to the plate. Each truck is drawn with
  exactly two short straight lines that start on the plate's bottom edge and come down, leaning
  toward each other, to end exactly on the wheel's circle. The wheel stands in front of the
  truck, so the truck has no bottom line: the small area between the plate, the two lines and
  the top of the wheel is the truck. It is a little narrower than the wheel. Color:
  gray #c9ced6.
- Toe stop: exactly one small rounded block hanging under the very front end of the plate, ahead
  of the front wheel, leaning forward a little, about a third as tall as a wheel. Its top side is
  a short stretch of the plate's bottom edge: one shared line. A clear gap of white, at least
  three line-widths wide, lies between it and the front wheel. Color: orange #f08a2c.
The whole skate fills about 70% of the image, in the middle.
Nothing else: no second pair of wheels peeking out, no hubs, no bolts, no stripes or stars on
the boot, no bow, no sock, no foot, no leg, no motion lines, no ground, no shadow. Thirteen lines
in total. Count: four laces, one plate, two wheels showing, two trucks, one toe stop.
```

### 8 · `helmet`

Objective: Rounded bike helmet with three vent slots and a chin strap.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on, the front of the helmet pointing to the right. No
perspective: nothing of the inside or the underside of the helmet shows.
SUBJECT: one bicycle helmet with exactly three vent slots and exactly one chin strap. No head.
- Shell: one closed shape, rounded like half an egg lying on its side. A smooth, high curve goes
  over the top; the front, on the right, is blunt and round; the back, on the left, is drawn
  out a little into a soft rounded tail; the bottom is one nearly level, very slightly curved
  edge. About 68% of the image width and 36% of its height, in the upper part of the image.
  Color: leaf green #4f9d4a.
- Vent slots: exactly three closed shapes inside the shell, each like a slim leaf with two
  pointed ends: long, narrow, about a quarter as long as the shell and four line-widths wide at
  its middle. They lie side by side across the upper middle of the shell, parallel, evenly
  spaced, all leaning back the same way (their top ends further left than their bottom ends).
  They float: a clear strip of green, at least four line-widths wide, lies between two
  neighbors and between every slot and the shell's outline. Color: purple #7b4fa3.
- Chin strap: exactly two straight lines and one buckle, hanging under the shell like a letter
  V. The lines are single bold charcoal lines, the same weight as the outlines: not bands, not
  ribbons, no color. The front line starts exactly on the shell's bottom edge, a quarter of the
  way in from the front, and runs down and back; the back line starts exactly on the bottom
  edge, a quarter of the way in from the back, and runs down and forward. They end on the
  buckle, one on its right end and one on its left end, without touching each other.
- Buckle: exactly one small rounded rectangle, lying level, under the middle of the shell, about
  8% of the image width and half as tall, well below the shell: the strap hangs down about as
  far as the shell is tall. Color: yellow #f7cf46.
The white area inside the V of the strap is plain paper. The helmet with its strap fills about
70% of the image, in the middle.
Nothing else: no visor, no rim band, no fourth slot, no adjuster dial, no padding, no second
strap, no stripes, no stickers, no logo, no head, no face, no shadow. Seven lines in total.
Count: three vent slots, two strap lines, one buckle.
```

### 9 · `trophy`

Objective: Cup with two curved handles on a stem and a two-tier base.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the same on the left and on the right. No
perspective: the cup's rim is one level straight line, and nothing of the inside of the cup or
of the tops of the base shows.
NO GROUND: the base stands on nothing. No table, no ground line, no shadow.
SUBJECT: one trophy: exactly one cup with exactly two curved handles, on exactly one stem, on a
base with exactly two tiers.
- Cup: one closed shape like a wide letter U with a lid line: a level straight rim along the top,
  and two sides that come down and curve inward to a narrow rounded bottom. About 38% of the
  image width and 30% of its height. Color: yellow #f7cf46.
- Handles: exactly two, as in a mirror, one on each side of the cup. Each is one closed band,
  about three line-widths thick, bowed outward like an ear or the handle of a mug. Its top end is
  attached to the cup's side a little below the rim and its bottom end two thirds of the way
  down the cup; each end shares a short stretch of the cup's outline. Between the handle and the
  cup an area of plain white paper shows through, wider than the band. Color: orange #f08a2c.
- Stem: exactly one small upright shape under the middle of the cup, narrow at the top and
  flaring a little toward the bottom, with straight sides, about 12% of the image height tall.
  Its top side is the cup's bottom outline: one shared line. Color: orange #f08a2c.
- Base, upper tier: exactly one level rectangle with gently rounded corners under the stem,
  about 22% of the image width and 6% of its height. Its top side carries the stem: one shared
  line where they meet. Color: gray #c9ced6.
- Base, lower tier: exactly one level rectangle straight under the upper tier, wider and a
  little taller: about 34% of the image width and 8% of its height. Its top side is partly the
  upper tier's bottom side: one shared line. Color: brown #8a5a33.
The handles touch only the cup: a clear gap of white lies between them and the stem. The trophy
fills about 72% of the image height, in the middle.
Nothing else: no star, no number, no plaque, no lettering, no lid, no ribbons, no laurel, no
shine lines, no sparkles, no ellipse for the cup's opening, no shadow. Six lines in total.
Count: one cup, two handles, one stem, two tiers.
```

### 10 · `sports-bag`

Objective: Open bag with a ball, a racket and a water bottle in one scene.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
This applies to the strings and the seams most of all: they are exactly as bold as the outlines.
VIEW: this one image is a small scene, seen from slightly above, so the open mouth of the bag is
a flat ellipse. The things in the bag are drawn in flat front views, as in their own lessons.
NO GROUND: the bag stands on nothing. No floor, no ground line, no shadow.
SUBJECT: one open sports bag with exactly three things standing in it, side by side: one
basketball, one tennis racket and one water bottle. Overlap is what this lesson teaches: the
front edge of the bag's mouth passes in front of the lower part of each of the three things and
hides it. Nothing else overlaps: the three things do not touch or overlap one another, and a
clear gap of white, at least three line-widths wide, lies between neighbors.
- Bag body: one wide closed shape in the lower half of the image: two nearly upright sides, a
  level bottom edge with well rounded corners, and along the top the front edge of the mouth, a
  gentle curve sagging in the middle. About 76% of the image width and 34% of its height.
  Color: blue #5b8fc7.
- Mouth: one very flat ellipse lying across the top of the body, as wide as the body. Its front
  half is the body's top edge: one shared line, drawn once. Its back half shows only in the
  stretches between and beside the three things; behind them it is hidden. The inside of the
  bag, seen through the mouth around the three things, is one flat dark area.
  Color: purple #7b4fa3.
- Handle: exactly one closed band on the front of the body, shaped like a wide letter U, about
  three line-widths thick, with rounded ends. It floats in the blue: a clear strip of blue, at
  least four line-widths wide, lies between it and the body's outline all around.
  Color: yellow #f7cf46.
- Basketball, on the left: one circle, about 22% of the image width, its lower third hidden in
  the bag. Exactly three seam lines as in the attached basketball picture: one level straight
  line across the middle and two curved lines, like ) on the left and ( on the right, each
  crossing the straight one once. Every seam end stops a little short of the circle.
  Color: orange #f08a2c.
- Tennis racket, in the middle: its head and the top of its throat stand up out of the bag, as
  in the attached racket picture but smaller; the rest of the throat and the grip are hidden in
  the bag. The head is an upright oval frame drawn with two ovals, with an even band about three
  line-widths wide between them, about 22% of the image width and 30% of its height. Color of
  the band: red #d8433b. Inside the inner oval the strings are exactly three upright and exactly
  three level straight lines, evenly spaced, crossing one another, each stopping a little short
  of the inner oval. The area behind the strings is see-through and stays plain white: the one
  exception to the rule that nothing is left white. The throat is a small funnel shape under the
  head. Color: gray #c9ced6.
- Water bottle, on the right: one upright bottle, its lower half hidden in the bag. The body is
  a tall rounded rectangle with round shoulders, about 12% of the image width.
  Color: pale green #b9dc8a. On top of it sits exactly one cap, a small level rectangle with
  rounded corners, narrower than the body; its bottom side is the body's top: one shared line.
  Color: dark green #2f6b3a.
The racket's head is the tallest thing; the top of the ball and the top of the bottle's cap are
at about the same height, lower than the racket. The whole scene fills about 78% of the image
width, with clear white margin on all four sides.
Nothing else: no zipper teeth, no pockets, no shoulder strap, no second handle, no label, no
logo, no stripes on the bag, no towel, no shoes, no second ball, no straw, no shadow. About
eighteen lines in total. Count: three things in the bag, three seams on the ball, three upright
and three level strings, one cap, one handle.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding shine spots, hexagon seams, a seam curve under
the stitches, red thread, thin strings, a colored string bed, a second pair of skate wheels, logos or
shadows despite the prompts, regenerate rather than keep it.
