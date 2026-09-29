# Urban Sketching — image-generation prompts

Source art for the twelve `urban-sketching` lessons (Advanced level, learners aged 16 and up), written for a raster
image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`. The **system prompt** is the
Advanced level's; only the **lesson prompt** changes.

## How to run them

- **System prompt: `style-v4-advanced`**, the Advanced level's, copied from the level's menu in the Studio
  (System prompt…). It lives in `web/src/studio/levelPrompts.ts`. Give it to the image model as its system /
  instructions prompt, once, and send each lesson prompt below as the message. It already carries the course's
  look, the line weight, how an attached picture is matched, perspective, drawn light and shadow, texture,
  reflections, the palette and the composition, so the lesson prompts add to it and never say it again.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request; the system prompt says how to match
  it, so there is no reference line. Once `tram` and `shop-front` are kept, attach them as well to `tram-hill`: they
  fix what the tram and the café front look like in the finale. No other lesson needs a second picture.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the prettiest. Reject
  any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/urban-sketching/<lesson-id>-<model>.png`, and record model, date and the
  system prompt's version (`style-v4-advanced`) in the lesson's `--source`.

What the lesson prompts on this path take care of, beyond the system prompt:

- **A VIEW paragraph only where the view needs saying.** Four lessons are flat fronts and have none (`shop-front`,
  `balcony`, `brick-window`, `rooftops`); the others say how they are seen, the bridge for its reflection.
- **Vanishing points stay outside the picture in the two-point views** (`phone-box`, `street-corner`, `tram`): at
  70% of the image, dots on the page would squash the far walls. The eye level is drawn only where the objective
  names it: two short pieces of horizon beside the corner building, and one piece beside the hill street, whose
  road ends at the one dot on the path.
- **Light and shadow only where the objective asks**: the flower box's shadow on the wall (`balcony`) and the
  hydrant's shadow side and cast shadow (`fire-hydrant`), both lit from the upper left. Cast shadows are gray, as
  on Light & Shadow; a shadow side is the darker partner of its color (red → brown).
- **Texture only where the objective asks**: nine bricks in three patches (`brick-window`) and six cobblestones
  (`fire-hydrant`). Both are counted, closed and floating, never a pattern.
- **Overlap only where the objective is about it**: the doors behind the railing (`balcony`), the four roofs
  (`rooftops`), and in the finale the tram in front of the houses and the houses in front of the rooftops.
- **Details are single lines**: railing bars and rail, awning stripe lines, water arcs, tram rails, the trolley
  pole, tank legs, street edges, the shine on glass. Each prompt calls them charcoal lines with no color.
- **One color scheme for the town**: windows and glass blue, doors brown, dark openings purple, as on Buildings.
  Where the system prompt's "neighboring areas never share a color" meets a thing that is one color in life (a red
  phone box, a door's two leaves, bricks in a brick wall), the prompt gives it two colors of one family or joins
  the parts into one shape.
- **Clean house style for lessons 1–11**, closed shapes and exact corners, as the system prompt asks. The sketchy
  look arrives only in the finale, as fading edges the tracer can still read: the street left uncolored between
  two lines that end open, and the plainest, palest parts at the edges.
- **No living things** (no people, pigeons or cats), no words on signs, the tram or the phone box, no cars.

## System prompt (`style-v4-advanced`)

Not copied here: take it from the Advanced level's menu in the Studio, or from `ADVANCED` in
[levelPrompts.ts](../../web/src/studio/levelPrompts.ts). A change to it gets a new version, so a lesson's `--source`
still says which prompt made its picture.

## Lesson prompts

Each is complete as written, on top of the system prompt; the counts are the lesson's teaching points.

### 1 · `shop-front`

Objective: A bookshop front: striped awning, a framed window of books, a paneled door and a potted bush.

The first prompt (a plain wall, sign, awning, window and door, eleven lines) was too simple for Advanced, the
creator found on 2026-09-29, and "make it interesting" gave a lit room behind the glass that cannot be drawn. This
one adds what makes a shop look real, each part a closed shape or one bold line: a cornice, a framed sign, a
framed window with books standing in it, a door with glass, a panel and a knob, two panels under the window and a
potted bush. Its first result had pale shine tubes, a second cornice over a dark strip, bands on the books and a
rim on the pot, so the prompt now says no to each. The second (with `style-v4-advanced`) was right but for the books:
"a small gap between neighbors" came out 2–6 px wide, and the trace fused the books into one dark block, so they
now stand pressed together, sharing one line.

