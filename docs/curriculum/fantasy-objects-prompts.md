# Fantasy Objects — image-generation prompts

Source art for the ten `fantasy-objects` lessons (Advanced level) in `plan.json`, written for a raster
image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. `spellbook` and `treasure-chest` have their own
  reference line, because there the view does change. For `treasure-chest`, also attach the kept
  `crown` and `key` pictures: the chest holds smaller, simpler copies of them.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/fantasy-objects/<lesson-id>-<model>.png`, and record model,
  date and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Every prompt has a NO MAGIC paragraph.** These subjects invite glow, shine, light rays and a dark
  background. Everything that is not the subject is plain white paper. The wand's three sparkles are
  the one exception: they are named parts of the subject, drawn as outlined shapes, and the prompt
  says so, because the style prompt otherwise forbids sparkles.
- **Every part has its own dark outline**: jewels, rivets, bubbles, the tag, the cork, the corner
  caps, the coins. Nothing is told apart by color alone; the potion's liquid has a surface line.
- **Parts touch only where one is attached to another**, and then along a shared edge drawn once
  (star on stick, blade on crossguard, points on the crown's band, cork in the lip). Sparkles,
  jewels, rivets, bubbles, stars and coins float and touch nothing.
- **Lines that divide a shape touch its outline on purpose** in five lessons, and the prompt says so
  each time: the shield's stripe, the potion's surface line, the grip's wrap lines, the hat's band and
  each crystal's facet line. Every other detail line floats (the sword's fuller, the hatch lines, the
  page lines).
- **Metal is gray or yellow, dark insides are purple, never charcoal.** A solid dark shape swallows
  its own outline when traced.
- **Overlap only in the last three lessons, and only straight-sided or simple shapes**: the book's
  strap and clasp lie on the book, the crystals tuck behind one another, and the chest holds its
  treasure. Its key lies on the paper in front of the chest, touching nothing.
- **Hatching only on the crystals**, where the objective asks for it: three floating lines on each
  shadow side, the same weight as the outlines. It is drawn with the pen, so it is lines, not shading.
- **Three-quarter views follow the Forms path**: seen from slightly above, parallel edges, no
  vanishing points, hidden edges not drawn, light from the upper left shown only by flat colors.
- **The key's handle has a hole that shows the white paper.** That is the one place where white is
  left inside a subject, and the prompt says so.

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

For `spellbook` only:

```text
Match the attached image exactly in line color, line weight, corner rounding, flatness of color
and margins. The subject changes, and so does the view: follow the VIEW paragraph below.
```

For `treasure-chest` only (apple, crown and key attached):

```text
Match the first attached image (the apple) exactly in line color, line weight, corner rounding and
flatness of color. The subject changes, and so does the view: follow the VIEW paragraph below. The
other two attached images show the crown and the key of this course: draw smaller, simpler copies of
them, exactly as the description says.
```

## Lesson prompts

### 1 · `magic-wand`

Objective: Stick with a star tip and three sparkles.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no light rays, no shine, no magic
dust, no dots, no swirls, no dark or colored background. The three sparkles described below are
named parts of this subject, drawn as solid outlined shapes: they are the only sparkles, and the
one exception to the rule against sparkles.
SUBJECT: one magic wand: a stick with a five-point star on its tip, and exactly three sparkles
around the star.
- The wand is built as if it stood upright, the star straight above the stick, and then the whole
  wand is tilted 30 degrees to the right, so it runs from the lower left to the upper right.
- Stick: one long, narrow closed shape with two straight parallel sides, the same width all the
  way, about 4% of the image wide, with a rounded bottom end. Color: brown #8a5a33.
- Star: one closed shape with exactly ten straight sides: five points of the same size and, between
  them, five inner corners, plump rather than thin. It is about 30% of the image wide. The stick's
  top end meets the star at the inner corner between the star's two lower points and stops there:
  the stick does not run into the star. Color: yellow #f7cf46, one flat area.
- Sparkles: exactly three four-point sparkles in the white around the star: one large, above and
  to the left of the star; one medium, to the right of the star; one small, below and to the right
  of the star. Each is one closed shape with exactly eight straight sides: four sharp points (up,
  down, left, right) and four inner corners, taller than it is wide. The large one is about 12% of
  the image tall, the medium one 9%, the small one 7%. Each sparkle floats: a clear gap of white,
  at least four line-widths wide, lies between it and the star, the stick and the other sparkles.
  Color: blue #5b8fc7.
The whole wand with its sparkles fills about 75% of the image, measured along the tilt.
Nothing else: no lines inside the star, no bands or white tips on the stick, no ribbon, no small
dots or extra stars, no motion lines. Five lines in total. Count the sparkles: three.
```

