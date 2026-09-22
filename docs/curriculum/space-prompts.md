# Space — image-generation prompts

Source art for the ten `space` lessons (Core level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. `solar-system` has its own reference line.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/space/<lesson-id>-<model>.png`, and record model, date and
  prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph and a NO SKY paragraph.** Hairlines were the main
  reason pictures had to be made again, and an image model asked for anything in space wants to
  paint a dark sky full of stars. Every drawing stands on white paper; no picture has a star,
  a sparkle or a glow in it (the `star` lesson is the star).
- **Every part has its own dark outline**: craters, lights, the window, the inner flame, the light
  beam and the lens are closed shapes with a strip of their neighbor's color around them, or share
  one straight edge with the part they sit on; nothing is told apart by color alone. The UFO's beam
  and dome are drawn solid, like paper cutouts, never see-through or fading.
- **Details are single lines as bold as the outlines**: the comet's two streak lines, the
  satellite's arms, stalk, feed and panel lines, the rover's mast and antenna, the shuttle's body
  line, and all three orbits. Never thinner, never a colored pole or ribbon. Lines inside a shape float.
- **Parts stand apart** with a clear white gap: craters, lights, the rover's wheels (as on the
  Wheels path, a wheel touches nothing, so there are no legs), boosters and body, dish and panels,
  sun and orbits. Parts touch only where one is attached to another, and then along one shared
  line drawn once (dome and beam on the saucer, fins and flame on the rocket, wings on the shuttle
  and boosters on the wings, lens on camera head, tail on comet).
- **One line divides a shape on purpose**: the rocket's nose-cone line touches both sides of the body.
- **Overlap is asked for once**, in `planet-with-rings`, whose objective is the overlap: one circle
  and one oval band, in front below and behind above.
- **Circles touch nothing** wherever the subject allows it, because a circle that another outline
  touches traces with a dent. In `solar-system` each orbit's line stops short of its planet on both
  sides. The two exceptions are the comet's ball (the tail is attached to it) and the ringed planet;
  expect the color-edge trace (`svg trace --ink-max-channel 0`) for those two.
- **Pointed tips are softly rounded** (crescent, star, rocket nose, comet tail): a needle tip traces
  as a closed line with a tail.
- **Nothing is white or black inside a subject**: the shuttle is cream, the rocket, saucer and wheels
  are gray, the moon is yellow with gray craters.
- **No living things**: the saucer's dome is solid with nothing in it, the rocket's window is plain,
  and the rover's camera is a box with a box lens, not a round eye.
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

For `solar-system` only (attach the apple):

```text
Match the attached image exactly in line color, line weight, corner rounding, flatness of color
and margins. This image is a small scene, not one subject: follow the description for what is in it.
```

## Lesson prompts

### 1 · `crescent-moon`

Objective: Curved moon with three craters.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
SUBJECT: one crescent moon with exactly three craters.
- Moon: one closed shape made of two curves, like a fat letter C with its opening on the right.
  The outer edge is one big round curve, most of a circle, bulging to the left. The inner edge is
  a second, shallower curve, also bulging to the left. The two curves meet at the top and at the
  bottom in two pointed tips, both pointing to the right; each tip has the same gently rounded
  corner as everything else in the course, not a needle point. The crescent is fat: at its
  thickest, halfway down, it is about one third as wide as it is tall. Color: yellow #f7cf46.
- Craters: exactly three complete, plain circles inside the moon, each of a different size: the
  largest in the thickest part, halfway down, about half as wide as the moon is thick there; a
  middle-sized one above it; the smallest one below it. The three follow the moon's curve. A clear
  strip of yellow surrounds each one: a crater touches neither the moon's outline nor another
  crater. One circle each: no second ring, no shadow arc inside. Color: gray #c9ced6.
The whole moon fills about 65% of the image height and sits in the middle of the image.
Nothing else: no face, no stars, no clouds, no nightcap, no dots or specks on the moon, no glow.
Five lines in total: two curves and three circles. Count the craters: three.
```

### 2 · `planet-with-rings`

Objective: Circle with a tilted ring passing behind it.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
SUBJECT: one planet with exactly one ring around it. The ring passes in front of the planet
below its middle and behind the planet above its middle: that overlap is what this lesson teaches.
- Planet: one plain circle in the center of the image, about 38% of the image width across.
  Color: orange #f08a2c.
- Ring: one flat band shaped like a long, flat oval with an oval hole in it, made of exactly two
  ovals, one inside the other, with the same center as the planet. The outer oval is about twice as
  wide as the planet and about one third as tall as it is wide; the inner oval is the same shape,
  smaller, so the band between them is even and wide: about five line-widths wide at the sides.
  The whole ring is tilted: its right end is higher than its left end, by about 20 degrees.
  Color of the band: yellow #f7cf46.
- In front: the lower half of the ring passes in front of the planet. There the band is whole,
  with both of its edges drawn right across the planet, and the planet's outline stops at the band
  and carries on below it. A cap of orange shows below the band.
- Behind: the upper half of the ring passes behind the planet and is hidden by it. The band's two
  edges stop exactly at the planet's outline on the left and on the right, and nothing of the ring
  shows on the upper part of the planet.
- Between the planet and the band, on the left and on the right, the hole in the ring shows as
  plain white paper.
Planet and ring together fill about 78% of the image width.
Nothing else: no stripes, bands, spots or craters on the planet, no second ring, no line along the
middle of the band, no moons, no stars, no shadow of the planet on the ring. Count: one planet, one ring.
```

### 3 · `star`

Objective: Five-point star, guided point by point.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
SUBJECT: one five-point star.
- Star: one single closed shape with exactly ten straight sides: five outer points and, between
  them, five inner corners. It is the classic even star: all five points are the same size and
  the same length, one point stands straight up, the two lowest points stand level with each other
  like two legs, and the left half mirrors the right half. The inner corners lie about halfway
  between the center and the points, so the points are clearly pointed but not thin. Every point
  and every inner corner has the same gently rounded corner as everything else in the course.
  All ten sides are straight: they do not bow in or out. Color: yellow #f7cf46, one flat area.
The star fills about 65% of the image and sits in the middle of the image.
Nothing else: no lines inside the star, no lines from point to point, no second star, no small
stars or sparkles around it, no tail, no glow, no face. One line in total: ten straight sides.
Count the points: five.
```

### 4 · `comet`

Objective: Ball with a long streaking tail.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
SUBJECT: one comet: a ball with one long tail streaming out behind it. The comet flies down and to
the right: the ball is in the lower right part of the image and the tail streams away from it up
and to the left, at about 35 degrees from level.
- Ball: one complete, plain circle, about 22% of the image width across. Color: blue #5b8fc7.
- Tail: one single closed shape attached to the back of the ball, about three times as long as the
  ball is wide. It starts as wide as the ball: its two long edges begin on the ball's outline, one
  at the top of the ball and one at its lower left, and sweep away up and to the left as long,
  smooth, nearly straight curves. The far end of the tail is cut into exactly three pointed tips,
  like a flag with three tails: the middle tip is the longest, the two outer tips are shorter, and
  between the tips are two deep V-shaped notches. The ball lies in front of the tail: the ball's
  circle is whole, and the tail's edges stop exactly at it. Color: yellow #f7cf46.
- Streak lines: exactly two single bold lines inside the tail, the same charcoal line as the
  outlines, with no color. Each runs along the tail, the way the tail streams, and is about one
  third as long as the tail. They float: each starts and ends well inside the tail and touches
  neither the ball, the tail's outline nor the other line.
Ball and tail together fill about 75% of the image, along the diagonal from upper left to lower right.
Nothing else: no stars, no sparkles, no speed lines outside the tail, no flames, no smoke, no
craters or spots on the ball, no second tail, no face. Four lines in total. Count: one ball, one
tail with three tips, two streak lines.
```

### 5 · `rocket`

Objective: Pointed rocket with fins, window and flame.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
VIEW: a flat front view, the rocket standing upright with its nose straight up. No perspective.
SUBJECT: one rocket with a pointed nose, exactly two fins, exactly one window and one flame.
- Body: one closed shape, tall and slim, about three times as tall as it is wide: a pointed nose
  at the top, two sides that bow gently outward like the sides of a bullet, and a straight, level
  bottom edge. Color: gray #c9ced6.
- Nose cone: one single bold line across the body, straight and level, about one quarter of the way
  down from the tip. It runs from the body's left side to its right side and touches both: it
  divides the body in two, and the part above it, the nose cone, has its own color: red #d8433b.
- Window: exactly one complete, plain circle in the upper half of the gray part of the body, about
  half as wide as the body. A clear strip of gray surrounds it: it touches neither the body's sides
  nor the nose cone's line. One circle: no second ring, no bolts, no shine. Color: blue #5b8fc7.
- Fins: exactly two, one on each side at the bottom of the body, each a mirror of the other. Each
  fin is one closed shape with three sides: its inner side lies on the body's side, fin and body
  sharing that one line, drawn once; its upper side slopes straight out and down from the body,
  starting about one third of the way up the body; its lower side runs from the fin's tip back in
  to the body's bottom corner. The fin's tip reaches a little lower than the body's bottom edge.
  Color: red #d8433b.
- Flame: one closed shape like an upside-down teardrop hanging from the middle of the body's bottom
  edge: about two thirds as wide as the bottom edge where it starts, swelling a little, then
  narrowing to one soft point straight down. It is about one third as long as the body. Its top and
  the body's bottom edge are one shared line, drawn once. Color: orange #f08a2c.
- Inner flame: one smaller teardrop of the same shape floating inside the flame, about half its
  size, with a clear strip of orange all around it: it touches neither the flame's outline nor the
  body. Color: yellow #f7cf46.
The whole rocket, flame included, fills about 72% of the image height.
Nothing else: no third fin in the middle, no door, no rivets, no panel lines, no stripes, no
lettering, no flag, no smoke, no clouds, no stars, no launch pad, no crew in the window. Seven
lines in total. Count: two fins, one window, one flame with one inner flame.
```

### 6 · `ufo`

Objective: Flying saucer with a dome and light beam.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
VIEW: a flat side view, seen straight on. No perspective: the saucer is not seen from above or
below, and no ellipse of its top or its underside shows.
SUBJECT: one flying saucer with a dome on top, exactly three lights and one light beam below it.
- Saucer: one single smooth closed shape, wide and flat, like a lens lying level, about four times
  as wide as it is tall. Its top edge is one gentle curve bulging upward, its bottom edge is one
  shallower curve bulging downward, and the two meet at the left and at the right in a softly
  rounded tip. Color: gray #c9ced6.
- Dome: one half circle standing on the middle of the saucer's top, about one third as wide as the
  saucer. Its foot follows the saucer's top edge: dome and saucer share that one line, drawn once.
  The dome is drawn solid, not see-through: nothing shows inside it. Color: blue #5b8fc7.
- Lights: exactly three complete, plain circles in one level row along the middle of the saucer's
  side, all the same size, each about one third as tall as the saucer, evenly spaced. A clear strip
  of gray surrounds each one: they touch neither each other nor the saucer's outline.
  Color: orange #f08a2c.
- Light beam: one closed shape with four sides hanging below the saucer, from the middle of its
  underside: narrow at the top, about one third as wide as the saucer, and widening steadily
  downward to a straight, level bottom edge about two thirds as wide as the saucer. Its two sides
  are straight. Its top follows the saucer's bottom edge: beam and saucer share that one line,
  drawn once. The beam is about one and a half times as tall as saucer and dome together. It is
  drawn solid, like a paper cutout, with a dark outline all around: not see-through, not fading,
  with no rays inside. Color: yellow #f7cf46.
The whole drawing, from the top of the dome to the bottom of the beam, fills about 72% of the
image height, and the saucer about 70% of the image width.
Nothing else: no alien, no figure in the dome, no antenna, no legs, no rim line, no rivets, no shine
on the dome, no rays or sparkles, nothing caught in the beam, no ground, no spot of light on the
ground, no stars. Six lines in total. Count: one dome, three lights, one beam.
```

### 7 · `satellite`

Objective: Box body with two solar panel wings and a dish.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
VIEW: a flat front view, seen straight on. No perspective: every box is a flat rectangle, and no
top or side face shows.
SUBJECT: one satellite: a box body with exactly two solar panel wings and exactly one dish.
- Body: one upright box with gently rounded corners in the center of the image, a little taller
  than it is wide, about 18% of the image width across. Color: yellow #f7cf46.
- Body line: one single bold level line across the body, halfway down. It starts and ends a little
  inside the body's outline and touches nothing. A line with no color.
- Arms: exactly two single bold straight level lines, the same charcoal line as the outlines, with
  no color: not rods, not tubes. One runs from the middle of the body's left side out to the left
  panel, the other from the middle of the body's right side out to the right panel. Each arm is
  short, about four line-widths long, and touches the body at one end and its panel at the other.
- Solar panels: exactly two, one on each side, each a mirror of the other. Each panel is one long,
  level rectangle with gently rounded corners, about one and a half times as long as the body is
  wide and about two thirds as tall as the body, held at the middle of its inner end by its arm.
  Color: blue #5b8fc7.
- Panel lines: exactly two single bold upright lines inside each panel, evenly spaced, dividing it
  into three equal parts by eye. They float: each starts and ends a little inside the panel's
  outline and touches nothing. Four panel lines in all. Lines with no color.
- Dish stalk: one single bold straight line rising from the middle of the body's top, about four
  line-widths long, leaning a little to the right. A line with no color.
- Dish: one closed shape like a shallow bowl seen from the side, sitting on the top of the stalk
  and tilted to face up and to the right: a straight rim line on its upper right and one round
  curve bulging down and to the left, from one end of the rim to the other. The stalk meets the
  middle of the round curve. The dish is about as wide as the body. Color: gray #c9ced6.
- Feed: one single short bold straight line standing out from the middle of the dish's rim, at a
  right angle to the rim, pointing up and to the right, about three line-widths long. It touches
  the rim at one end and nothing at the other. A line with no color.
The whole satellite fills about 80% of the image width; clear white lies between the dish and
both panels.
Nothing else: no grid of small squares on the panels, no second dish, no antennas, no thrusters,
no flame, no bolts, no lettering, no flag, no Earth, no stars, no signal waves. Thirteen lines in
total. Count: two panels, two lines in each panel, one dish.
```

### 8 · `mars-rover`

Objective: Six wheels, flat deck, mast camera and antenna.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
VIEW: a flat side view, seen straight on from the side, with the front of the rover on the right.
No perspective: nothing of the deck's top surface, the front, the back or the far side shows.
NO GROUND: the rover is drawn on plain white paper. No ground line, no rocks, no dust, no tracks.
SUBJECT: one Mars rover: a flat deck on exactly six wheels, with one mast camera and one antenna.
- Deck: one long, low, level slab with gently rounded corners, about eight times as long as it is
  tall, about 70% of the image width long. Color: orange #f08a2c.
- Wheels: exactly six complete, plain circles, all the same size, in one level row below the deck,
  evenly spaced from one end of the deck to the other. Each wheel is about 9% of the image width
  across. No wheel touches anything: between the top of every wheel and the underside of the deck
  there is a clear gap of white, about three line-widths, and between one wheel and the next a
  clear gap of white of at least three line-widths. One circle each: no hub, no second ring, no
  spokes, no tread. Color: gray #c9ced6.
- Mast: one single bold straight upright line, the same charcoal line as the outlines, with no
  color: not a pole, not a tube. It stands on the deck's top edge near the front (the right end)
  and is about one third as tall as the deck is long.
- Camera head: one small level box with gently rounded corners sitting on the top of the mast,
  centered on it, about twice as wide as it is tall and about one eighth as long as the deck.
  The mast's line stops at the box's bottom edge. Color: blue #5b8fc7.
- Lens: one smaller box on the front (right) end of the camera head, about half as tall as the
  head, centered on that end and sticking out a short way. Its inner side and the head's right
  side are one shared line, drawn once. Color: gray #c9ced6.
- Antenna: one single bold straight line, with no color, standing on the deck's top edge near the
  back (the left end) and leaning backward, up and to the left, at about 70 degrees. It is about
  two thirds as tall as the mast and ends in a plain round line end: no ball, no dish.
The whole rover fills about 75% of the image width.
Nothing else: no legs or struts between the wheels and the deck, no robot arm, no solar panel, no
second camera, no round lens that looks like an eye, no flag, no lettering, no lights, no ground,
no rocks, no hills, no sky. Eleven lines in total. Count the wheels: six.
```

### 9 · `space-shuttle`

Objective: Shuttle with wings and booster rockets.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
VIEW: the shuttle stands upright, nose straight up, ready for launch, and is seen flat from its
back, so that both wings show. No perspective. The left half mirrors the right half.
SUBJECT: one space shuttle with exactly two wings and exactly two booster rockets.
- Body: one closed shape, tall and slim, about five times as tall as it is wide: a fully rounded
  nose at the top, two straight upright sides and a straight, level bottom edge. Color: cream #f6e7b8.
- Body line: one single bold straight upright line down the middle of the body, from a little
  below the nose to a little above the bottom edge. It floats: it touches nothing. A line with no color.
- Wings: exactly two, one on each side of the body, each a mirror of the other. Each wing is one
  closed shape with three straight sides, a right-angled triangle: its upright side lies on the
  lower half of the body's side, wing and body sharing that one line, drawn once; its bottom side
  is level, in line with the body's bottom edge, and about one and a half times as long as the body
  is wide; its third side slopes straight from the body, halfway up, down and outward to the wing's
  tip. Color: gray #c9ced6.
- Booster rockets: exactly two, one on each side, each a mirror of the other. Each booster is one
  closed shape: a slim upright tower with a pointed cone top and two straight upright sides, about
  half as wide as the body. It stands on the sloping side of the wing, about halfway along it: the
  booster's foot and that stretch of the wing's sloping side are one shared line, drawn once, and
  nothing of the booster shows below it. The tip of its cone reaches about as high as the body's
  shoulders, where the rounded nose begins. Between each booster and the body there is a clear gap
  of white, at least three line-widths wide, all the way up. Color: orange #f08a2c.
The whole shuttle fills about 72% of the image height.
Nothing else: no big fuel tank, no flames, no smoke, no launch tower, no windows, no tail fin, no
engine bells, no flag, no lettering, no tiles, no stripes on the boosters, no clouds, no stars.
Six lines in total. Count: two wings, two boosters.
```

### 10 · `solar-system`

Objective: Sun with three orbit ellipses and small planets.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO SKY: the drawing stands on plain white paper. No black, blue or purple sky, no stars, no
sparkles, no glow, no planets or clouds in the background. Everything that is not the subject is
pure white.
VIEW: the solar system is seen from a little above, so each round orbit looks like a flat oval
(an ellipse). This is the only perspective in the picture: the sun and the planets are plain circles.
SUBJECT: a sun in the center with exactly three orbits around it and exactly three small planets,
one on each orbit.
- Sun: one complete, plain circle in the exact center of the image, about 11% of the image width
  across. Color: yellow #f7cf46.
- Orbits: exactly three ovals around the sun, one inside the other, all level (not tilted), all
  with the sun's center as their center, and all the same shape: a little less than half as tall
  as they are wide. The inner orbit is about 40% of the image width wide, the middle one about
  60%, the outer one about 80%. Each orbit is one single bold line, the same charcoal line as the
  outlines, even all the way around: not dashed, not dotted, not thinner, not a colored band.
  Nothing is colored between the orbits: the paper there stays white. The orbits touch neither
  the sun nor each other: clear white lies between the sun and the inner orbit all the way around.
- Planets: exactly three complete, plain circles, one on each orbit, each with its center exactly
  on its orbit's line:
  1. on the inner orbit, the smallest planet, about 4% of the image width across, at the lower
     right of the orbit. Color: red #d8433b.
  2. on the middle orbit, a planet about 6% of the image width across, at the upper left of the
     orbit. Color: blue #5b8fc7.
  3. on the outer orbit, the biggest planet, about 8% of the image width across, at the lower left
     of the orbit. Color: orange #f08a2c.
- Around each planet its orbit's line is interrupted: the line stops a clear gap of white, about
  two line-widths, short of the planet on one side and carries on the same distance past it on the
  other side. So no planet touches any line, and every planet's circle is whole.
The whole drawing fills about 80% of the image width and sits in the middle of the image.
Nothing else: no rays on the sun, no face, no rings, stripes or spots on the planets, no moons, no
fourth orbit, no comet, no stars, no labels, no arrows, no dark sky. Seven lines in total. Count:
one sun, three orbits, three planets.
```

## Open questions for the creator

- `crescent-moon`: yellow moon with gray craters (a gray moon with darker craters has no darker gray
  in the palette). The crescent is fat so three craters fit with color all around them.
- `planet-with-rings`: the ring is a wide yellow band (two ovals), not a single line, so it can be
  colored; the planet is plain, with no stripes.
- `comet`: the tail is one yellow shape with three tips attached to a blue ball, plus two floating
  streak lines, rather than loose lines only.
- `rocket`: the nose cone has its own color, made by one line across the body; the flame has an
  inner flame. Neither is named by the objective.
- `ufo`: three round lights were added; the objective names only the dome and the beam.
- `satellite`: the panels carry two floating lines each instead of a grid, so each panel stays one
  area of blue.
- `mars-rover`: the objective says six wheels, and a true side view shows three. The prompt draws
  all six in one row under a long deck and leaves the wheels unattached, as on the Wheels path.
- `space-shuttle`: seen from the back on the launch pad, with no fuel tank, and each booster standing
  on a wing's sloping edge with a white gap to the body.
- `solar-system`: three planets, one per orbit (the objective gives no number), and each orbit line
  stops short of its planet so no circle is touched.

## What came back (2026-09-21)

All ten pictures were kept; none had to be made again. They are in `docs/curriculum/space/` as
`<lesson-id>-openai.png` (the model was not named when they were handed over). The creator changed
five of them rather than following the prompt, and the lessons are built to the pictures, not to the
prompts above:

- `comet`: a flame-shaped tail with pointed licks and a second orange flame inside it, instead of a
  three-tip tail with two floating streak lines.
- `satellite`: a yellow can-shaped body with a gray dome at each end, one blue port on the front,
  panels split into six panes, a little ball on the dish's arm, and the whole thing tilted.
- `mars-rover`: **five** wheels, each hanging from its own slanted leg, with a dish on the left and
  the camera on the right. The objective in `plan.json` still says six wheels and an antenna, so it
  needs rewording.
- `space-shuttle`: a dark gray nose, a blue window, boosters standing beside the body, and three
  nozzles under it with three flames.
- `solar-system`: the three orbits are nested but not centered on the sun, as an orbit chart is drawn.

`crescent-moon`, `planet-with-rings`, `star`, `rocket` and `ufo` came back as the prompts asked.

Tracing notes worth keeping: every picture traced cleanly enough to build from the ordinary ink
trace, and the fused places were separated with `strokes split` (which keeps the lines on the ink)
rather than the color-edge trace. Two pictures brought a dark gray that is not in the palette and is
kept as its own area: the satellite's side arms (#6F7376) and the shuttle's nose and nozzles
(#53595D). The words are planned in [space-words.md](space-words.md).

## What to send back

The PNGs you like (any number per lesson), named `<lesson-id>-<model>.png`. Flat color and an even
dark line are what make them traceable; a dark sky, stars, glow or a see-through beam are the
things to reject on this path.