```text
SUBJECT: the front of one small bookshop at street level, seen straight on: a wall with a cornice
along its top, a blank framed sign, a striped awning, a framed shop window with five books standing
in it, two panels under the window, a door with a glass pane, and a potted bush standing to the
left of the shop. The whole picture, bush included, fills about 70% of the image's width.
- Wall: one closed shape with four straight sides, a little wider than tall. Color: dark green
  #2f6b3a.
- Cornice: one single long flat shape lying on the wall's top edge (one shared line), about four
  line-widths tall, sticking out a little past the wall at both ends. Only one band: no second
  band, step or molding under it. Color: leaf green #4f9d4a.
- Sign: one long flat shape with four straight sides floating across the top of the wall, almost
  as wide as the wall, with a clear strip of wall color at least three line-widths tall between it
  and the cornice, and at both ends. Color: yellow #f7cf46. Inside it floats one smaller shape with
  four straight sides, with a clear strip of yellow all around it. Color: cream #f6e7b8. Both are
  blank: nothing written or drawn on them.
- Awning: one closed shape floating under the sign, with a clear strip of wall color at least three
  line-widths tall between them: a straight level top edge a little narrower than the sign, two
  short sides that lean outward a little, and a bottom edge made of exactly seven shallow round
  scallops. Exactly six straight lines divide it into seven stripes of equal width: each line runs
  from the top edge down to the point where two scallops meet, touching both on purpose, and the
  lines fan out a little like the sides. Stripe colors from left to right: red #d8433b, cream
  #f6e7b8, red, cream, red, cream, red. No shading, bands or hems on the stripes.
- Window: under the left part of the awning, about half as wide as the wall, floating, with a
  clear strip of wall color all around it, at least three line-widths wide between it and the
  scallops. Its bottom edge is about one quarter of the wall's height above the wall's bottom edge.
  The frame is one shape with four straight sides, color yellow #f7cf46; the glass is one shape
  with four straight sides floating inside it, with a strip of frame about three line-widths wide
  all around. Color of the glass: blue #5b8fc7.
- Window shine: exactly two short straight lines in the glass's upper left corner, parallel,
  slanting up to the right, floating, touching nothing. Bold charcoal lines like every other line:
  not white, not pale, not filled.
- Books: exactly five books standing on the glass's bottom edge (one shared line each), in the
  right part of the glass, each one plain tall narrow shape with four straight sides and no band
  or line across it, of different heights, the tallest reaching about halfway up the glass. They
  stand pressed together in one row: each book shares its side with its neighbor as one single
  line, drawn once, with no gap and no double line between them. Colors from left to right: red
  #d8433b, cream #f6e7b8, purple #7b4fa3, orange #f08a2c, leaf green #4f9d4a.
- Panels: exactly two shapes with four straight sides side by side under the window, floating in
  the wall, together about as wide as the window, with a clear strip of wall color around and
  between them. Color: leaf green #4f9d4a.
- Door: one tall shape with four straight sides under the right part of the awning, standing on
  the wall's bottom edge (one shared line), its top level with the window frame's top, with a
  clear strip of wall color between it and the window and at least three line-widths between it
  and the scallops. Color: brown #8a5a33.
- Door glass: one shape with four straight sides floating in the door's upper half. Color: blue
  #5b8fc7. In its upper left corner, exactly two short shine lines like the window's: bold
  charcoal, parallel, slanting up to the right, floating.
- Door panel: one shape with four straight sides floating in the door's lower part. Color: orange
  #f08a2c.
- Knob: one small circle on the door's left side, halfway between the glass and the panel,
  floating in the brown with a clear gap to the glass, the panel and the door's edge. Color:
  yellow #f7cf46.
- Potted bush: standing to the left of the wall with a clear gap of white, at least three
  line-widths wide, between the bush and the wall. The pot's bottom is level with the wall's
  bottom edge; pot and bush together are about one quarter as tall as the wall. The pot is one
  shape wider at the top than at the bottom, with no rim line. Color: orange #f08a2c. The bush is
  one closed shape sitting on the pot's top edge (one shared line), wider than the pot, with
  smooth sides and a top made of exactly five round bumps. Color: leaf green #4f9d4a.
Nothing else: no letters or pictures on the sign, no window bars or panes, no goods other than the
five books, no shelves, lamps or room behind the glass, no hinges, no step, no hanging plant, no
bricks, no roof, no street or ground line, no shadows.
Thirty shapes and lines in total. Count: one cornice, one sign with one inset, seven stripes, one
framed window, five books, two panels, one door with a glass, a panel and a knob, four shine
lines, one pot, one bush.
```

### 2 · `balcony`