### 2 · `shield`

Objective: Curved shield with a stripe emblem and rivets.

```text
LINE WEIGHT: every line, including the small rivet circles, is as bold as the outline of the
attached apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same
very dark charcoal. No hairlines, no gray lines. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no shine, no sparkles, no dark or
colored background.
VIEW: a flat front view, seen straight on. The shield is flat: no bulge, no side edge, no strap.
SUBJECT: one knight's shield with a rim, one diagonal stripe and exactly five rivets.
- Shield: one closed outline, a little taller than it is wide: a straight level top edge, two
  gently rounded top corners, and two sides that run down and curve inward to meet in one soft
  point at the bottom center. The left half mirrors the right half.
- Rim: a second outline of the same shape inside the first, the same distance from it all the way
  round, about 10% of the image width. The band between the two outlines is the rim.
  Color: gray #c9ced6.
- Field: everything inside the inner outline. Color: red #d8433b.
- Stripe: exactly one straight diagonal band across the field, from the upper left down to the
  lower right, about 14% of the image wide. It is made of two straight parallel lines. Each line
  starts on the inner outline on the left side and ends on the inner outline on the right side,
  touching it at both ends: here the lines divide the field on purpose. Both lines stay clear of
  the top corners and of the bottom point. Color of the stripe: yellow #f7cf46. The field above
  and below it stays red.
- Rivets: exactly five small circles on the rim, each about 4% of the image wide: one in the top
  left corner, one in the top right corner, one in the middle of the left side, one in the middle
  of the right side, one at the bottom point. Each rivet floats in the middle of the rim's width,
  with a clear strip of gray all round it: it touches neither outline. Color: brown #8a5a33.
The shield fills about 65% of the image.
Nothing else: no animal, no cross, no letters, no second stripe, no center boss, no dents, no
scratches, no shine line, no straps. Count the rivets: five. Count the stripes: one.
```

### 3 · `crown`

Objective: Pointed crown with three jewels.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no shine, no sparkles, no dark or
colored background.
VIEW: a flat front view, seen straight on. Only the front of the crown shows: no back half, no
inside, no ellipse at the top or the bottom.
SUBJECT: one crown with exactly three points and exactly three jewels.
- Band: one wide, low rectangle along the bottom, with straight level edges, about five times as
  wide as it is tall and about 16% of the image tall. Color: orange #f08a2c.
- Points: one closed shape standing on the band. Its bottom edge is the band's top edge: one shared
  line, drawn once, the same length as the band. Its two sides lean slightly outward as they rise.
  Its top is a zigzag of straight lines with exactly three points: one on the left, one in the
  center, one on the right. The center point is the tallest; the two outer points are the same
  height as each other. Between the points are exactly two V-shaped dips, which stop well above
  the band, so the shape stays one piece. The points are sharp but not thin.
  Color: yellow #f7cf46.
- Jewels: exactly three, in a level row on the band, evenly spaced. The middle one is a diamond (a
  square standing on its corner), about 9% of the image tall. Color: red #d8433b. The left and
  right ones are circles of the same size as each other, about 7% of the image wide.
  Color: blue #5b8fc7. Every jewel floats: a clear strip of orange lies all round it, and it
  touches neither the band's outline nor another jewel.
