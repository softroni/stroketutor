# Landscape — image-generation prompts

Source art for the ten `landscape` lessons (Advanced level) in `plan.json`, written for a raster
image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one). The style prompt below is
  `style-v2`, word for word as in [fruits-prompts.md](fruits-prompts.md) (its own spelling included;
  only the image model reads it). Everything else here is US English.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request, with the reference
  line below: it is still the look of the whole course. Once `rolling-hills` is kept, attach it as a
  second picture to the later requests too: it fixes what a scene on white paper looks like.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/landscape/<lesson-id>-<model>.png`, and record model,
  date and prompt version (`style-v2`) in the lesson's `--source`.

What the prompts on this path take care of:

- **Every prompt opens with a LINE WEIGHT paragraph.** Hairlines were the main reason pictures had
  to be made again on earlier paths.
- **Every picture is a scene, so every prompt has an EXCEPTION TO THE STYLE paragraph**: the style
  prompt asks for one subject and forbids a horizon. The scene is still an island of drawing on
  white paper, about 70% of the image, and the sky is always plain paper.
- **One depth idea per lesson**: overlap (rolling-hills), size (desert-dunes), paler with distance
  (mountain-range), narrowing (winding-river), mirror image (lake-reflection), texture lines
  (waterfall), overlap + horizon + shrinking waves (sea-cliffs), front / middle / back
  (forest-path), one-point perspective (country-road), and all of it in one scene (mountain-valley).
- **Land has to be closed shapes to be colored.** Hills, dunes and mountain rows stand on a short
  level bottom line. Where flat land reaches a horizon (winding-river, country-road, sea-cliffs,
  mountain-valley) the land is one straight-edged panel whose top edge is the horizon; the prompt
  says it is not a frame.
- **Overlap only where the land itself overlaps**, always the same simple way: the shape behind
  stops on the outline of the shape in front. Everything else either floats inside one color (the
  cacti, the rocks, the cabin, the fence posts, the ripples and waves) or stands on a shared line
  with white gaps beside it (the pines, the trunks).
- **"Paler" is a paler palette color with its own outline**, never a tint: purple → blue → gray for
  the mountain rows, brown → cream for the headlands, and the lake's reflections are the paler
  partner of what they mirror (purple → gray, dark green → pale green), which also keeps a shape
  and its mirror image from sharing a color across the shore line.
- **The only shadow on the path is the dunes' shadow side**, a closed orange shape beside a yellow
  one, divided by a crest line. The objective asks for it.
- **Water and wave lines are single bold lines that float**; wavy lines carry a hump count.
- **No living things**: no birds, no fish, no people, no animals in the fields. Plants are fine.

## Style prompt (`style-v2`) — identical for all paths

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
Match the attached image exactly in line color, line weight, corner rounding and flatness of
color. The subject changes: this image is a small landscape scene made of several shapes, exactly
as the description says, not one centered subject.
```

## Lesson prompts

### 1 · `rolling-hills`

Objective: Three overlapping hills under a horizon line and a low sun.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject, and it does show a
horizon line. It is still flat: no perspective, no shading. The sky and everything outside the
shapes stays plain white paper. There is no frame around the scene.
SUBJECT: three rounded hills, one in front of another, with a level horizon line behind them and
a low sun. Here the hills do overlap: that is what this lesson teaches. A hill that is behind
another simply stops where it meets the outline of the hill in front; hidden parts are not drawn.
- Bottom line: one single straight level line near the bottom, from 15% to 85% of the image
  width. The front hill stands on it.
- Front hill: one smooth low arch, like a wide upside-down bowl, rising from the left end of the
  bottom line and coming down to its right end. Its highest point is left of the middle and it is
  about a quarter as tall as it is wide. With the bottom line it is one closed shape.
  Color: dark green #2f6b3a.
- Middle hill: one smooth arch behind the front hill, on the right. It starts on the front hill's
  outline a little right of the front hill's top, rises clearly higher than the front hill, and
  comes down to end on the front hill's outline near its right end. Color: leaf green #4f9d4a.
- Far hill: one smooth arch behind both, on the left, the highest of the three. It starts on the
  front hill's outline near its left end, rises, and comes down to end on the middle hill's
  outline, below the middle hill's top. Color: pale green #b9dc8a.