Objective: Tall doors behind a seven-bar railing, a flower box and its shadow on the wall.

```text
SUBJECT: a patch of a town house's wall, seen straight on, with one balcony: a pair of tall doors
standing on a stone ledge, a railing of seven bars in front of the doors' lower part, and on the
wall beside the doors a flower box, with the flower box's shadow on the wall.
LIGHT: from the upper left. The flower box's shadow is the only light or shadow in the picture.
Here the railing does stand in front of the doors: that is part of what this lesson teaches.
- Wall: one closed shape with four straight sides, a little taller than wide. Color: yellow
  #f7cf46.
- Ledge: one long flat shape with four straight sides lying across the lower part of the wall,
  nearly as wide as the wall and about three line-widths tall, floating with a clear strip of wall
  color below it and at both ends. Color: cream #f6e7b8.
- Doors: one tall closed shape with four straight sides standing on the ledge's top edge (one
  shared line), in the left half of the wall, about twice as tall as wide. Color: dark green
  #2f6b3a. It has no line down its middle: the two doors are told apart by their glass.
- Glass: exactly two tall panes side by side in the upper part of the doors, one in each door,
  floating, with a clear strip of door color around them and between them. They stop well above
  the railing. Color: blue #5b8fc7.
- Railing: exactly seven bars and one top rail, all charcoal lines with no color. The bars are
  seven single straight upright lines standing on the ledge's top edge, touching it, evenly spaced
  from the ledge's left end to its right end, the first and the last at the two ends. The top rail
  is one single straight level line joining the tops of all seven bars, touching each. The railing
  is about one third as tall as the doors. Some bars cross in front of the doors' lower part, and
  the doors' two sides pass behind the top rail; no bar lies on a side of the doors.
- Flower box: on the wall to the right of the doors, clear of them, with its bottom a clear strip
  of wall color above the top rail: one box with four straight sides, about twice as wide as tall.
  Color: orange #f08a2c.
- Plants: one mound sitting on the box's top edge (one shared line), as wide as the box, its top
  made of exactly three round bumps. Color: leaf green #4f9d4a.
- Flowers: exactly three small circles, one inside each bump, each floating with a clear band of
  green around it. Color: red #d8433b.
- Shadow: the flower box's shadow on the wall: one flat four-sided shape hanging from the box's
  bottom edge (one shared line). Its two sides run down and to the right, parallel, and one level
  bottom edge closes it. It is about half as tall as the box and ends with a clear strip of wall
  color above the top rail. Color: gray #c9ced6.
Nothing else: no shadows of the ledge, doors, railing or plants, no door handles, no frames or
bars in the glass, no shutters, no curtains, no leaves or stems outside the mound, no bricks, no
roof, no second window. Count: seven bars, two panes, three flowers, one shadow.
```

### 3 · `phone-box`

Objective: Tall box in two-point view with a domed top and four panes on each side.

```text
SUBJECT: one old-fashioned telephone box standing on its own: a tall box with a domed top and
glass panes on its sides, seen from one corner so that two of its sides show.
VIEW: two-point perspective, seen from one corner by someone standing beside the box, whose eye
level is about two thirds of the way up the box. Both vanishing points lie far outside the
picture: no horizon line and no dots are drawn. Every upright edge stays perfectly upright. The
edges of each side go away toward that side's vanishing point: the top edges slope gently down as
they go away from the near corner, the bottom edges slope a little up, and the pane edges in
between slope less the nearer they are to the eye level.
- Near corner: the upright edge where the two sides meet, a little right of the middle of the
  image, drawn once. It is the tallest upright edge.
- Left side: one tall four-sided shape going away to the left: the near corner, a shorter upright
  far edge, and a top edge and a bottom edge as the VIEW says. About three times as tall as it is
  wide. Color: red #d8433b.
- Right side: the same going away to the right, a little narrower than the left side.
  Color: brown #8a5a33.
- Dome: one closed shape sitting on the box. Its bottom edge is the two sides' top edges (shared
  lines, drawn once); its top is one smooth round curve rising from the left far corner, over the
  near corner, and down to the right far corner. It is about one fifth as tall as the box is wide.
  Color: watermelon pink #ee5a6a.
- Panes: exactly four on each side, eight in all. On each side they sit in two rows of two in the
  upper two thirds, with a clear strip of the side's color between them and all around them; the
  lower third of each side is plain. Each pane is a four-sided shape with upright sides and with
  top and bottom edges that slope like the side's own edges. The panes on the far halves of the
  sides are a little narrower. Color: blue #5b8fc7.
Nothing else: no sign band or letters, no crown, no door handle, no hinges, no telephone or
anything seen through the glass, no base or step, no ground, no shadow, no horizon, no dots.
Count: two sides, one dome, four panes on each side.
```

