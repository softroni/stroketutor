# Gear — image-generation prompts

Source art for the ten `gear` lessons (Advanced level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below: it is still the look of the whole course. For `my-desk`, also attach the kept `headphones`,
  `game-controller` and `camera` pictures, and use that lesson's own reference line.
- Square, 1024 × 1024 or larger, PNG, opaque white background. Make `electric-guitar` as large as the
  tool allows: its six strings need the pixels.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/gear/<lesson-id>-<model>.png`, and record model, date and
  prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of, from what the earlier paths taught us:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again.
- **Every lesson is a flat view, seen straight on**: side views for the cap, the skateboard and the
  sneaker, front views for the rest, and the desk from straight above so the three things lie on it
  in the same views as in their own lessons.
- **Every part has its own dark outline**: lenses, pads, pocket, buttons, flash and knobs are closed
  shapes; nothing is told apart by color alone.
- **Parts touch only where one is attached to another**, and then along a shared edge drawn once
  (brim on crown, band on ear cup, shutter button on the camera's top, sole under the upper). The
  pocket, the sticks, the D-pad, the buttons, the lens, the flash and the knobs float inside their
  shape with a clear strip of color all around.
- **Details are single bold lines**: seams, zips, laces and strings are charcoal lines of the
  outline's weight, never cords, tubes or ribbons, and they float. The sneaker's two panel lines
  are the exception: they divide the upper on purpose and touch its outline at both ends.
- **Overlap is kept for the last lesson.** Before it, only two attachments hide anything: the
  skateboard's wheels stand in front of their trucks, and the guitar's neck lies on its body.
- **Six strings never cross a line**: the guitar's neck runs on down over the body, and the strings
  float inside that one shape from just under the nut to just above its end.
- **Dark things are purple, never charcoal**: the lenses, the D-pad, the sticks. A solid dark shape
  swallows its own outline when traced.
- **No highlights, shading, texture or shadow anywhere**: no glint on a lens or the camera's glass,
  no stitching, no wood grain, no grip-tape grain, no shadow on the desk.
- **No logos, letters or numbers** on anything; button colors stand in for button letters.
- **No living things**: no head in the cap or the headphones, no hands on the controller.

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

For `my-desk` only (apple attached, and the kept headphones, game controller and camera pictures):

```text
Match the first attached image exactly in line color, line weight, corner rounding and flatness of
color. This image is a small scene, not one subject, so the margins are smaller. The other attached
images show what the headphones, the game controller and the camera look like: draw them the same,
smaller, in the places the description gives.
```

## Lesson prompts

### 1 · `cap`

Objective: Dome crown with a curved brim and a top button.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on, the brim pointing to the right. No perspective: nothing
of the underside of the brim or of the inside of the cap shows.
SUBJECT: one baseball cap: a dome crown, exactly one curved brim and exactly one top button.
- Crown: one dome. A smooth round arc goes over the top, a little taller than half a circle, and
  one nearly level, very slightly sagging edge closes it along the bottom. The crown is about
  45% of the image width. Color: red #d8433b.
- Brim: one long, flat, gently curved shape like a slim leaf, sticking out to the right from the
  crown's bottom right corner and dipping a little toward its rounded tip. It is about two thirds
  as long as the crown is wide and about a sixth as tall as the crown. Its left end is attached
  to the crown: there it shares a short stretch of the crown's outline, one line drawn once.
  Everywhere else it is clear of the crown. Color: blue #5b8fc7.
- Button: exactly one small half-round bump on the very top of the crown, in the middle, about a
  tenth as wide as the crown. Its flat bottom is the crown's outline: one shared line.
  Color: yellow #f7cf46.
- Seam lines: exactly two single bold curved lines inside the crown, the same charcoal line as
  the outlines. One is in the left third of the crown and bows to the left, one is in the right
  third and bows to the right, like the lines on a beach ball. Each starts a little below the
  button and ends a little above the crown's bottom edge. They float: they touch neither the
  outline, nor the button, nor each other.
The whole cap, crown and brim together, fills about 70% of the image width.
Nothing else: no strap or buckle at the back, no air holes, no stitching, no badge, no logo, no
lettering, no head, no shadow. Five lines in total. Count: one brim, one button, two seam lines.
```

### 2 · `sunglasses`

Objective: Two lenses, a bridge and folded arms.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view. The sunglasses are folded shut and seen from the front and very slightly
from above, so the two folded arms show as two level bars behind the top of the lenses. No
perspective otherwise.
SUBJECT: one pair of folded sunglasses: exactly two lenses, exactly one bridge and exactly two
folded arms.
- Lenses: exactly two shapes of the same size, side by side and level, as in a mirror. Each is a
  rounded shape, wider than tall, nearly flat along the top and rounder along the bottom, about
  29% of the image width and 20% of its height. The lens's outline is the frame: no second line
  around it. Color: purple #7b4fa3.
- Bridge: exactly one short, gently arched bar between the two lenses, near their tops: a small
  closed shape about three line-widths thick. Each of its ends is attached to a lens and shares a
  short stretch of that lens's outline. Below the bridge, the gap between the lenses is plain
  white, about 8% of the image width. Color: red #d8433b.
- Arms: exactly two, as in a mirror, one above each lens. Each arm is one closed shape like a
  hockey stick lying down: a long, narrow, level bar about three line-widths thick, above its
  lens, whose outer end bends down in a short piece that lands on the lens's top outer corner and
  shares a short edge with it (the hinge). Everywhere else a clear gap of white, at least three
  line-widths wide, lies between the arm and the lens. The bar runs inward and ends in a rounded
  tip just short of the middle of the image. A clear gap of white, at least four line-widths
  wide, lies between the two tips, straight above the bridge. The arms do not touch each other
  or the bridge. Color: red #d8433b.
The sunglasses fill about 70% of the image width.
Nothing else: no glint or shine line on the lenses, no reflection, no second frame line, no nose
pads, no screws, no logo, no face, no shadow. Five lines in total. Count: two lenses, one bridge,
two arms.
```

### 3 · `skateboard`

Objective: Deck in side view with trucks and wheels.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on. The board is level. No perspective: nothing of the top
or the underside of the deck shows, and only the two near wheels show.
NO GROUND: the wheels stand on nothing. No ground line, no shadow.
SUBJECT: one skateboard from the side: one deck, exactly two trucks and exactly two wheels.
- Deck: one long, thin closed shape, the same thickness all along (about 4% of the image height).
  It is level in the middle, and both ends curve gently upward and end in rounded tips, the same
  on the left and on the right. Color: brown #8a5a33.
- Wheels: exactly two complete circles of the same size, each about 12% of the image width
  across, one under the deck a quarter of the way in from the left tip and one a quarter of the
  way in from the right tip. A clear gap of white, about as tall as the deck is thick, lies
  between the top of each wheel and the deck. Color: yellow #f7cf46.
- Hubs: exactly one small circle in the middle of each wheel, about a third as wide as the wheel.
  It floats: a wide ring of yellow lies all around it. Color: cream #f6e7b8.
- Trucks: exactly two, one above each wheel, joining it to the deck. Each truck is drawn with
  exactly two short straight lines that start on the deck's bottom edge and come down, leaning
  toward each other, to end exactly on the wheel's circle. The wheel stands in front of the
  truck, so the truck has no bottom line: the small area between the deck, the two lines and
  the top of the wheel is the truck. It is a little narrower than the wheel. Color: gray #c9ced6.
The skateboard fills about 75% of the image width.
Nothing else: no bolts on the deck, no grip-tape texture, no layers or stripe along the deck, no
graphics, no spokes, no motion lines, no ground, no shadow. Nine lines in total. Count: two
trucks, two wheels, two hubs.
```

### 4 · `backpack`

Objective: Rounded body with a front pocket, zips and straps.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, the backpack standing upright. No perspective: nothing
of its sides or its top shows.
SUBJECT: one school backpack: a rounded body, exactly one front pocket, exactly two zips, and
straps: exactly one carry handle and exactly two shoulder straps.
- Body: one tall rounded shape: a level bottom edge with rounded corners, upright sides, and a
  top rounded like an arch. About 45% of the image width and 62% of its height.
  Color: blue #5b8fc7.
- Front pocket: exactly one rounded rectangle, wider than tall, in the lower half of the body.
  It floats: a clear strip of blue, at least four line-widths wide, lies between it and the
  body's outline all around. Color: orange #f08a2c.
- Zips: exactly two single bold lines, the same charcoal line as the outlines, with no color:
  not tubes, not ribbons, no teeth. The first is one smooth arch across the upper half of the
  body, following the rounded top, floating in the blue: it touches neither the outline nor the
  pocket. The second is one straight level line inside the pocket, near its top, floating in
  the orange.
- Zip pulls: exactly two small upright rounded tabs, each about two line-widths wide and four
  tall, one hanging from the right end of each zip line: the line ends exactly on the top of
  the tab. The tabs touch nothing else. Color: yellow #f7cf46.
- Carry handle: exactly one single bold line, a small arch standing on the middle of the body's
  top, both of its ends landing on the body's outline. White shows through it.
- Shoulder straps: exactly two, as in a mirror, one on each side of the body. Each is one closed
  band, about three line-widths thick, bowed outward like the handle of a mug: its top end is
  attached to the body's side at shoulder height and its bottom end near the bottom corner,
  each end sharing a short stretch of the body's outline. Between the strap and the body a
  slim gap of plain white shows. Color: purple #7b4fa3.
The backpack with its straps and handle fills about 70% of the image height.
Nothing else: no side pockets, no bottle, no buckles, no stitching, no second pocket, no badge,
no logo, no key ring, no shadow. Nine lines in total. Count: one pocket, two zips, two zip
pulls, one handle, two shoulder straps.
```

### 5 · `headphones`

Objective: Arched band with two padded ear cups.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on, as if the headphones were worn by nobody: the band
arches over the top and one ear cup hangs at each end. No perspective, no head.
SUBJECT: one pair of over-ear headphones: exactly one arched band and exactly two ear cups, each
with exactly one pad.
- Band: one closed shape: a smooth half-circle arch, the same thickness all along (about 5% of
  the image width), like a rainbow with one stripe. Its two ends point straight down, and each
  end lands on the top of an ear cup, where it shares a short edge with the cup: one line drawn
  once. The space under the arch is plain white. Color: purple #7b4fa3.
- Ear cups: exactly two, as in a mirror, one at each end of the band. Each is an upright rounded
  rectangle, about twice as tall as wide, about 12% of the image width. Most of the cup hangs
  below the band's end. Color: red #d8433b.
- Pads: exactly two, one on the inner side of each cup, the side that faces the other cup. Each
  pad is an upright rounded shape, a little shorter than its cup and about half as wide. One
  long side of the pad is the cup's inner side: one shared line, drawn once. The pads do not
  touch the band. Color: cream #f6e7b8.
A wide gap of plain white lies between the two pads. The headphones fill about 70% of the image.
Nothing else: no cable, no plug, no microphone, no slider lines on the band, no buttons, no
circles or rings on the cups, no padding under the band, no logo, no head, no shadow. Five lines
in total. Count: one band, two cups, two pads.
```

### 6 · `game-controller`

Objective: Winged body with two sticks, a D-pad and four buttons.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat view of the controller's face, seen straight on, grips pointing down. No
perspective: nothing of its edges, its triggers or its back shows.
SUBJECT: one game controller: a winged body, exactly two sticks, exactly one D-pad and exactly
four buttons.
- Body: one smooth closed outline, the same on the left and on the right. A wide bar with a
  nearly level top and rounded shoulders, whose two ends swell downward into two rounded grips
  (the wings). Between the grips the bottom edge rises in one smooth, shallow arch. The body is
  about 70% of the image width and about 60% as tall as it is wide. Color: gray #c9ced6.
- D-pad: exactly one plus sign with four arms of equal length and square ends, one closed
  outline with twelve corners, in the upper left of the body. Color: purple #7b4fa3.
- Buttons: exactly four small circles of the same size in the upper right of the body, set like
  the four points of a diamond: top, bottom, left, right. The group is as big as the D-pad.
  Colors: top yellow #f7cf46, right red #d8433b, bottom leaf green #4f9d4a, left blue #5b8fc7.
- Sticks: exactly two, level with each other, lower down and nearer the middle: one below and
  to the right of the D-pad, one below and to the left of the buttons. Each stick is exactly two
  circles, one inside the other with the same center: an outer circle about as wide as the
  D-pad, and an inner circle half as wide, so a broad ring lies between them.
  Colors: the ring purple #7b4fa3, the inner circle cream #f6e7b8.
Everything on the body floats: a clear strip of gray, at least four line-widths wide, lies
between any two of these parts and between each part and the body's outline. No two circles touch.
Nothing else: no middle buttons, no touch pad, no triggers or shoulder buttons, no arrows on the
D-pad, no letters or symbols on the buttons, no lights, no cable, no seams, no logo, no hands,
no shadow. Ten lines in total. Count: two sticks, one D-pad, four buttons.
```

### 7 · `camera`

Objective: Box body with a lens barrel, flash and shutter button.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat front view, seen straight on: the lens points at the viewer, so the lens barrel is
a perfect circle. No perspective: nothing of the camera's top or sides shows.
SUBJECT: one simple camera: a box body, exactly one lens barrel with its glass, exactly one flash
and exactly one shutter button.
- Body: one rectangle with gently rounded corners, about 70% of the image width and about 60% as
  tall as it is wide. Color: orange #f08a2c.
- Lens barrel: exactly one large circle in the middle of the body, about 60% as wide as the body
  is tall. It floats: a clear strip of orange, at least four line-widths wide, lies between it
  and the body's outline above and below. Color: gray #c9ced6.
- Glass: exactly one smaller circle inside the barrel with the same center, half as wide, so a
  broad gray ring lies all around it. Color: blue #5b8fc7.
- Flash: exactly one small level rectangle in the body's upper left corner, about an eighth as
  wide as the body. It floats: orange lies all around it, and it touches neither the outline
  nor the lens barrel. Color: yellow #f7cf46.
- Shutter button: exactly one small, low rounded rectangle standing on the body's top edge, above
  the right third of the body, about an eighth as wide as the body. Its bottom edge is the
  body's top edge: one shared line, drawn once. Color: red #d8433b.
The camera with its button fills about 70% of the image width.
Nothing else: no glint or shine on the glass, no extra lens rings, no viewfinder, no grip, no
dials, no strap or strap lugs, no top plate line, no texture, no logo, no lettering, no shadow.
Five lines in total. Count: one lens barrel, one glass, one flash, one shutter button.
```

### 8 · `sneaker`

Objective: High-top in side view with sole, laces and panels.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: a flat side view, seen straight on, the toe pointing to the right. No perspective: nothing
of the inside of the shoe, its top opening or the underside of the sole shows.
NO GROUND: the sneaker stands on its own flat sole on plain white paper. No ground line, no shadow.
SUBJECT: one high-top sneaker from the side: one sole, one upper divided into exactly three
panels, and exactly four laces.
- Sole: one long, level band along the whole bottom of the shoe, with rounded ends, about 7% of
  the image height thick, its front end curving up a little under the toe. Color: cream #f6e7b8.
- Upper: one closed shape standing on the sole; its bottom edge is the sole's top edge, one
  shared line drawn once. At the back it rises nearly straight up to a high ankle, about as
  tall as two thirds of the sole's length. Its top edge is short and nearly level. From the
  front of the ankle it comes down in one long, gentle slope toward the toe and ends in a low,
  round toe at the front of the sole.
- Panel lines: exactly two single bold curved lines that divide the upper into three panels.
  Each touches the upper's outline at both of its ends, on purpose. The toe line starts on the
  slope a little above the toe and bows down to the sole's top edge, cutting off a rounded toe
  cap. The heel line starts on the ankle's top edge near the back and bows down to the sole's
  top edge, cutting off a narrow heel panel. The two lines stay far apart.
  Colors: toe cap gray #c9ced6, heel panel blue #5b8fc7, the large middle panel red #d8433b.
- Laces: exactly four short single bold straight lines in the middle panel, just under the
  slope and parallel to one another, lying across the slope like the rungs of a ladder, evenly
  spaced from above the toe cap up toward the ankle. The same charcoal line as the outlines, with
  no color: not cords, not ribbons. They float: each stops short of the slope's outline and
  touches nothing, with a clear gap of red at least three line-widths wide between neighbors.
The sneaker fills about 70% of the image width.
Nothing else: no eyelets, no bow, no tongue, no circle patch on the ankle, no stripes, no
stitching, no tread or lines on the sole, no logo, no foot, no sock, no shadow. Eight lines in
total. Count: two panel lines, three panels, four laces.
```

### 9 · `electric-guitar`

Objective: Contoured body, neck, headstock and six strings.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines: the six strings are exactly as bold as the outlines. The image is square.
VIEW: a flat front view, seen straight on, the guitar standing perfectly upright: headstock at
the top, body at the bottom. No perspective, no tilt.
SUBJECT: one solid-body electric guitar, drawn chunky like a toy so its strings have room: a
contoured body, one neck, one headstock and exactly six strings.
- Body: one smooth closed outline, the same on the left and on the right: a wide rounded bottom,
  a gentle waist, and at the top two short rounded horns, one on each side of the neck, with a
  rounded scoop between each horn and the neck. About 45% of the image width and 40% of its
  height. Color: red #d8433b.
- Neck: one long, straight, upright bar with parallel sides, about 17% of the image width wide,
  wide on purpose. It lies on the body, in front of it: it comes down between the two horns and
  runs on over the body to a level bottom edge at the middle of the body's height. It hides the
  body behind it. Its top edge is where the headstock begins. Color: brown #8a5a33.
- Headstock: one closed shape on top of the neck, a little wider than the neck and about as tall
  as it is wide, with a rounded top. Its bottom edge is the neck's top edge: one shared line,
  drawn once. Color: cream #f6e7b8.
- Strings: exactly six single bold straight upright lines inside the neck, parallel and evenly
  spaced, running the whole length of the neck. They float: each starts just below the neck's
  top edge and ends just above the neck's bottom edge, and touches nothing, neither the neck's
  outline nor another string. Between neighboring strings, and between the outer strings and the
  neck's sides, lies a clear strip of brown at least one and a half line-widths wide. No string
  runs onto the headstock or onto the red of the body.
- Bridge: exactly one small level rounded rectangle on the body, straight below the neck's bottom
  edge, as wide as the neck. It floats: a clear strip of red lies all around it.
  Color: gray #c9ced6.
- Knobs: exactly two small circles of the same size on the lower right of the body, one below
  and to the right of the other. They float, clear of each other, the bridge and the body's
  outline. Color: yellow #f7cf46.
The guitar fills about 86% of the image height, with clear white margin on all four sides.
Nothing else: no tuning pegs, no frets, no fret dots, no pickups, no pick guard, no switch, no
whammy bar, no strap buttons, no cable, no strap, no logo, no lettering, no shadow. Thirteen
lines in total. Count the strings: six. Count: one bridge, two knobs.
```

### 10 · `my-desk`

Objective: Headphones, controller and camera overlapping on a desk.

```text
LINE WEIGHT: every line is as bold as the outline of the first attached image: about 1% of the
image width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No
hairlines, no gray lines, however small the part. The image is square.
VIEW: a desk top seen from straight above, flat, with three things lying on it. Each thing is
drawn in the same flat view as in its own lesson. No perspective: no desk legs, no desk edge
thickness, nothing seen from the side.
THIS LESSON IS ABOUT OVERLAP: the three things lie partly on top of one another. Where one lies
on another it hides it: the hidden part is simply not drawn, and the lines of the thing behind
end exactly on the outline of the thing in front. Order from back to front: headphones, camera,
game controller.
SUBJECT: a desk top with exactly three things on it: headphones, a camera and a game controller.
- Desk: one large rectangle with gently rounded corners, about 86% of the image width and 80%
  of its height. Everything else lies inside it, clear of its outline. Color: brown #8a5a33.
- Headphones, at the back, in the upper left and middle of the desk, about half the desk's
  width: one arched band (purple #7b4fa3), exactly two upright ear cups (red #d8433b), and one
  pad on the inner side of each cup (cream #f6e7b8). The desk's brown shows under the arch.
- Camera, in the upper right, lying on the headphones' right ear cup so that about half of that
  cup and its pad are hidden behind the camera's left end: one rounded rectangle body (orange
  #f08a2c), one floating lens barrel circle (gray #c9ced6) with one smaller glass circle inside
  it (blue #5b8fc7), one small floating flash rectangle in its upper left corner (yellow
  #f7cf46), and one small shutter button standing on its top edge on the right (red #d8433b).
  The camera is about 40% of the desk's width.
- Game controller, in front of everything, in the lower middle of the desk, about half the
  desk's width: its winged body (gray #c9ced6) lies over the bottom of the headphones' left ear
  cup and over the camera's bottom left corner, hiding both. Nothing lies on the controller. On
  it float exactly one plus-sign D-pad in the upper left (purple #7b4fa3), exactly four small
  round buttons in a diamond in the upper right (top yellow #f7cf46, right red #d8433b, bottom
  leaf green #4f9d4a, left blue #5b8fc7), and exactly two sticks lower down, each a single
  plain circle (purple #7b4fa3), with no inner circle this time.
The camera's lens, glass, flash and button and the whole arch of the headphones stay fully in
view. Apart from the two overlaps described, nothing touches anything else.
The desk fills about 86% of the image width, with clear white margin on all four sides.
Nothing else: no shadows under anything, no cable, no mouse, no keyboard, no screen, no lamp, no
cup, no pencils, no paper, no wood grain, no desk legs, no drawer, no logos, no lettering. About
nineteen lines in total. Count: three things, two ear cups, two pads, four buttons, two sticks.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding shine on the lenses, stitching, laces as
ribbons, thin strings, frets, logos or shadows despite the prompts, regenerate rather than keep it.