- Horizon: one single bold straight level line behind the hills, at half the height of the far
  hill. The hills hide its middle, so it shows as two pieces: a left piece from 12% of the image
  width to the far hill's outline, and a right piece from the middle hill's outline to 88% of the
  image width. Each piece ends exactly on the hill's outline. A charcoal line with no color.
- Sun: exactly one plain circle, low in the sky on the right, above the right piece of the
  horizon. It floats: a clear white gap separates it from the horizon line and from the middle
  hill. It is about one sixth as wide as the scene. No rays. Color: yellow #f7cf46.
The whole scene fills about 70% of the image, in the middle, with clear white margin on all four
sides.
Nothing else: no rays, no clouds, no trees, no bushes, no grass marks, no flowers, no path, no
fence, no birds, no shading on the hills, no sky color, no frame. Seven lines in total: three
arches, the bottom line, two horizon pieces and the sun.
```

### 2 · `desert-dunes`

Objective: Three dunes with shadow sides and two cacti, the far one smaller.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject, and each dune has a
flat shadow side, because that is what the lesson teaches. A shadow side is a closed shape with
its own dark outline and one flat color: no gradient, no soft edge. The sky and everything
outside the shapes stays plain white paper. There is no frame around the scene.
SUBJECT: three sand dunes and two cacti. The near cactus is big, the far cactus is small: that
is how the picture shows distance. A dune that is behind another simply stops where it meets the
outline of the dune in front; hidden parts are not drawn.
- Bottom line: one single straight level line near the bottom, from 15% to 85% of the image
  width. The front dune stands on it.
- Front dune: one low smooth hump rising from the left end of the bottom line to a softly
  rounded peak right of the middle, then coming down to the right end of the bottom line. It is
  about a third as tall as it is wide.
- Left back dune: one smooth hump behind the front dune, on the left. It starts on the front
  dune's outline near its left end, rises to a rounded peak higher than the front dune's, and
  comes down to end on the front dune's outline left of the front dune's peak.
- Right back dune: one smaller smooth hump behind the front dune, on the right. It starts on the
  front dune's outline right of its peak, rises to a rounded peak a little higher than the front
  dune's, and comes down to end on the front dune's outline near its right end. The two back
  dunes do not touch each other: white paper shows between them.
- Crest lines: exactly three, one on each dune. Each is one single bold gently curved line from
  the dune's peak down to the dune's lower edge, leaning to the right, touching the outline at
  both ends. It divides the dune into a big sunny side on the left and a narrow shadow side on
  the right. Sunny sides: yellow #f7cf46. Shadow sides: orange #f08a2c.
- Near cactus: one closed outline: a tall upright post with a rounded top and a flat foot, with
  exactly two arms, one on each side. Each arm goes out level and then turns straight up, ending
  in a rounded tip; the left arm is lower than the right arm. The whole cactus stands inside the
  sunny side of the front dune, on its left half, with sand color all around it: it touches no
  outline. It is about one fifth as tall as the image. Color: dark green #2f6b3a.
- Far cactus: exactly the same shape, half as tall, standing inside the sunny side of the left
  back dune, with sand color all around it: it touches no outline. Color: dark green #2f6b3a.
The whole scene fills about 70% of the image, in the middle, with clear white margin on all four
sides.
Nothing else: no sun, no clouds, no spines, no ridge lines on the cacti, no flowers, no rocks, no
ripple marks in the sand, no cast shadows on the ground, no footprints, no sky color, no frame.
Count: three dunes, three crest lines, two cacti.
```

### 3 · `mountain-range`

Objective: Three rows of peaks, each row paler than the one in front.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject. It is still flat: no
perspective, no shading. The sky and everything outside the shapes stays plain white paper.
There is no frame around the scene.
SUBJECT: three rows of mountain peaks, one row behind another. The front row is the darkest and
each row behind it is paler: that is how the picture shows distance. Every peak is a plain
triangle tip made of two straight slopes with a gently rounded point. A row that is behind
another simply stops where it meets the outline of the row in front; hidden parts are not drawn.
- Bottom line: one single straight level line near the bottom, from 15% to 85% of the image
  width.
- Front row: exactly two peaks of the same height, side by side, their tips at about 38% and 62%
  of the image width, with one V-shaped valley between them that comes halfway down. One zigzag
  line of four straight slopes; both ends stand on the bottom line, well inside its two ends.
  With the bottom line it is one closed shape. Color: purple #7b4fa3.