The crown fills about 70% of the image width.
Nothing else: no balls on the points, no cross, no fur trim, no cushion, no pattern or dots on the
band, no facet lines or shine on the jewels. Count the points: three. Count the jewels: three.
```

### 4 · `key`

Objective: Ornate loop handle with a toothed end.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no shine, no sparkles, no dark or
colored background.
VIEW: a flat front view, seen straight on. The key is flat, like a key cut out of paper.
SUBJECT: one old-fashioned key standing upright: a clover-shaped loop handle at the top, a
collar, a straight shaft, and at the bottom a bit with exactly three teeth pointing to the right.
- Handle: one closed outline made of exactly three round lobes, like a three-leaf clover: one lobe
  at the top, one at the lower left, one at the lower right, all the same size. Where two lobes
  meet, the outline makes one soft inward corner. It is about 30% of the image wide.
  Color: yellow #f7cf46.
- Hole: exactly one circle in the center of the handle, about a third as wide as the handle, with
  a wide strip of yellow all round it. The hole shows the plain white paper: this is the one place
  where white is left inside the subject, and it is intended.
- Collar: one small, low rectangle directly under the handle, a little wider than the shaft. Its
  top edge touches the bottom of the handle between the two lower lobes. Color: orange #f08a2c.
- Shaft: one long, narrow upright rectangle hanging from the middle of the collar's bottom edge,
  about 6% of the image wide, with a flat bottom end. Color: yellow #f7cf46.
- Bit: one closed shape attached to the right side of the shaft at its lower end; the shaft's right
  edge is the bit's left edge, one shared line. The bit is about 22% of the image tall and its
  bottom is level with the shaft's bottom. Its right edge is cut by exactly two square notches,
  leaving exactly three square teeth that point to the right, all the same size. Each tooth and
  each notch is about 4.5% of the image tall and about 5% deep, with straight sides and square
  corners. Color: orange #f08a2c.
The key fills about 75% of the image height.
Nothing else: no ring, no chain, no ribbon, no second hole, no pattern or lines on the handle or
shaft, no rings round the shaft. Count the lobes: three. Count the teeth: three.
```

### 5 · `potion-bottle`

Objective: Round flask with a cork, bubbles and a tag.

```text
LINE WEIGHT: every line, including the bubbles and the string, is as bold as the outline of the
attached apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same
very dark charcoal. No hairlines, no gray lines. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no shine, no sparkles, no steam or
smoke, no drips, no dark or colored background.
VIEW: a flat front view, seen straight on. No ellipses: the top of the neck and the surface of the
liquid are straight level lines. The glass is drawn opaque, as flat color, not see-through.
SUBJECT: one round potion flask with a cork, half full, with exactly three bubbles in the liquid
and exactly one tag on a string.
- Flask: one closed outline: a large round body, almost a circle, with a short straight neck
  rising from its top center. The neck is about a quarter as wide as the body and has two straight
  upright sides and a level top edge. Body and neck are one shape with one outline.
- Liquid: exactly one straight level line across the body, a little above its middle, from the
  left side of the outline to the right side, touching it at both ends: here the line divides the
  shape on purpose. Below the line is the liquid. Color: purple #7b4fa3. Above the line, the
  empty glass and the neck are one area. Color: gray #c9ced6.
- Lip: one low, wide rectangle sitting on the neck's top edge, a little wider than the neck; where
  they meet is one shared line. Color: blue #5b8fc7.
- Cork: one closed shape standing on the lip, narrower than the lip, a little wider at its top
  than at its bottom, with a flat top and gently rounded top corners. Color: brown #8a5a33.
- Bubbles: exactly three circles in the liquid: one large (about 9% of the image wide), one medium
  (7%) and one small (5%), spread apart. Each bubble floats: a clear strip of purple lies all
  round it, and it touches neither the flask's outline, nor the liquid line, nor another bubble.
  Color: watermelon pink #ee5a6a.
- Tag: one small closed shape with exactly five straight sides: an upright rectangle whose top is
  a point, like a gift tag, about 13% of the image tall. It hangs in the white to the right of the
  neck, clear of the flask: a gap of white, at least four line-widths wide, lies between the tag
  and the flask's body. Color: cream #f6e7b8. Nothing is written or drawn on it.
- String: exactly one single bold, gently curved line, the same charcoal line as the outlines,
  with no color: not a cord, not a tube. It starts on the right side of the neck, just under the
  lip, and ends exactly at the tag's top point. It touches nothing else.
The flask with its cork fills about 65% of the image height.
Nothing else: no label on the flask, no skull, no letters, no hole in the tag, no loop or knot in
the string, no bubbles above the liquid, no shine line on the glass, no stand.
Count the bubbles: three.
```

### 6 · `sword`

Objective: Blade with a fuller line, crossguard and wrapped grip.