### 4 · `street-corner`

Objective: Corner building in two-point perspective, eye level at the doors.

```text
SUBJECT: one corner building, three floors high, seen from the street corner in front of it, so
that its two street walls go away to the left and to the right. Each wall has one door on the
ground floor and two rows of two windows on the floors above.
VIEW: two-point perspective from the eye level of someone standing in the street: the eye level
runs through the two doors, about two thirds of the way up them. Both vanishing points lie far
outside the picture: no dots are drawn. Every upright edge stays perfectly upright. Edges above
the eye level slope down as they go away, and the higher they are the more they slope, so the
roof edges slope the most; edges below the eye level slope a little up as they go away.
- Horizon: one straight level line at the eye level, passing behind the building. It shows as one
  short piece to the left of the building and one to the right, each about one tenth of the image
  width long and each ending exactly on the building's outline. A charcoal line with no color.
- Near corner: the upright edge where the two walls meet, a little left of the middle of the
  image, drawn once. It is the tallest upright edge.
- Left wall: one four-sided shape going away to the left: the near corner, a shorter upright far
  edge, a top edge sloping down to the left and a bottom edge rising a little to the left.
  Color: yellow #f7cf46.
- Right wall: the same going away to the right, a little wider than the left wall.
  Color: orange #f08a2c.
- Doors: exactly two, one on each wall, on the ground floor, in the half of the wall nearer the
  corner. Each stands on its wall's bottom edge (one shared line), has upright sides and a top
  edge that slopes like the wall's edges near it; its top is a little above the eye level.
  Color: brown #8a5a33.
- Windows: exactly eight, four on each wall, in two rows of two on the two upper floors, one
  window above each door and one farther from the corner. Each floats, with a clear strip of wall
  color all around it. Each has upright sides and top and bottom edges that slope like the wall's
  top edge above it: the upper row slopes more than the lower one. On each wall the far windows
  are a little narrower and shorter than the near ones. Color: blue #5b8fc7.
Nothing else: no roof, cornice or chimney, no balconies, no shop windows, no awning, no sidewalk,
curb or street, no lamp post, no signs or house numbers, no guide lines, no vanishing point dots.
Count: two walls, two doors, eight windows, two pieces of horizon.
```

### 5 · `fountain`

Objective: Round fountain with two stacked basins drawn as ellipses and four water arcs.

```text
SUBJECT: one round town fountain: a wide lower basin, a column rising from its water, a smaller
upper basin on the column, and water falling from the upper basin into the lower one in four arcs.
VIEW: seen from the front and a little from above, with no perspective: each basin's round top is
a flat ellipse about one third as tall as it is wide, and the bottom of each round shape is the
front half of a flat ellipse. Hidden back edges are not drawn. The fountain is one big round
shape, so it fills a little less of the image than usual: about 60 to 65% of its width.
- Lower basin rim: one flat ellipse, low in the image, as wide as the fountain. Inside it is the
  water. Color of the water: blue #5b8fc7.
- Lower basin side: one band hanging under the front half of the rim ellipse (its top edge is
  that front half, drawn once): two short upright sides at the ellipse's two ends and a bottom
  edge curving parallel to the rim's front. It is about one sixth as tall as it is wide.
  Color: gray #c9ced6.
- Column: one narrow upright shape with straight sides, standing in the middle of the lower
  basin's water and rising to the upper basin. Its bottom edge is a short gentle curve inside the
  water, touching nothing else; its top edge is shared with the bottom of the upper basin.
  Color: cream #f6e7b8.
- Upper basin rim: one smaller flat ellipse, about 40% as wide as the lower one, high above it.
  Inside it is the water. Color of the water: blue #5b8fc7.
- Upper basin bowl: one shape hanging under the front half of the upper rim ellipse (shared
  edge, drawn once), curving in like a shallow bowl down to the top of the column (shared edge).
  Color: gray #c9ced6.
- Water arcs: exactly four single curved lines, two on the left and two on the right, the right
  pair a mirror image of the left pair. On each side, the upper arc starts at the end of the upper
  rim ellipse and the lower arc starts a little lower on the bowl's side. Each curves outward, a
  little up and then down, like water poured over an edge, and ends exactly on the back edge of
  the lower rim ellipse, touching it and nothing else. The upper arc lands farther out, so the two
  arcs on a side never touch or cross. They are charcoal lines with no color: not blue, not
  filled, not tubes.
Nothing else: no statue or figure, no spout or knob on top, no drops, splashes, spray or ripples,
no stone texture, no steps, no ground, no plants. Count: two basins, one column, four arcs.
```