- Middle row: exactly three peaks, clearly taller than the front row: one in the middle, showing
  in the front row's valley and rising above it, and one on each side, outside the front row. The
  two outer slopes come down to the two ends of the bottom line. The inner slopes end on the
  front row's outline. The valleys between the middle row's peaks stay above the front row's
  tips. Color: blue #5b8fc7.
- Back row: exactly two peaks, the tallest in the image, their tips above the middle row's two
  valleys. Each shows as a plain triangle tip whose two slopes end on the middle row's outline.
  The two back peaks do not touch each other. Color: gray #c9ced6.
The whole scene fills about 70% of the image, in the middle, with clear white margin on all four
sides.
Nothing else: no snow caps, no ridge lines, no crack lines, no shading, no trees, no clouds, no
sun, no birds, no lake, no sky color, no frame. Count: seven peaks, two in front, three in the
middle, two at the back. Three colors, one for each row.
```

### 4 · `winding-river`

Objective: S-shaped river narrowing to the horizon between two fields.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject, and it does show a
horizon line. The land is drawn as one panel with straight edges so that every field is a closed
shape. It is not a picture frame: nothing is drawn above the horizon, and the sky and everything
outside the panel stays plain white paper.
SUBJECT: a river seen from a little above, winding away across flat land to the horizon. It is
wide where it is near and narrows to a point where it is far: that is how the picture shows
distance.
- Land panel: one rectangle with four straight sides and gently rounded corners, a little wider
  than tall, about 70% of the image width. Its top edge is the horizon.
- River: two single bold smooth bank lines. They start on the panel's bottom edge, left of the
  middle, about a quarter of the panel's width apart. Both wind upward together in one big letter
  S: first swinging to the right, then back to the left, then to the right again, exactly three
  gentle bends. The river gets steadily narrower all the way, and the two banks meet in one
  point exactly on the horizon line, right of the middle. The banks never touch each other
  before that point and never touch the panel's sides. Color of the water: blue #5b8fc7.
- Left field: everything in the panel to the left of the river, one closed shape.
  Color: leaf green #4f9d4a.
- Right field: everything in the panel to the right of the river, one closed shape.
  Color: yellow #f7cf46.
Nothing else: no ripple lines, no rocks, no bridge, no boat, no trees, no bushes, no crop rows,
no fences, no hills, no sun, no clouds, no sky color, nothing above the horizon. Six lines in
total: the four sides of the panel and the two banks. Three colors.
```

### 5 · `lake-reflection`

Objective: Peak and three pines mirrored in a lake with four ripple lines.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject. It is still flat: no
perspective, no shading. Every reflection is a closed shape with its own dark outline and one
flat color, not a see-through or blurred copy. The sky and everything outside the shapes stays
plain white paper. There is no frame around the scene.
SUBJECT: one mountain peak and three pine trees standing on the far shore of a lake, each with
its upside-down mirror image in the water directly below it.
- Shore line: one single bold straight level line across the middle of the image, from 15% to
  85% of the image width.
- Peak: one plain triangle with a gently rounded tip, standing on the left half of the shore
  line. Its bottom edge is the shore line. It is about a quarter of the image tall and a little
  wider than tall. Color: purple #7b4fa3.
- Pines: exactly three, in a row on the right half of the shore line. Each is one plain tall
  narrow triangle standing on the shore line, all the same size, about two thirds as tall as the
  peak. No trunks, no branches, no zigzag sides. They do not touch each other or the peak: a
  clear gap of white separates each from the next. Color: dark green #2f6b3a.
- Lake: one closed shape hanging below the shore line: its top edge is the whole shore line, and
  below it one smooth curve like a wide shallow bowl, from the left end of the shore line round
  to the right end. It is deeper than the peak is tall. Color: blue #5b8fc7.
- Reflection of the peak: the same triangle upside down, hanging from the shore line exactly
  below the peak, its tip pointing down, the same size, wholly inside the lake.
  Color: gray #c9ced6.
- Reflections of the pines: exactly three narrow triangles upside down, each hanging from the
  shore line exactly below its pine, tip pointing down, the same size, wholly inside the lake.
  Color: pale green #b9dc8a.
- Ripple lines: exactly four short single bold straight level lines floating in the lake below
  the reflections, of different lengths, scattered left and right. They touch nothing: not the
  lake's outline, not a reflection, not each other.