```text
LINE WEIGHT: every line, including the line on the blade and the lines on the grip, is as bold as
the outline of the attached apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel
image), in the same very dark charcoal. No hairlines, no gray lines. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no shine, no sparkles, no flames, no
dark or colored background.
VIEW: a flat front view, seen straight on. The sword stands upright, point up, and its left half
mirrors its right half.
SUBJECT: one sword: a blade with one fuller line, a crossguard, a grip wrapped with exactly four
wrap lines, and a pommel.
- Blade: one long closed shape with two straight parallel sides, about 10% of the image wide. Near
  the top, the two sides turn inward as two straight slanted edges and meet in one point at the top
  center. The blade's level bottom edge lies on the crossguard's top edge: one shared line, drawn
  once. Color: gray #c9ced6.
- Fuller: exactly one straight line down the center of the blade, the same weight as the outline.
  It floats: it starts a little above the crossguard and ends well below where the blade begins to
  narrow, and it touches nothing.
- Crossguard: one low, wide bar across the sword, with level straight edges and rounded ends,
  about 36% of the image wide and about 5% tall. Color: yellow #f7cf46.
- Grip: one upright rectangle hanging from the middle of the crossguard's bottom edge, about 8% of
  the image wide and about 18% tall; where they meet is one shared line. Color: brown #8a5a33.
- Wrap lines: exactly four straight slanted lines across the grip, parallel and evenly spaced,
  each rising from the left edge of the grip to the right edge and touching both: here the lines
  divide the shape on purpose. All five parts of the grip stay the same brown; that is intended.
- Pommel: one circle at the bottom, about 10% of the image wide, its top touching the middle of
  the grip's bottom edge. Color: yellow #f7cf46.
The sword fills about 80% of the image height.
Nothing else: no jewel, no engraving or letters on the blade, no second line on the blade, no
shine line, no curls on the crossguard, no tassel, no scabbard, no stone.
Count the wrap lines: four. Count the lines on the blade: one.
```

### 7 · `wizard-hat`

Objective: Tall pointed hat with stars and a bent tip.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no shine, no sparkles, no moons, no
dots, no dark or colored background. The three stars described below are flat shapes printed on
the hat: they are the only stars.
VIEW: seen from the front and only very slightly from above, so the brim shows as one wide, flat
ellipse. Nothing of the inside of the hat shows, and nobody is wearing it.
SUBJECT: one tall, pointed wizard hat with a bent tip, a band, a brim and exactly three stars.
- Cone: one tall closed shape, wide at the bottom and narrowing steadily upward. In its top third
  it bends over to the right in one soft bend, like the top of a candy cane that has not finished
  curling, and ends in one soft point that points to the right and slightly down. The outline stays
  one smooth, simple line on each side: no folds, no creases, no wrinkles, no curl. The cone's
  bottom edge is one gentle curve that sags in the middle. Color: purple #7b4fa3.
- Band: exactly one curved line across the cone, a little above its bottom edge and parallel to
  it, from the cone's left side to its right side, touching both: here the line divides the shape
  on purpose. The strip between this line and the cone's bottom edge is the band, about 6% of the
  image tall. Color: orange #f08a2c.
- Brim: one wide, flat ellipse around the bottom of the cone, about twice as wide as the cone's
  bottom. The cone stands in front of the back of the brim and hides it. The cone's bottom edge
  lies inside the ellipse, so a strip of brim shows in front of the cone and a wing of brim shows
  on each side. Color: purple #7b4fa3. (The brim and the cone are kept apart by the orange band.)
- Stars: exactly three five-point stars on the purple part of the cone, above the band and below
  the bend: one large (about 12% of the image wide), one medium (9%), one small (7%), spread
  apart. Each is one closed shape with ten straight sides, plump rather than thin. Each star
  floats: a clear strip of purple lies all round it, and it touches neither the cone's outline,
  nor the band line, nor another star. Color: yellow #f7cf46.