### 6 · `canal-bridge`

Objective: Stone bridge with three arches over a canal, the arches mirrored in the water.

```text
SUBJECT: one stone bridge with three round arches crossing a canal, seen straight from the side,
and its mirror image in the still water under it.
VIEW: a flat side view. The reflection lies straight below the bridge, upside down, as in a
mirror lying flat on the water.
- Waterline: one straight level line across the image, a little below its middle, from 15% to 85%
  of the image width. A charcoal line with no color. The water itself is white paper.
- Bridge: one closed shape standing on the waterline, about 60% of the image width long: a top
  edge that rises gently to the middle and falls again, like a very shallow hump; two short
  upright ends standing on the waterline; and along its bottom exactly three round arches, each a
  half circle rising from the waterline, a bigger one in the middle and a smaller one on each
  side. Between the arches and at both ends, the bridge's bottom edge is the waterline itself (one
  shared line, drawn once). Above every arch a band of stone at least four line-widths tall
  remains. Color: brown #8a5a33.
- Arch openings: the three spaces under the arches, between each arch and the waterline, are the
  dark under the bridge. Color: purple #7b4fa3.
- Reflection: one closed shape hanging from the waterline straight below the bridge, its mirror
  image: as long as the bridge, with the same two upright ends, a bottom edge that dips gently in
  the middle, and exactly three upside-down half circles opening down from the waterline, straight
  below the three arches and the same sizes. Between them and at both ends its top edge is the
  waterline (shared). Color: cream #f6e7b8.
- Reflected openings: the three spaces inside the upside-down half circles. Color: gray #c9ced6.
Each arch and its reflection together make one round opening, cut across its middle by the
waterline.
Nothing else: no parapet or railing, no lamps, no road, no banks, quay walls or steps, no boats,
no ripples or wave lines, no stones or bricks, no plants, no sky. Count: three arches above the
water, three below.
```

### 7 · `tram`

Objective: Old tram in three-quarter view on rails curving around a corner.

```text
SUBJECT: one old city tram with a rounded roof and a trolley pole, standing on two rails that come
out from under its front and curve around a corner toward the viewer.
VIEW: three-quarter view: the front of the tram faces the lower left of the picture and its long
side goes away to the right, so both show. Every upright edge stays upright. The side's top and
bottom edges draw gently together toward its far end, which is a little shorter than the front.
The vanishing points lie outside the picture: no horizon and no dots.
- Front: one upright four-sided shape, a little taller than wide. Color: orange #f08a2c.
- Side: one long four-sided shape going away to the right from the front's right edge (one shared
  line, drawn once), about three times as long as the front is wide. Color: yellow #f7cf46.
- Roof: one low closed shape lying on the front and the side (its bottom edges are their top
  edges, shared), its top one smooth rounded curve. It is about one sixth as tall as the side.
  Color: cream #f6e7b8.
- Front window: one big four-sided window floating in the upper half of the front. Color: blue
  #5b8fc7.
- Headlight: one small circle floating in the middle of the lower half of the front. Color: cream
  #f6e7b8.
- Side windows: exactly four in a row, floating in the upper half of the side, evenly spaced, each
  a four-sided shape with upright sides and top and bottom edges that follow the side's edges,
  a little smaller toward the far end. Color: blue #5b8fc7.
- Trolley pole: one single straight line rising from the middle of the roof and leaning back
  toward the far end, about as long as the side is tall. Its top end is free. A charcoal line with
  no color.
- Rails: exactly two single lines, parallel. They come out from under the front of the tram, one
  near each end of its bottom edge, touching it, and run toward the lower left in one smooth curve
  that bends round, so that at their near ends they point straight down the picture, like a track
  turning a corner. They spread a little apart as they come nearer, and both end open, a clear
  margin above the bottom of the image. Charcoal lines with no color.
The side's bottom edge comes down close to the rails' height, hiding the wheels.
Nothing else: no wheels, no wire above the pole, no letters, numbers or route sign, no doors, no
bumper, no steps, no sleepers between the rails, no street, curb, buildings or ground.
Count: one front window, four side windows, one headlight, one pole, two rails.
```

### 8 · `brick-window`

Objective: Arched window in a brick wall, bricks drawn only in three small patches.