The whole scene fills about 70% of the image, in the middle, with clear white margin on all four
sides.
Nothing else: no snow cap, no trunks, no wavy reflections, no broken reflections, no clouds, no
sun, no moon, no boat, no rocks, no reeds, no birds, no sky color, no frame. Count: one peak,
three pines, four upside-down copies, four ripple lines.
```

### 6 · `waterfall`

Objective: Cliff with falling-water lines, a mist pool and three rocks.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject. It is a flat front
view: no perspective, no shading. The sky and everything outside the shapes stays plain white
paper. There is no frame around the scene.
SUBJECT: a waterfall dropping straight down the middle of a cliff into a pool, with a puff of
mist where it lands and three rocks in the pool.
- Foot line: one single straight level line a little below the middle of the image, about 55%
  of the image width long. The cliff stands on it and the pool hangs below it.
- Cliff: one tall upright block with a level top edge, two upright sides and the foot line as
  its bottom edge, a little taller than wide, corners gently rounded.
- Waterfall: one upright band down the middle of the cliff, from the cliff's top edge to the
  mist, about a quarter of the cliff's width. Its two edges are two single bold straight upright
  lines, shared with the cliff. It divides the cliff into a left part and a right part of the
  same width. Color of the waterfall: blue #5b8fc7. Color of both cliff parts: brown #8a5a33.
- Falling-water lines: exactly three single bold straight upright lines inside the waterfall,
  side by side with clear gaps, each about half as long as the waterfall, the middle one starting
  a little lower than the other two. They float: they touch neither edge of the waterfall, nor
  its top, nor the mist, nor each other. No color.
- Mist: one low cloud shape sitting on the foot line at the bottom of the waterfall, with a flat
  bottom edge on the foot line and exactly three round bumps on top, the middle bump the
  biggest. It is a little wider than the waterfall, so it hides the bottom of the waterfall and
  a small piece of the cliff on each side. Color: gray #c9ced6.
- Pool: one closed shape hanging below the foot line: its top edge is the whole foot line, and
  below it one smooth curve like a wide shallow bowl, about a third as deep as the cliff is
  tall. Color: blue #5b8fc7.
- Rocks: exactly three rounded boulders inside the pool, each a small closed shape like a
  flattened circle, of three different sizes, spread left, middle and right. They float: water
  color all around each; they touch neither the pool's outline nor each other.
  Color: brown #8a5a33.
The whole scene fills about 70% of the image, in the middle, with clear white margin on all four
sides.
Nothing else: no crack lines or ledges on the cliff, no grass, no trees, no bushes, no splash
drops, no ripple rings, no foam, no rainbow, no river flowing away, no clouds, no sun, no sky
color, no frame. Count: three falling-water lines, three bumps on the mist, three rocks.
```

### 7 · `sea-cliffs`

Objective: Two overlapping headlands, a sea stack and three rows of waves.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject, and it does show a
horizon line. The sea is drawn as a panel with straight edges so that it is a closed shape. It is
not a picture frame: the sky and everything outside the shapes stays plain white paper.
SUBJECT: a coast seen from the side. Two headlands reach into the sea from the left, the near
one in front of the far one, with one sea stack (a lone pillar of rock standing in the water)
beyond them and three rows of waves. Here the headlands do overlap: the far one simply stops
where it meets the near one's outline; hidden parts are not drawn.
- Near headland: one closed shape with four straight sides on the left of the scene: an upright
  left edge; a level top edge, high up; a cliff face dropping from the top edge's right end
  almost straight down, leaning a little to the right, to the bottom; and a level bottom edge.
  It is the tallest thing in the image, about 60% of the image tall and about a third of the
  scene wide. Color: brown #8a5a33.
- Far headland: one smaller shape behind it, reaching farther to the right. It starts on the
  near headland's cliff face: a level top edge, clearly lower than the near headland's top, runs
  to the right; a cliff face drops almost straight down, leaning a little to the right; and a
  level foot edge runs back left to the near headland's cliff face, clearly higher up than the
  near headland's bottom. It ends at about the middle of the scene. Color: cream #f6e7b8.
- Sea: one closed panel filling the rest of the scene: its bottom edge carries on level from the
  near headland's bottom edge to the right; an upright right edge, with a gently rounded corner;
  and its top edge is the horizon. The headlands' outlines are its left side.
  Color: blue #5b8fc7.