The hat fills about 72% of the image.
Nothing else: no buckle, no moons, no dots, no patches, no stitches, no feather, no fold lines at
the bend, no head, no face, no hair. Count the stars: three.
```

### 8 · `spellbook`

Objective: Thick book in ¾ view with a clasp and corner caps.

```text
LINE WEIGHT: every line, including the page lines, is as bold as the outline of the attached
apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no shine, no sparkles, no floating
letters, no dark or colored background.
SUBJECT: one thick closed book lying flat, held shut by one strap with a clasp, with a metal cap
on each of the four corners of its cover.
VIEW: this image is not a flat front view. The book is seen from slightly above, with one upright
edge turned toward the viewer, so exactly three faces show: the cover on top, a long side on the
right and a short side on the left. Edges that are parallel on the book are drawn parallel: no
vanishing points, no narrowing toward the back. Hidden back edges are not drawn. The book is a
plain box with straight edges: the cover does not stick out past the pages, and the spine is at
the back, out of sight.
- Cover: the top face, one flat four-sided shape like a leaning diamond. Color: purple #7b4fa3.
- Long side: the right face, the front edge of the pages, where the book would open. It is about
  a third as tall as it is long: this is a thick book. Color: gray #c9ced6.
- Short side: the left face, the bottom edge of the pages, the same height. Color: cream #f6e7b8.
- Corner caps: exactly four, one on each corner of the cover. Each cap is a small triangle cut off
  the corner by exactly one straight line that runs from one edge of the cover to the next,
  touching both: here the lines divide the shape on purpose. All four caps are the same size, each
  about a fifth of the cover's short edge long. Color: yellow #f7cf46.
- Strap: one flat band with a dark outline on both edges, about 8% of the image wide. It starts in
  the middle of the cover, runs across the cover to the middle of its long right edge, parallel
  to the cover's short edges, and carries on straight down the long side to the book's bottom
  edge. Its end on the cover is a straight edge. Colors: on the cover orange #f08a2c, on the long
  side brown #8a5a33.
- Clasp: exactly one small square plate on the strap, halfway down the long side, a little wider
  than the strap, so it hides the strap behind it. It stays clear of the top and bottom edges of
  the long side. Color: yellow #f7cf46. Nothing is drawn on it.
- Page lines: on the short side, exactly two straight lines running along its length, parallel to
  its long edges and evenly spaced. On the long side, exactly one such line on each side of the
  strap, at half height. Every page line floats: it starts and ends a little inside its face and
  touches nothing, not the outline, not the strap, not the clasp.
LIGHT: it comes from the upper left. It is shown only by the flat colors named here: no gradients,
no hatching, no shadow.
The book fills about 72% of the image width.
Nothing else: no title, no letters, no runes, no star, eye or jewel on the cover, no keyhole, no
bookmark, no ribbon, no rounded spine, no second strap.
Count the corner caps: four. Count the page lines: four in all. Count the clasps: one.
```

### 9 · `crystal-cluster`

Objective: Five faceted shards with hatched shadow sides.

```text
LINE WEIGHT: every line, including every hatch line, is as bold as the outline of the attached
apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same very dark
charcoal. No hairlines, no gray lines, and no line is thinner than another. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no shine, no sparkles, no light rays,
no dark or colored background. The crystals are drawn opaque, as flat color, not see-through.
VIEW: a flat front view, seen straight on.
SUBJECT: a cluster of exactly five crystal shards fanning out from one base, each with one facet
line and a hatched shadow side.
- Shard: every shard is the same kind of shape, like a short, fat pencil: two long straight
  parallel sides, and at the top two short straight slanted edges that meet in one point. All its
  sides are straight. The shards are wide, not thin: each is about 13% of the image wide.
- The fan: the center shard stands upright and is the tallest. One shard on each side of it leans
  outward by about 25 degrees and is shorter. One more shard on each side leans outward by about
  50 degrees and is the shortest. Left and right mirror each other in position.
- Overlap, kept simple: the center shard is in front, whole, with a flat level bottom edge. The
  lower end of each leaning shard is tucked behind the shard next to it on the inside and hidden
  there; whatever shows of its bottom is cut off level with the center shard's bottom edge, so the
  cluster stands on one level line. The upper two thirds of every shard, and its point, stand
  clear of the other shards, with white between the points.
- Facet line: on every shard, exactly one straight line from its point down its length, parallel
  to its long sides and a little to the right of its middle, to the shard's bottom or to where the
  shard disappears behind its neighbor. It touches the point: here the line divides the shape on
  purpose. To its left is the wide light side. Color: pale green #b9dc8a. To its right is the
  narrower shadow side. Color: leaf green #4f9d4a.
- Hatching: on the shadow side of every shard, exactly three short straight slanted lines,
  parallel to one another and evenly spaced, in the upper half of the shard. Every hatch line
  floats: it starts and ends a little inside the shadow side and touches neither the outline, nor
  the facet line, nor another hatch line. The hatch lines are drawn with the pen: they are lines,
  not shading, and they are the only shadow in the image.