```text
SUBJECT: a patch of brick wall, seen straight on, with one tall arched window in the middle. The
wall is not covered in bricks: bricks are drawn in only three small patches, as a sketcher
suggests a brick wall instead of drawing every brick.
- Wall: one closed shape with four straight sides, a little taller than wide. Color: orange
  #f08a2c.
- Window frame: one tall closed shape floating in the middle of the wall: straight upright sides,
  a level bottom and a round arched top (a half circle), about twice as tall as wide.
  Color: cream #f6e7b8.
- Glass: one smaller shape of the same form floating inside the frame, with an even band of frame
  color all around it. Color: blue #5b8fc7.
- Bricks: exactly nine, in exactly three patches of three. Each patch floats on the wall with
  plenty of plain wall between it, the window and the wall's edges: one patch near the upper left
  corner of the wall, one on the right beside the middle of the window, one near the lower left
  corner. In each patch, two bricks lie side by side in a row and the third sits above them,
  centered over the gap between them, like a tiny piece of a real brick wall. Each brick is a
  small closed shape with four straight sides and softly rounded corners, about three times as
  wide as tall, with a clear gap of wall color between neighboring bricks: bricks never touch.
  Color: red #d8433b.
Nothing else: no other bricks, no mortar lines, no bars or panes in the glass, no sill, no arch
stones or keystone, no shutters, no plants, no shadow. Count: three patches, nine bricks, one
window.
```

### 9 · `fire-hydrant`

Objective: Hydrant with a shadow side and a cast shadow across a few cobblestones.

```text
SUBJECT: one fire hydrant standing on a street, lit from the upper left, with its shadow side and
its cast shadow lying across a few cobblestones.
VIEW: the hydrant is seen straight on. The ground is seen from a little above, so the cast shadow
and the cobblestones are flat shapes lying on it.
LIGHT: from the upper left. The hydrant's right side is its shadow side, and its cast shadow falls
on the ground to the right. These are the only shadows.
- Body: one closed shape: straight upright sides, a flat level bottom, and a round dome on top
  like the top half of a circle. About twice as tall as it is wide, standing a little left of the
  middle of the image.
- Shadow side: one single line divides the body from top to bottom: it starts on the dome a
  little right of its top, curves down, and runs straight and upright to the bottom edge, about
  one third of the body's width in from its right side, touching the outline at both ends. The
  part left of it is the lit side, red #d8433b; the narrower part right of it is the shadow side,
  brown #8a5a33.
- Cap nut: one small shape with four straight sides sitting on the top of the dome, left of where
  the dividing line starts (one shared edge). Color: yellow #f7cf46.
- Nozzles: exactly two, one on each side of the body, halfway up: each a short stubby shape with
  four straight sides sticking straight out, attached to the body's side (one shared edge), about
  as long as it is tall. The left one is yellow #f7cf46; the right one, in the shadow, is orange
  #f08a2c.
- Cast shadow: one long flat shape lying on the ground, starting against the lower part of the
  body's right side and stretching to the right, about two and a half times as long as the body
  is wide and about one quarter as tall as the body. Its bottom edge carries on from the body's
  bottom edge, level; its top edge is nearly level; its far end is rounded, like the dome lying
  on its side. Color: gray #c9ced6.
- Cobblestones: exactly six, each a small flat rounded shape, wider than tall, about one quarter
  as wide as the body. Exactly three lie in a row inside the cast shadow, each wholly inside it
  with a clear band of gray all around it: color brown #8a5a33, stones in the shadow. The other
  three lie in a row on the white ground just below the shadow, clear of it and of each other:
  color cream #f6e7b8, stones in the light. No stone is cut by the shadow's edge.
Nothing else: no base flange, no front nozzle, no chains, no bolts, no highlight, no ground line,
curb or sidewalk, no other stones, no puddles. Count: one shadow side, one cast shadow, two
nozzles, six cobblestones, three of them in the shadow.
```

### 10 · `rooftops`

Objective: Four overlapping roofs at different angles, with chimney pots and a water tank.