- Horizon: one single bold straight level line at half the height of the far headland's cliff
  face. The sea stack hides part of it, so it shows as two pieces: from the far headland's cliff
  face to the sea stack, and from the sea stack to the top of the sea's right edge. Each piece
  ends exactly on an outline.
- Sea stack: exactly one tall narrow pillar of rock standing in the sea, right of the far
  headland with a clear stretch of water between them: a closed shape with two nearly upright
  sides, a flat top with rounded corners and a level foot edge. Its foot is below the horizon
  and its top is above it, lower than the far headland's top. It touches nothing but the two
  horizon pieces. Color: gray #c9ced6.
- Waves: exactly three rows in the open water below the sea stack, one above another with clear
  gaps. Each row is one single bold wavy line with exactly three soft humps, like a row of three
  low hills. The lowest row is the longest with the biggest humps, the next is shorter, the top
  row is the shortest with the smallest humps. They float: they touch neither the sea's edges,
  nor a headland, nor the sea stack, nor each other. No color.
The whole scene fills about 70% of the image, in the middle, with clear white margin on all four
sides.
Nothing else: no grass on the headlands, no crack lines, no lighthouse, no boats, no birds, no
foam, no spray, no rocks at the foot of the cliffs, no beach, no clouds, no sun, no sky color.
Count: two headlands, one sea stack, three wave lines of three humps each.
```

### 8 · `forest-path`

Objective: Path between six trunks, big in front and small far away.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject. The viewer stands on a
path and looks along it into a forest. The forest floor, the spaces between the trunks and
everything outside the shapes stay plain white paper. There is no frame around the scene.
SUBJECT: a path running away between six tree trunks, three on each side, under one band of
leaves. The front trunks are big and low in the picture, the far trunks small and higher up:
that is how the picture shows front, middle and back.
- Leaves: one wide closed shape across the top of the scene: a straight level bottom edge, and
  above it a top edge made of exactly five big round humps, like a long cloud. It hides the top
  of every trunk. Color: dark green #2f6b3a.
- Trunks: exactly six, each a plain closed shape with two straight upright sides and a level
  foot, its top ending exactly on the bottom edge of the leaves (a shared line). No branches, no
  roots, no bark lines. Three stand left of the path and three right, as in a mirror:
  - front pair: the outermost, the widest (each about 9% of the image width), with the lowest
    feet, near the bottom of the scene;
  - middle pair: closer to the middle, about two thirds as wide, their feet clearly higher up;
  - back pair: closest to the middle, about one third as wide, their feet higher still.
  No trunk touches or hides another trunk, and none touches the path: a clear gap of white on
  both sides of every trunk. Color of all six: brown #8a5a33.
- Path: one closed shape between the two rows of trunks. It has a level bottom edge, level with
  the feet of the front pair and about a third of the scene wide; two smooth side edges that
  come steadily closer together as they rise, with one gentle bend to the right; and a short
  level far end, no wider than a back trunk, level with the feet of the back pair.
  Color: cream #f6e7b8.
The whole scene fills about 70% of the image, in the middle, with clear white margin on all four
sides.
Nothing else: no branches, no single leaves, no bushes, no grass, no mushrooms, no stones, no
fallen logs, no light rays, no shadows across the path, no ground color, no sky, no frame.
Count: six trunks, five humps, one path.
```

### 9 · `country-road`

Objective: One-point perspective road with five shrinking fence posts.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
VIEW: this one image is drawn in one-point perspective. The viewer stands in the middle of a
straight road across flat land and looks along it. There is exactly one vanishing point, on the
horizon. All upright edges stay perfectly upright; every edge that goes away from the viewer
aims exactly at the vanishing point.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject, and it does show a
horizon line and a vanishing point: they are what the lesson teaches. The land is drawn as one
panel with straight edges so that every field is a closed shape. It is not a picture frame:
nothing is drawn above the horizon, and the sky stays plain white paper.
SUBJECT: a straight country road running away to one vanishing point, with a row of exactly five
fence posts along its right side, each one smaller than the one before.
- Land panel: one rectangle with four straight sides and gently rounded corners, a little wider
  than tall, about 70% of the image width. Its top edge is the horizon.
- Vanishing point: exactly one small solid round dot in the charcoal line color, on the horizon
  line in the middle of its width, about three line-widths across.
- Road: one tall triangle with three straight sides: its bottom edge is the middle third of the
  panel's bottom edge, and its two side edges rise to meet exactly at the vanishing point.
  Color: cream #f6e7b8.