The cluster fills about 72% of the image.
Nothing else: no rock or base under the shards, no ground, no cast shadow, no small extra
crystals, no second facet line, no shine marks, no hatching on the light sides.
Count the shards: five. Count the hatch lines: three on each shard, fifteen in all.
```

### 10 · `treasure-chest`

Objective: Open chest in ¾ view with coins, the crown and the key.

```text
LINE WEIGHT: every line, including the small coins and the key, is as bold as the outline of the
attached apple: about 1% of the image width (10 to 12 pixels on a 1024-pixel image), in the same
very dark charcoal. No hairlines, no gray lines. The image is square.
NO MAGIC: the drawing stands on plain white paper. No glow, no light rays from the chest, no
shine, no sparkles, no ground line, no shadow, no dark or colored background.
SUBJECT: one open treasure chest heaped with gold, with exactly three coins and one crown on the
heap, and one key lying on the paper in front of the chest.
VIEW: this image is not a flat front view. The chest is seen from slightly above and from the
front left, so its long front face and its short right side face both show. Edges that are
parallel on the chest are drawn parallel: no vanishing points, no narrowing toward the back.
Hidden edges are not drawn.
- Box: a plain box with straight edges, about twice as long as it is tall. Two faces show. The
  long front face. Color: orange #f08a2c. The short right side face, which slants up and away to
  the right. Color: brown #8a5a33. They meet at one upright edge.
- Lock plate: exactly one small square in the top center of the front face, floating: a clear
  strip of orange lies all round it. Color: yellow #f7cf46. Nothing is drawn on it.
- Lid: the lid is open and stands up behind the box, hinged along the box's back edge and leaning
  slightly back. Only its inside shows, as one flat closed shape as long as the box: two straight
  upright sides and a top edge that is one gentle arch. Its thickness is not drawn. Its lower part
  is hidden behind the heap. Color: purple #7b4fa3.
- Heap: one closed shape with a smooth, rounded top, like a low hill, rising out of the box. It
  fills the whole opening from side to side, so nothing of the inside of the box shows; its bottom
  is hidden behind the box's front and right top edges. Its top stays well below the lid's arch.
  No bumps, no single coins along its edge. Color: yellow #f7cf46.
- Coins: exactly three circles on the heap, all the same size, each about 7% of the image wide,
  spread apart on the right half of the heap. Each coin floats: a clear strip of yellow lies all
  round it, and it touches neither the heap's outline, nor the crown, nor another coin.
  Color: orange #f08a2c. Nothing is drawn on them.
- Crown: a small copy of the course's crown, standing on the left half of the heap, in front of
  the lid. It is two shapes: a low straight band (color: orange #f08a2c) whose lower edge sinks a
  little into the heap, and on it one shape with exactly three points, the center point tallest
  (color: yellow #f7cf46). No jewels at this size. It is about 22% of the image wide, and its
  points stay below the lid's arch.
- Key: a small, simple copy of the course's key, lying flat on the white paper in front of the
  chest, below its lower right, level, its handle to the left. It touches nothing: a gap of white,
  at least four line-widths wide, lies between it and the box. It is about 26% of the image long
  and is made of two shapes. The first is a round ring handle and a straight narrow shaft running
  from the ring to the right, with a flat end, drawn together as one closed shape with one outline
  (color: yellow #f7cf46); the ring's round hole shows the white paper, which is intended. The
  second is one small bit under the shaft's right end with exactly two square teeth pointing down
  (color: orange #f08a2c). No collar, no clover shape at this size.
LIGHT: it comes from the upper left. It is shown only by the flat colors named here: no gradients,
no hatching, no shadow.
The chest with its lid and the key together fill about 80% of the image.
Nothing else: no metal bands, no rivets, no handles on the box, no keyhole, no planks or wood
grain, no jewels, no necklaces, no cups, no coins on the paper, no coins falling, no map, no sand.
Count the coins: three. Count the crown's points: three. Count the key's teeth: two.
```

## What to send back

One kept PNG per lesson, named `<lesson-id>-<model>.png`, attached as files. Flat color and an even
dark line are what make them traceable; if a model keeps adding glow, shine lines or gradients despite
the prompts, regenerate rather than keep the prettiest one.