```text
SUBJECT: a view across the rooftops of a town: four roofs at four different angles, one behind
another, with two chimneys topped by chimney pots and one water tank standing on the flattest
roof. Here the roofs do overlap: that is what this lesson teaches. A roof in front hides part of
the roof behind it, and the lines behind stop exactly on its outline. Only the roofs show: no
walls, windows or streets under them.
- Roof 1, the nearest, lowest and largest, at the bottom left: a sloping roof seen from its long
  side: one wide four-sided shape with a level bottom edge (the eaves), a shorter level top edge
  (the ridge) and two ends slanting inward. About 50% of the image width. Color: orange #f08a2c.
- Roof 2, near, at the bottom right and a little higher: a steep pointed roof seen from its end:
  one triangle with a level bottom and a peak, taller than wide. Roof 1 hides its lower left
  corner. Color: red #d8433b.
- Roof 3, behind roof 1, at the upper left: a roof that slopes one way only: one four-sided shape
  with an upright right side, a shorter upright left side, and a straight top edge sloping steeply
  down to the left. Roof 1 hides its lower part. Color: purple #7b4fa3.
- Roof 4, behind roof 2, at the upper right, the highest: a low, nearly flat roof: one wide
  four-sided shape with a long level top edge and two short gently slanting ends, much flatter
  than the others. Roof 2's peak rises in front of it and hides part of it. Color: gray #c9ced6.
  Roof 3 and roof 4 do not touch: a clear gap of white lies between them.
- Chimneys: exactly two, each a small upright shape with four straight sides, taller than wide.
  One stands on roof 1's ridge toward its left end, the other on roof 4's top edge toward its
  left end; each one's bottom edge is that roof's top edge (one shared line). Color: brown
  #8a5a33.
- Chimney pots: exactly two on each chimney, four in all: small upright rounded shapes standing
  side by side on the chimney's top edge (shared), with a clear gap between them. Color: orange
  #f08a2c.
- Water tank, on roof 4's top edge toward its right end: exactly three legs, single straight
  upright lines standing on the roof's top edge, evenly spaced, charcoal lines with no color; on
  their tops a tank, one upright shape with straight sides and a flat bottom resting on the legs,
  a little taller than wide, color brown #8a5a33; on the tank a pointed cap, one low triangle a
  little wider than the tank sitting on its top edge (shared), color gray #c9ced6.
Nothing else: no roof tiles or tile lines, no walls, windows or doors, no antennas, no smoke, no
birds, no sky, no clouds, no sun. Count: four roofs, two chimneys, four pots, one tank on three
legs.
```

### 11 · `hill-street`

Objective: Street climbing a hill: houses step up, the road's edges meet above the horizon.

```text
SUBJECT: a steep street climbing a hill, seen from the bottom of it, looking straight up the
street. Three houses line its left side, stepping up the hill one after another. On the right
side there are no houses: the view opens out, and the horizon shows there.
VIEW: one-point perspective, from the eye level of someone standing at the bottom of the street.
Because the street climbs, its two edges meet at a point high in the picture, far above the eye
level. The houses stand level on the slope, so their level edges aim at a point on the horizon
straight below that; that lower point is not drawn. Every upright edge stays perfectly upright.
- Road: one long triangle: a wide level bottom edge across the bottom of the scene, and two
  straight edges climbing from its ends and meeting at one point in the upper part of the picture,
  a little right of the middle. Color: gray #c9ced6.
- Vanishing point: exactly one small solid round dot where the road's two edges meet, in the
  charcoal line color.
- Horizon: one straight level line to the right of the road, at the eye level, about one third of
  the way up the nearest house and well below the dot. It runs from the road's right edge, ending
  exactly on it, to about 85% of the image width. A charcoal line with no color. The dot is
  clearly above it.
- Houses: exactly three walls along the road's left edge, going away up the street, each a
  four-sided shape: an upright near edge, a shorter upright far edge, a bottom edge that is a
  stretch of the road's left edge (one shared line, climbing), and a top edge that slopes gently
  down toward the far end. The first house is the tallest and nearest, at the left of the scene;
  each next house begins where the one before ends, and its near edge rises higher than the
  previous house's far edge, so the rooftops step up like stairs; the lower part of that near edge
  is the previous house's far edge (one shared line). The houses get smaller up the hill and the
  third ends about halfway up the road. Colors from the bottom up: watermelon pink #ee5a6a,
  yellow #f7cf46, pale green #b9dc8a.
- Windows: exactly two in each house, six in all, side by side, floating with a clear strip of
  wall color around them, each a four-sided shape with upright sides and top and bottom edges
  that slope like the house's top edge; the far window in each house is a little smaller.
  Color: blue #5b8fc7.
Nothing else: no doors, roofs, chimneys or balconies, no sidewalk or curb, no road markings, no
rails, no lamp posts, no houses on the right, no hills, trees, sea or city below the horizon, no
guide lines, no second dot. Count: three houses, six windows, one dot, one horizon.
```

### 12 · `tram-hill`

Objective: Café corner at the foot of a steep street, a tram climbing it, rooftops behind, edges fading out.

Attach `tram` and `shop-front` as well as the apple.