- Left field: everything in the panel to the left of the road, one closed shape.
  Color: leaf green #4f9d4a.
- Right field: everything in the panel to the right of the road, one closed shape.
  Color: pale green #b9dc8a.
- Fence posts: exactly five, in the right field. Each is a plain narrow upright closed shape
  with four straight sides and a flat top. The nearest is the biggest: low down, near the
  panel's bottom right, about a quarter of the panel tall. Each next post stands farther along
  toward the vanishing point and is clearly smaller, thinner and higher up, and the gaps between
  posts get smaller too. All five feet lie on one straight slanted row that aims at the
  vanishing point, and all five tops lie on another. Every post is wholly inside the right
  field with field color all around it: no post touches the road, the horizon, the panel's
  edges or another post. No rails, no wires. Color: brown #8a5a33.
Nothing else: no rails or wires between the posts, no center marks on the road, no guide lines,
no dashed lines, no trees, no bushes, no grass marks, no signs, no hills, no clouds, no sun,
nothing above the horizon, no lettering. Seven lines, five posts and one dot in total. Count the
posts: five.
```

### 10 · `mountain-valley`

Objective: Pine in front, cabin and river in the middle, pale peaks behind.

```text
LINE WEIGHT: every line is as bold as the outline of the attached apple: about 1% of the image
width (10 to 12 pixels on a 1024-pixel image), in the same very dark charcoal. No hairlines, no
gray lines. The image is square.
EXCEPTION TO THE STYLE: this image is a small landscape, not one subject. The valley floor is
drawn as one panel with straight edges so that the land is closed shapes. It is not a picture
frame: the sky stays plain white paper. The zigzag sides of the pine are asked for by name.
SUBJECT: a valley with three distances: one big pine tree in front, a small cabin and a river in
the middle, and two pale mountain peaks at the back.
- Valley floor: one rectangle with straight left, right and bottom edges and gently rounded
  bottom corners, wider than tall, about 70% of the image width and about 40% of the image
  tall. Its level top edge is the far line, where the valley floor ends.
- Peaks: exactly two plain triangles with gently rounded tips standing on the far line, side by
  side on the middle and right of it, the left one taller. Their feet meet at one point on the
  far line and they do not overlap. Each peak's bottom edge is the far line. No snow caps.
  Color of both: gray #c9ced6.
- River: two single bold smooth bank lines starting on the floor's bottom edge, right of the
  middle, about a fifth of the floor's width apart. They wind upward with exactly two gentle
  bends, coming steadily closer together, and meet in one point on the far line, exactly where
  the two peaks' feet meet. Color of the water: blue #5b8fc7. The floor to the left and to the
  right of the river: pale green #b9dc8a.
- Cabin: small, in the middle distance, inside the floor to the right of the river, halfway up
  the floor, with floor color all around it: it touches nothing. A flat front view: one square
  wall, brown #8a5a33; one triangle roof sitting on the wall's top edge (a shared line), a
  little wider than the wall, red #d8433b; one upright door standing on the middle of the
  wall's bottom edge (a shared line), cream #f6e7b8. No window, no chimney.
- Pine: big, in front, on the left. A short upright trunk with a flat foot, brown #8a5a33,
  standing inside the floor near its bottom left with floor color all around its foot. On top
  of the trunk, one closed outline for the branches: exactly three tiers, like three triangles
  stacked, each higher tier narrower, giving three points on each zigzag side and one tip on
  top; its level bottom edge sits on the trunk's top (a shared line) and is wider than the
  trunk. Color: dark green #2f6b3a. The pine is about 55% of the image tall: its upper part
  rises in front of the far line and ends in the white sky to the left of the peaks, touching
  no peak. The far line stops at the pine's outline on one side and carries on from its outline
  on the other.
The whole scene fills about 70% of the image, in the middle, with clear white margin on all four
sides.
Nothing else: no snow caps, no window, no chimney, no smoke, no path, no fence, no second tree,
no bushes, no rocks, no ripple lines, no clouds, no sun, no birds, no sky color. Count: one
pine with three tiers, one cabin, one river, two peaks.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`. Flat color and an even dark line
are what make them traceable; if a model keeps adding a sky color, clouds, grass marks, snow caps,
shading on the hills, a picture frame or birds despite the prompts, regenerate rather than keep it.