```text
SUBJECT: a small street scene like a sketch from a hilly old town: a café on the corner at the
foot of a steep street, the street climbing to the upper right with three houses stepping up
along it, a yellow tram climbing the street, and rooftops behind the houses. Its edges fade out,
the way a sketch fades out on a page.
VIEW: a flat side view with no perspective. The ground under the café is level; from the café's
right, the street climbs steeply to the upper right, at about thirty degrees. The café, the houses
and the tram are seen straight from the side; the tram tilts with the street.
Here some things do overlap, and only these: the tram stands in front of the lower parts of the
houses and hides the stretch of the street's far edge behind it, and the houses stand in front of
the lower parts of the rooftops. The thing in front hides the thing behind.
FADING EDGES: the scene has no frame and no straight outer edge. The street is not colored: it
stays white paper, like the sky, between its two edge lines, and at both ends those lines stop
open in the white without being joined, so the street is not an enclosed shape. The parts nearest
the edges are the plainest and palest: the highest house and the rooftops have no windows.
- Street: two single straight lines, the street's far edge and near edge. The far edge starts
  open at the left, runs level under the café as its ground line, and at the café's right bends up
  and climbs to the upper right, where it stops open. The near edge runs below it, level at first
  and then climbing parallel to it, about one sixth of the image height lower; it starts open
  below the café's door and stops open at the upper right, a little before the far edge. Charcoal
  lines with no color.
- Rails: exactly two single lines running up the middle of the climbing street, parallel to its
  edges and close together, starting open near the foot of the slope and stopping open near the
  top. The tram's wheels stand on the lower rail; the upper rail passes behind the tram and is
  hidden there. Charcoal lines with no color.
- Café, at the lower left, standing on the level ground line (one shared line), about one third of
  the image width: a front wall, one closed shape with four straight sides, a little wider than
  tall, color watermelon pink #ee5a6a; a roof, one low four-sided shape sitting on the wall's top
  edge (shared), a little wider than the wall, with slanting ends, color orange #f08a2c; an
  awning floating in the upper part of the wall, like the attached shop front's but with exactly
  five scallops and four lines dividing it into five stripes, red #d8433b, cream #f6e7b8, red,
  cream, red; under it one big window at the left, floating, blue #5b8fc7, and one door at the
  right standing on the ground line (shared), brown #8a5a33.
- Houses: exactly three flat fronts standing along the climbing street's far edge, one after
  another, a clear gap of white between the café and the first. Each has upright sides, a level
  top edge, and a bottom edge that is a stretch of the street's far edge (one shared line,
  climbing). Each house's top is higher than the one before, so the houses step up like stairs;
  the lower part of each house's left side is the previous house's right side (one shared line).
  Colors from the bottom up: orange #f08a2c, pale green #b9dc8a, cream #f6e7b8. The first two have
  exactly one window each, floating in their upper half, blue #5b8fc7; the third has none.
- Tram, on the rails about halfway up the street, as long as about one and a half houses: a body,
  one long four-sided shape tilted with the street, its bottom and top edges parallel to the
  street and its two ends at right angles to them, color yellow #f7cf46; a roof, one low rounded
  shape lying along the body's top edge (shared), color cream #f6e7b8; exactly three windows
  floating in the upper half of the body, evenly spaced, blue #5b8fc7; exactly two wheels, each a
  half circle hanging from the body's bottom edge near one end (shared edge) and standing on the
  lower rail, color gray #c9ced6; one trolley pole, a single straight line rising from the roof
  and leaning back down the hill, its top end free, a charcoal line with no color.
- Rooftops: exactly three pointed roofs rising behind the three houses, one behind each, their
  lower parts hidden by the houses, each a triangle with a gently rounded peak whose tip rises
  well above the house in front of it. Colors from the bottom up: watermelon pink #ee5a6a, gray
  #c9ced6, pale green #b9dc8a. On the middle roof stands one chimney, a small upright shape with
  four straight sides whose bottom follows the roof's slope (shared), color brown #8a5a33,
  topped by exactly two chimney pots side by side (shared edge), color orange #f08a2c.
Nothing else: no people, no birds, no cars, no letters on the café or the tram, no café tables or
chairs, no lamp posts, no wire above the tram, no doors on the houses, no sky, no clouds, no sun,
no ground color, no frame. Count: one café with a five-stripe awning, three houses, one tram with
three windows and two wheels, three rooftops, one chimney with two pots.
```

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`, for `docs/curriculum/urban-sketching/`. The
usual failures to watch for on this path: vanishing point dots or guide lines where none are asked for, window bars
and panes, bricks or tiles spread over whole walls and roofs, letters on the sign or the tram, wheels on the tram
lesson, a shadow cutting across a stone, a colored street or a frame round the finale, and people or pigeons.
