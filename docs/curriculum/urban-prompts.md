# Urban — image-generation prompts

Source art for the ten `urban` lessons (Advanced level, learners aged 16 and up), written for a raster
image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`. The **system prompt** is the
Advanced level's; only the **lesson prompt** changes.

**2026-09-30: the path ends on the café.** The creator took `tram`, `hill-street` and `tram-hill` out of the path
and made `cafe`, their own picture, the tenth and last lesson. The three prompts are gone from this file (the commit
before this one has them); where the notes below still speak of the tram, the hill street or the finale, they
describe those prompts.

## How to run them

- **System prompt: `style-v5-advanced`**, the Advanced level's, copied from the level's menu in the Studio
  (System prompt…). It lives in `web/src/studio/levelPrompts.ts`. Give it to the image model as its system /
  instructions prompt, once, and send each lesson prompt below as the message. It already carries the course's
  look, the line weight, how an attached picture is matched, perspective, drawn light and shadow, texture,
  reflections, the palette and the composition, so the lesson prompts add to it and never say it again.
- Attach the **published apple** (`fruits/apple-openai.png`) to every request; the system prompt says how to match
  it, so there is no reference line. `shop-front` is published (its picture is `urban/shop-front-openai.png`):
  attach it to `phone-box` too, whose tree is the shop front's tree. No other lesson needs a second picture.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the prettiest. Reject
  any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/urban/<lesson-id>-<model>.png`, and record model, date and the
  system prompt's version (`style-v5-advanced` from 2026-09-30) in the lesson's `--source`.

What the lesson prompts on this path take care of, beyond the system prompt:

- **Enough to look like a real place.** The creator found the first shop front, eleven bare lines, too simple for
  Advanced (2026-09-29), so every lesson names a few more parts that make the thing real (a cornice or hood, sills,
  knobs, sign bands, panels, a bumper, a dormer), each one closed shape or one bold line, and counted. About 15–30
  parts a lesson and about 40 in the finale. Never a room or goods seen through glass, never shading.
- **Parts touch or keep apart, never nearly touch.** Two parts either share one line, drawn once, or keep at least
  three line-widths of color or white between them. "A small gap" came out as a hair of white on the shop front's
  books, and the trace fused them; so books stand pressed together, and knobs, chimney pots, bricks, cobbles and
  ripples keep a wide gap.
- **A VIEW paragraph only where the view needs saying.** Four lessons are flat fronts and have none (`shop-front`,
  `balcony`, `brick-window`, `rooftops`); the others say how they are seen, the bridge for its reflection.
- **Vanishing points stay outside the picture in the two-point views** (`phone-box`, `street-corner`, `tram`): at
  70% of the image, dots on the page would squash the far walls. The eye level is drawn only where the objective
  names it: two short pieces of horizon beside the corner building, and one piece beside the hill street, whose
  road ends at the one dot on the path.
- **Light and shadow only where the objective asks**, and since the creator chose a flat hydrant (2026-09-30) none
  does: the first hydrant's shadow side and cast shadow are gone, and the balcony's flower-box shadow was taken out
  (there was no room for a right one). Light & Shadow is the path that draws light. Glass gets its shine only as
  two short bold charcoal lines in a pane's upper left corner (shop window and door, balcony doors, brick window,
  café window), never as pale streaks.
- **Texture only where the objective asks**: nine bricks in three patches (`brick-window`), counted, closed and
  floating, never a pattern. The hydrant's pavement is three slabs divided by two lines, not a texture.
- **Overlap only where the objective is about it**: a tree behind the shop (`shop-front`) and behind the phone box
  (`phone-box`), the doors behind the railing (`balcony`), the pavement's back edge behind the hydrant's foot
  (`fire-hydrant`), the four roofs and the dormer (`rooftops`), and in the finale the tram in front of the houses
  and the houses in front of the rooftops.
- **Details are single lines**: railing bars and rail, awning stripe lines, water arcs and ripples, the tram's wire
  and trolley pole and the wiper on its glass, the phone box's handle, tank legs, street edges, the shine on glass.
  Each prompt calls them charcoal lines with no color.
- **One color scheme for the town**: windows and glass blue, doors brown, dark openings purple, as on Buildings.
  Where the system prompt's "neighboring areas never share a color" meets a thing that is one color in life (a red
  phone box, bricks in a brick wall), the prompt gives it two colors of one family or joins
  the parts into one shape.
- **Clean house style for lessons 1–11**, closed shapes and exact corners, as the system prompt asks. The sketchy
  look arrives only in the finale, as fading edges the tracer can still read: the street left uncolored between
  two lines that end open, and the plainest, palest parts at the edges.
- **No living things** (no people, pigeons or cats), no words on signs, the tram or the phone box, no cars.

## System prompt (`style-v5-advanced`)

Not copied here: take it from the Advanced level's menu in the Studio, or from `ADVANCED` in
[levelPrompts.ts](../../web/src/studio/levelPrompts.ts). A change to it gets a new version, so a lesson's `--source`
still says which prompt made its picture. `style-v5-advanced` (2026-09-30) adds a PALETTE section: every area is a
palette color even when a request names none, with the lighter and darker partners used for light, distance and
reflections. The pictures kept before it (shop front to canal bridge) were made with `style-v4-advanced`.

## Lesson prompts

Each is complete as written, on top of the system prompt; the counts are the lesson's teaching points.

### 1 · `shop-front`

Objective: A bookshop front: striped awning, a window of books, a paneled door, a potted bush and a tree.

The first prompt (a plain wall, sign, awning, window and door, eleven lines) was too simple for Advanced, the
creator found on 2026-09-29, and "make it interesting" gave a lit room behind the glass that cannot be drawn. This
one adds what makes a shop look real, each part a closed shape or one bold line: a cornice, a framed sign, a
framed window with books standing in it, a door with glass, a panel and a knob, two panels under the window and a
potted bush. Its first result had pale shine tubes, a second cornice over a dark strip, bands on the books and a
rim on the pot, so the prompt now says no to each. The second (with `style-v4-advanced`) was right but for the books:
"a small gap between neighbors" came out 2–6 px wide, and the trace fused the books into one dark block, so they
now stand pressed together, sharing one line. The creator then had a tree added behind the shop's left side, so
that side is not empty (the kept picture); the prompt below now asks for it.

```text
SUBJECT: the front of one small bookshop at street level, seen straight on: a wall with a cornice
along its top, a blank framed sign, a striped awning, a framed shop window with five books standing
in it, two panels under the window, a door with a glass pane, a potted bush standing to the left
of the shop, and the round crown of a tree behind the shop's left side. The whole picture, bush
and tree included, fills about 70% of the image's width.
Here the shop does stand in front of the tree: the wall hides the tree's right part.
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
- Tree: only its crown shows, behind the wall's left edge: one closed shape whose outer side is
  made of exactly four big round bumps (one on top, two down the left, one at the bottom), and
  whose outline stops on the wall's left edge, which runs in front of it. Its top is a clear strip
  below the cornice, and its bottom a clear strip above the bush. No trunk. Color: pale green
  #b9dc8a.
Nothing else: no letters or pictures on the sign, no window bars or panes, no goods other than the
five books, no shelves, lamps or room behind the glass, no hinges, no step, no hanging plant, no
bricks, no roof, no street or ground line, no shadows.
Thirty-one shapes and lines in total. Count: one cornice, one sign with one inset, seven stripes,
one framed window, five books, two panels, one door with a glass, a panel and a knob, four shine
lines, one pot, one bush, one tree.
```

### 2 · `balcony`

Objective: Tall doors under a pointed hood behind a railing, a flower box and a climbing vine.

Three rounds on 2026-09-29. The first design (yellow wall, square green doors under a triangle hood, a flower box on
the wall) looked too plain to the creator, and a southern-town redesign (pink wall, arched door, open shutters) did
not resonate. Asked to improve the first one, ChatGPT made the look the creator likes: a pointed stone hood on a band,
a pair of green doors, a slab on two curved brackets, a flower box of red flowers with its shadow. But it drew soft
drop shadows everywhere, thin bevel lines, filled bars with knots and balls, petaled flowers, a rim and legs on the
box and pale streaks on the glass. This prompt keeps that design and says no to each of those. The next picture
added a climbing plant up the left side and centered the doors; the creator kept the idea, so the prompt now has a
simple one (a stem, four leaves, two flowers) in place of the first one's dozens of leaves and petaled flowers.
That picture is kept (`urban/balcony-openai.png`). Its railing has eight evenly spaced uprights, the second and
seventh being the doors' sides, so six bars; and the box sat so close to the wall's right edge that no shadow fitted,
so the shadow was taken out by hand, with the creator's agreement, and a white margin added. The prompt below now
describes the kept picture.

```text
SUBJECT: a patch of a yellow town house wall, seen straight on, with one balcony: a pair of tall
green doors under a pointed stone hood, standing on a stone slab held up by two brackets, a
railing of six bars in front of the doors' lower part, on the wall to the right a flower box,
and a simple climbing plant up the wall's left side.
The wall fills about 70% of the image, with clear white margin on all four sides.
No shadow, drop shadow or soft shading anywhere.
Here the railing does stand in front of the doors: that is part of what this lesson teaches.
- Wall: one closed shape with four straight sides, a little taller than wide. Color: yellow
  #f7cf46.
- Slab: one long flat shape with four straight sides lying across the lower part of the wall,
  nearly as wide as the wall and about five line-widths tall, floating with a clear strip of wall
  color at both ends. No molding lines. Color: cream #f6e7b8.
- Brackets: exactly two, hanging under the slab, one near each end of it, each one plain shape: a
  level top edge that is a stretch of the slab's bottom edge (one shared line), a straight upright
  outer side, a short level foot, and an inner side that curves from the foot up and out to the
  top edge, so the bracket is wide at the top and narrow at the foot. About three times as tall as
  the slab, with a clear strip of wall color below. No groove or inner line. Color: orange
  #f08a2c.
- Doors: one tall closed shape with four straight sides standing on the slab's top edge (one
  shared line), in the middle of the wall, about twice as tall as wide. One upright line
  divides it down the middle into two doors, running from outline to outline. No panels, bevels
  or other lines. Color: dark green #2f6b3a.
- Hood: one closed shape sitting on the doors' top edge: a flat band a little wider than the doors,
  about four line-widths tall, its bottom edge running along the doors' top edge (one shared line)
  and sticking out a little past it at both ends, and on it a low triangle as wide as the band,
  about one quarter as tall as it is wide. One level line divides the band from the triangle. No
  inner lines, no small blocks under the band. Color: cream #f6e7b8.
- Glass: exactly two tall panes, one in each door, floating in the upper part of the doors, with
  a clear strip of door color at least three line-widths wide around each, also from the middle
  line. They stop well above the railing. Color: blue #5b8fc7.
- Window shine: in the upper left corner of each pane, exactly two short straight lines,
  parallel, slanting up to the right, floating, touching nothing. Bold charcoal lines like every
  other line: not white, not pale, not filled.
- Knobs: exactly two small circles, one on each side of the middle line, below the panes and above
  the top rail, floating with a clear gap of door color at least three line-widths wide between
  them, from the middle line and all around them: they never touch or overlap the glass. Color:
  yellow #f7cf46.
- Railing: exactly six bars and one top rail, all single bold charcoal lines with no color and
  nothing on them: no balls, knots or thick filled bars. The top rail is one straight level line
  across the lower part of the doors, running from a little left of the doors to a little right
  of them. The doors' two sides carry on down behind the rail to the slab. Two bars stand on the
  slab's top edge, one at each end of the rail, a little outside the doors; four more stand in
  front of the doors, so that the eight uprights (six bars and the doors' two sides) are evenly
  spaced. Each bar touches the rail and the slab. The doors' middle line stops at the rail.
- Flower box: on the wall to the right of the doors, clear of them and of the hood, its bottom a
  clear strip above the top rail: one plain shape a little wider at the top than at the bottom,
  about three times as wide as tall, with no rim and no legs. Color: orange #f08a2c.
- Plants: one mound sitting on the box's top edge (one shared line), as wide as the box, its top
  made of exactly five round bumps. Color: leaf green #4f9d4a.
- Flowers: exactly three plain circles floating in the mound, each with a clear band of green at
  least three line-widths wide around it. No petals, no centers. Color: red #d8433b.
- Climbing plant: up the wall's left side, between the wall's left edge and the doors, keeping a
  clear gap of wall color at least three line-widths wide from the wall's edges, the hood, the
  doors, the railing and the slab. One smooth charcoal stem line with no color climbs from near
  the wall's bottom to near its top, gently curving, and ends at the top flower. Exactly two
  flowers, plain circles with no petals and no centers, color red #d8433b: one at the stem's top
  and one about halfway up, where the stem stops on the flower's outline and carries on from its
  other side. Exactly four leaves, plain pointed ovals with no veins, color leaf green #4f9d4a,
  two on each side of the stem, each touching the stem only at its narrow end. Leaves and flowers
  keep at least three line-widths from each other. No curls, tendrils or other leaves.
Nothing else: no shadows, drop shadows or soft shading, no thin inner or bevel lines, no door
panels, no knots or balls on the railing, no rim or legs on the box, no petals or centers on the
flowers, no leaves outside the mound, no streaks on the glass, no shutters, no bricks, no roof, no
second window. Thirty-six shapes and lines in total. Count: one pair of doors with a middle line,
two panes, four shine lines and two knobs; one hood with its dividing line; one slab on two
brackets; six bars and one top rail; one flower box with one mound and three flowers; one climbing
plant with a stem in two pieces, two flowers and four leaves.
```

### 3 · `phone-box`

Objective: Red phone box in two-point view: domed roof, blank sign bands, twelve panes, a tree behind.

Attach `shop-front` as well as the apple: the tree behind the box is the one behind the shop.

Reworked 2026-09-29 after the shop front and balcony rounds: the roof is red like a real phone box (the sign bands
keep it apart from the red side), a small knob sits on top, the box stands a little left of the middle so that the
tree balances it, and the prompt says no to what the image model added on those two (soft shadows, bevels, an image
filled edge to edge).

```text
SUBJECT: one old red telephone box standing on its own, seen from one corner so that two of its
sides show: a tall box with a domed roof and a small knob on top, a blank sign band under the
roof on each side, rows of small glass panes, a door handle, a low base, and the round crown of a
tree behind its right side. The box and the tree together fill about 70% of the image's height,
with clear white margin on all four sides.
Here the box does stand in front of the tree: the box hides the tree's left part.
VIEW: two-point perspective, seen from one corner by someone standing beside the box, whose eye
level is about two thirds of the way up the box. Both vanishing points lie far outside the
picture: no horizon line and no dots are drawn. Every upright edge stays perfectly upright. The
edges of each side go away toward that side's vanishing point: the top edges slope gently down as
they go away from the near corner, the bottom edges slope a little up, and the edges in between
(sign bands, panes, base) slope less the nearer they are to the eye level.
LIGHT: from the upper left, so the left side is lit and the right side is in shadow. This shows
only in the two sides' colors: no shadows, drop shadows or soft shading anywhere.
- Near corner: the upright edge where the two sides meet, a little left of the middle of the
  image, drawn once, from the roof down to the base. It is the tallest upright edge.
- Left side: one tall four-sided shape going away to the left: the near corner, a shorter upright
  far edge, and a top edge and a bottom edge as the VIEW says. About three times as tall as it is
  wide. Color: red #d8433b.
- Right side: the same going away to the right, a little narrower than the left side. It is the
  shadow side. Color: brown #8a5a33.
- Sign bands: one across the top of each side, from the near corner to that side's far edge,
  about one eighth as tall as the side: its top edge is the side's top edge (shared) and one line
  sloping like it divides it from the rest of the side. The two bands meet at the near corner.
  They are blank: no letters and no pictures. Colors: cream #f6e7b8 on the left side, yellow
  #f7cf46 on the right, like a lit sign.
- Roof: one closed shape sitting on the box. Its bottom edge is the two sign bands' top edges
  (shared lines, drawn once); its top is one smooth round curve rising from the left far corner,
  over the near corner, and down to the right far corner. It is about one fifth as tall as the box
  is wide. Color: red #d8433b.
- Knob: one small half circle sitting on the highest point of the roof (one shared line). Color:
  yellow #f7cf46.
- Panes: exactly six on each side, twelve in all. On each side they sit in three rows of two, under
  the sign band and above the lower third of the side, with a clear strip of the side's color at
  least three line-widths wide between them and all around them; the lower third of each side is
  plain. Each pane is a four-sided shape with upright sides and with top and bottom edges that
  slope like the side's own edges. The panes on the far halves of the sides are a little narrower.
  Color: blue #5b8fc7.
- Handle: one short upright line floating in the plain lower part of the left side, near its far
  edge, below the lowest row of panes, with a clear strip of red at least three line-widths wide
  between it and the panes and the far edge. A charcoal line with no color.
- Base: one low band along the bottom of both sides, one closed shape that turns the corner: its
  bottom edge is the two sides' bottom edges, and its top edge is one line across each side,
  sloping like the side's bottom edge. The near corner line stops at the base's top edge, so the
  base is one shape. About as tall as the sign bands. Color: gray #c9ced6.
- Tree: only its crown shows, behind the right side's far edge: one closed shape whose outer side
  is made of exactly four big round bumps (one on top, two down the right, one at the bottom), and
  whose outline stops on the box's right far edge, which runs in front of it. Its top is a clear
  strip below the roof, and its bottom a clear strip above the base. No trunk. Color: pale green
  #b9dc8a.
Nothing else: no letters or pictures, no crown other than the knob, no hinges, no telephone or
anything seen through the glass, no shine lines, no frames or bars around the panes, no shadows,
drop shadows or soft shading, no thin inner or bevel lines, no step, no ground, no horizon, no
dots. Twenty-one shapes and lines in total. Count: two sides, two sign bands, one roof with one
knob, six panes on each side, one handle, one base, one tree.
```

### 4 · `street-corner`

Objective: Corner café in two-point view: striped awning, flower boxes, a chimney, eye level at the door.

Reworked 2026-09-29 to be much more interesting (the creator's ask): the plain corner building became a corner café.
It is lesson 4, the first paid one and a sticker on the free lessons' videos, so it should look inviting. The
teaching point stays the same, everything leaning toward two far points with the eye level through the door, and
every new part (the awning's stripes, the flower boxes, the chimney) repeats it.

```text
SUBJECT: one corner building, three floors high, with a small café on the ground floor, seen from
the street corner in front of it, so that its two street walls go away to the left and to the
right. On the ground floor, a glazed door on the left wall and a big café window under a striped
awning on the right wall. On each upper floor, two windows on each wall: the two first-floor
windows nearest the corner have flower boxes, the other windows have sills. A cornice runs along
the top of both walls, with a chimney standing on it. The building fills about 70% of the image's
height, with clear white margin on all four sides.
VIEW: two-point perspective from the eye level of someone standing in the street: the eye level
runs through the door, about two thirds of the way up it, and across the café window. Both
vanishing points lie far outside the picture: no dots are drawn. Every upright edge stays
perfectly upright. Edges above the eye level slope down as they go away, and the higher they are
the more they slope, so the cornice slopes the most; edges below the eye level slope a little up
as they go away. Everything fixed to a wall (awning, windows, sills, flower boxes) slopes like the
wall's edges at its height and gets a little smaller toward the wall's far end.
LIGHT: from the upper left, so the left wall is lit and the right wall is in shade. This shows only
in the colors: no shadows, drop shadows or soft shading anywhere.
- Horizon: one straight level line at the eye level, passing behind the building. It shows as one
  short piece to the left of the building and one to the right, each about one tenth of the image
  width long and each ending exactly on the building's outline. A charcoal line with no color.
- Near corner: the upright edge where the two walls meet, a little left of the middle of the
  image, drawn once, from the cornice down. It is the tallest upright edge.
- Left wall: one four-sided shape going away to the left: the near corner, a shorter upright far
  edge, a top edge sloping down to the left and a bottom edge rising a little to the left.
  Color: yellow #f7cf46.
- Right wall: the same going away to the right, a little wider than the left wall.
  Color: orange #f08a2c.
- Cornice: one band along the top of both walls, one closed shape that turns the corner: its
  bottom edge is the two walls' top edges (shared lines), its top edge runs above them sloping the
  same way, and its two ends are short upright edges straight above the walls' far edges. The
  near corner line stops at the cornice's bottom edge, so the cornice is one shape. About one
  twelfth as tall as the near corner. Color: cream #f6e7b8.
- Chimney: one small upright box standing on the cornice above the right wall, about a quarter of
  the way from the corner to the far end, seen from the same corner: two faces meeting at one
  upright edge, their bottom edges a stretch of the cornice's top edge (shared), their top edges
  sloping like the cornice. The face turned like the left wall is red #d8433b, the face turned
  like the right wall is brown #8a5a33. A little taller than wide.
- Door: on the left wall's ground floor, in the half nearer the corner: one tall shape standing on
  the wall's bottom edge (one shared line), with upright sides and a top edge that slopes like the
  wall's edges near it; its top is a little above the eye level. Color: brown #8a5a33. In its
  upper half one pane floats, with a clear strip of door color at least three line-widths wide
  around it; the eye level runs through it, so its edges are almost level. Color: blue #5b8fc7.
- Café window: on the right wall's ground floor, in the half nearer the corner: one big window,
  floating, a little wider than tall, with upright sides and top and bottom edges that slope like
  the wall's edges near it. Color: blue #5b8fc7. In its upper left corner, exactly two short
  straight shine lines, parallel, slanting up to the right, floating: bold charcoal lines like
  every other line, not white, not pale, not filled.
- Awning: fixed flat to the right wall above the café window, with a clear strip of wall color at
  least three line-widths tall between them: one band as wide as the window, its top edge sloping
  like the window's top, its bottom edge made of exactly five shallow round scallops that get a
  little smaller toward the far end. Exactly four upright lines divide it into five stripes, each
  line running from the top edge down to where two scallops meet. Stripe colors from the corner
  outward: red #d8433b, cream #f6e7b8, red, cream, red.
- Windows: exactly eight, four on each wall, in two rows of two on the two upper floors, one window
  above the door or the awning and one farther from the corner. Each floats, with a clear strip of
  wall color all around it. Each has upright sides and top and bottom edges that slope like the
  wall's top edge above it: the upper row slopes more than the lower one. On each wall the far
  windows are a little narrower and shorter than the near ones. Color: blue #5b8fc7.
- Flower boxes: exactly two, one under each first-floor window nearest the corner (one on each
  wall), in place of its sill. Each is a box floating a clear strip of wall color below the
  window, a little wider than the window and about one third as tall, its top and bottom edges
  sloping like the window's, color brown #8a5a33; on the box's top edge (one shared line) sits one
  low mound as wide as the box, its top made of exactly three round bumps, color leaf green
  #4f9d4a, its top a clear strip below the window; in each mound float exactly two small plain red
  circles, flowers with no petals and no centers, each with a clear band of green around it, color
  red #d8433b.
- Sills: exactly six, one under each of the other six windows: a flat shape about four line-widths
  tall hanging from the window's bottom edge (one shared line), a little wider than the window at
  both ends, its edges sloping like the window's. Color: cream #f6e7b8.
Keep a clear strip of wall color at least three line-widths wide between every part fixed to a
wall and the next: between each sill or flower box and the window, awning or door below it, and
between the awning and the flower box above it.
Nothing else: no roof other than the cornice, no chimney pots, no balconies, no second awning, no
café tables, chairs or menu board, no door handles, no bars or frames in the windows, no shutters,
no letters, signs or house numbers, no sidewalk, curb or street, no lamp post, no guide lines, no
vanishing point dots, no shadows, bevels or soft shading. Thirty-nine shapes and lines in total.
Count: two walls, one cornice, one chimney with two faces, one door with a pane, one café window
with two shine lines, one awning with four lines and five stripes, eight windows, two flower boxes
each with a mound and two flowers, six sills, two pieces of horizon.
```

### 5 · `fountain`

Objective: Three-tier town fountain drawn in ellipses, with ribbed bowls and arcs of water.

The creator made this fountain livelier than the prompt they were given (2026-09-30): three basins, a rim ring on
the lower one, ribs on the bowls, a stone step of blocks, and the water as blue outlined arcs instead of charcoal
lines. Its two potted trees were then taken out of the picture by hand, at the creator's request. The prompt below
describes the kept picture (`urban/fountain-openai.png`), so it can be made again. What made it more interesting,
for the prompts after it: more tiers of the same idea, ornament that repeats (ribs, panels, blocks), colored water,
and no mirror-pair companions.

```text
SUBJECT: a three-tier round town fountain, standing on its own: a wide lower basin on a gray stone
step, a gray column rising from its water to a middle basin, a short cream stem rising to a small
top basin, a knob and a round ball on top, and water falling from each level to the one below in
blue arcs. The fountain fills about 70% of the image, with clear white margin on all four sides.
VIEW: seen from the front and a little from above, with no perspective: each basin's round top is
a flat ellipse about one third as tall as it is wide, and the bottom of each round shape is the
front half of a flat ellipse. Hidden back edges are not drawn.
No shadows, drop shadows, soft shading, stone texture or shine anywhere.
- Lower basin: a rim ring, two flat ellipses one just inside the other, the ring between them
  cream #f6e7b8 and the water inside blue #5b8fc7; under the front half, the basin's side, a band
  about one fifth as tall as it is wide, cream, with exactly three orange #f08a2c panels floating
  on it (the middle one widest, the end ones narrower as they turn away). Two short curved
  ripple lines float on the water, one each side of the column.
- Step: under the basin's side, one low gray #c9ced6 band a little wider than the basin, divided
  into stone blocks by exactly four short upright lines.
- Column: a thick gray column standing in the lower water, flaring out at its foot, rising to the
  middle basin.
- Middle basin: a flat ellipse of blue water in a thin cream rim, on a cream bowl that curves in
  down to the column; exactly five curved ribs run down the bowl, from the rim to its foot.
- Stem and top basin: a short cream stem with a flared top and foot rising from the middle water
  to the top basin: the same as the middle basin, about 60% of its width, with five ribs.
- Ball: a small cream knob standing in the top water, and one cream ball on it.
- Water arcs: blue #5b8fc7 curved bands with a bold outline, each about three line-widths wide:
  exactly two from the ball's sides down into the top basin's water, two from under the top bowl
  down into the middle water, and four long ones from the middle basin's rim down into the lower
  water, two on each side, the outer ones reaching farthest. Arcs keep at least three line-widths
  apart and touch only the edges they start and end on.
Nothing else: no statue, figure or face, no drops, splashes or spray, no ground, no paving beyond
the step, no benches, lamps, plants or trees, no people.
```

### 6 · `canal-bridge`

Objective: Humpbacked bridge of three stone arches between brick quays, mirrored in the canal.

Third round, 2026-09-30. The creator did not like the flat bridge the previous prompt made (purple arches, a gray
parapet with panels) and generated their own: a humpbacked sandstone bridge whose top curves up in a wave, cream arch
stones round three open arches you see the sky through, red brick quays with cream copings, a house and trees at
each end, and everything mirrored in pale blue water. This prompt keeps that design and leaves out what cannot be
drawn: the stone and brick texture over every wall, a see-through reflection, houses cut off by the image's edge,
and colors outside the palette. Only the bridge and the quays are mirrored, so the houses and trees are drawn once.

```text
SUBJECT: a canal in an old town, seen straight from the side: a humpbacked stone bridge with three
round arches, red brick quays on both banks, a small house and a tree at each end, and the bridge
and quays mirrored in the still blue water below. The whole scene fills about 80% of the image's
width, with clear white margin on all four sides; nothing is cut off by the image's edge.
VIEW: a flat side view with no perspective. The waterline is one straight level line across the
scene.
No shadows, drop shadows, soft shading, stone or brick texture, transparency or shine anywhere.
- Water: one wide band below the waterline, from the left end of the scene to the right end, about
  one third of the image's height tall, with a level bottom edge and short upright ends. Color:
  blue #5b8fc7.
- Bridge: one closed shape standing on the waterline, about 55% of the image's width long. Its top
  edge rises from each end in a gentle wave, low over the side arches and highest over the middle
  one, like a humped back. Along its bottom, exactly three round arches rising from the waterline,
  a big one in the middle and a smaller one on each side, each a little more than a half circle.
  Between the arches its bottom edge is the waterline (one shared line). The arch openings are
  open: the white paper shows through them, as sky. Color: yellow #f7cf46.
- Arch stones: round each arch, one ring band about four line-widths wide following its curve, its
  inner edge the arch's own edge (shared), its two ends standing on the waterline. Short lines
  pointing at the arch's center divide the rings into stones: exactly seven on the middle ring,
  five on each side ring. Color: cream #f6e7b8.
- Coping: one band lying along the bridge's whole top edge (one shared line), following its wave,
  about four line-widths tall. Color: cream #f6e7b8. It keeps a clear strip of yellow at least
  three line-widths wide from the middle ring.
- Quays: exactly two brick walls, one at each end of the bridge, each one long block with four
  straight sides standing on the waterline (one shared line): its inner side is the lower part of
  the bridge's end, and its top a little lower than the bridge's end. Each is about one fifth of
  the image's width. Color: red #d8433b. On each lies a cream #f6e7b8 coping band, about three
  line-widths tall, as long as the quay.
- Houses: exactly two small houses, one standing on the outer end of each quay's coping (one
  shared line), each complete: a front wall with four straight sides, taller than wide; a roof, one
  low four-sided shape sloping down toward the canal, a little wider than the wall; and one window
  floating in the wall's upper half. Left house: wall yellow #f7cf46, roof red #d8433b, window blue
  #5b8fc7. Right house: wall orange #f08a2c, roof brown #8a5a33, window blue #5b8fc7.
- Trees: on the left quay, between the house and the bridge, one tall pointed cypress, a narrow
  flame shape standing on the coping, color dark green #2f6b3a. On the right quay, between the
  bridge and the house, one round tree: a short trunk standing on the coping, color brown #8a5a33,
  and a crown of exactly five round bumps sitting on it, color leaf green #4f9d4a. Each keeps at
  least three line-widths from the house and the bridge.
- Reflection: below the waterline, the mirror image of the bridge and the two quays only, the same
  sizes and straight below them, upside down: the bridge's reflection is one shape hanging from the
  waterline, its bottom edge the wave of the bridge's top turned over, dipping deepest in the
  middle, color cream #f6e7b8; the reflected arch openings are holes in it where the blue water
  shows, so that each arch and its reflection make one round opening cut by the waterline; round
  each reflected opening, a reflected ring band with no stone lines, color gray #c9ced6; the quays'
  reflections hang below the quays, color watermelon pink #ee5a6a. The houses, trees and copings
  are not reflected.
- Ripples: exactly four short straight level lines floating in the water below the reflection,
  at least three line-widths from everything. Charcoal lines with no color.
Nothing else: no bricks or stones drawn on the walls or quays other than the arch stones, no
reflection of the houses, trees or copings, no boats, lamps, railings, people or birds, no sky
color, no ground beyond the quays.
Forty-three shapes and lines in total. Count: one water band, one bridge with three open arches,
three rings (seven, five and five stones), one coping, two quays with their copings, two houses
each with a roof and a window, one cypress, one round tree with a trunk, the bridge's reflection
with three ring bands, two quay reflections, four ripples.
```

### 7 · `brick-window`

Objective: Arched window under a brick arch, with two climbing vines and bricks in three small patches.

Kept picture (2026-09-30): the creator's own design, and it is the lesson (`urban/brick-window-openai.png`, a white
margin added): no wall, the window standing on white paper; a band of seven coral wedges over the arch instead of
a keystone; four panes split by a cream cross; a cream post under each end of the band; six bricks (two, three and
one) where the prompt asked for nine in threes; two climbing vines in two greens; no shine lines. The two upper bricks
on the right are one line-width apart, so their outlines came from the color-edge trace. The prompt below is the
one it started from.

```text
SUBJECT: a patch of brick wall, seen straight on, with one tall arched window in the middle: a
frame holding three panes, a keystone at the top of the arch and a stone sill under it. The wall
is not covered in bricks: bricks are drawn in only three small patches, as a sketcher suggests a
brick wall instead of drawing every brick.
- Wall: one closed shape with four straight sides, a little taller than wide. Color: orange
  #f08a2c.
- Window frame: one tall closed shape floating in the middle of the wall: straight upright sides,
  a level bottom and a round arched top (a half circle), about twice as tall as wide.
  Color: cream #f6e7b8.
- Glass: exactly three panes floating inside the frame, with a band of frame color about three
  line-widths wide around each and between them: one half-circle pane filling the arch, its flat
  bottom level with where the arch begins, and under it two tall panes side by side, each with
  four straight sides. Color: blue #5b8fc7.
- Window shine: exactly two short straight lines in the upper left corner of the left tall pane,
  parallel, slanting up to the right, floating, touching nothing. Bold charcoal lines like every
  other line: not white, not pale, not filled.
- Keystone: one small wedge standing up into the wall from the top of the arch: its bottom edge a
  short stretch of the frame's arched top (one shared line), two straight sides spreading a little
  apart as they rise, and a level top. Color: gray #c9ced6.
- Sill: one flat shape with four straight sides under the frame, a little wider than the frame at
  both ends and about four line-widths tall, its top edge a stretch of the frame's bottom edge (one
  shared line). Color: gray #c9ced6.
- Bricks: exactly nine, in exactly three patches of three. Each patch floats on the wall with
  plenty of plain wall between it, the window, the sill and the wall's edges: one patch near the
  upper left corner of the wall, one on the right beside the middle of the window, one near the
  lower left corner. In each patch, two bricks lie side by side in a row and the third sits above
  them, centered over the gap between them, like a tiny piece of a real brick wall. Each brick is a
  small closed shape with four straight sides and softly rounded corners, about three times as
  wide as tall, with a clear gap of wall color at least three line-widths wide between neighboring
  bricks: bricks never touch. Color: red #d8433b.
Nothing else: no other bricks, no mortar lines, no other bars or panes in the glass, no other arch
stones, no shutters, no plants, no shadow. Eighteen shapes and lines in total. Count: one frame
with three panes, two shine lines, one keystone, one sill, nine bricks in three patches of three.
```

### 8 · `fire-hydrant`

Objective: Fire hydrant with a ribbed dome and two bands, water pouring from one nozzle into a puddle.

Kept picture (2026-09-30): the creator made their own from this prompt, and it is the lesson
(`urban/fire-hydrant-openai.png`): two ribs on a red dome, a cream belt round the barrel, one upright line down its
right part, red necks, the left nozzle open and pouring a blue curve of water into a puddle with two ripples, three
gray paving stones instead of the pavement, no front cap. The prompt below is the flat design it started from.

Third design, 2026-09-30. The shadow-and-water hydrant came back as asked but the creator did not like it; they
preferred a ChatGPT hydrant drawn flat, with no light: a pink dome with ribs under a red ring and a cream nut, a
cream collar, a red barrel with a big cream front cap and a gray six-sided nut, a capped nozzle on each side, a
gray flared foot, and three paving slabs under it, seen from a little above. This prompt keeps that design. Its
repeated ornament is the dome's ribs; the shadow side, cast shadow and cobbles are gone, so no Urban lesson draws
light now (Light & Shadow is the path for it).

```text
SUBJECT: one old fire hydrant standing on a small patch of pavement: a nut and a ring on top of a
ribbed dome, a collar, a tall barrel with a big front cap, a capped nozzle on each side, and a
flared foot standing on three paving slabs. The whole scene fills about 80% of the image's width,
with clear white margin on all four sides; nothing is cut off by the image's edge.
VIEW: the hydrant stands upright and is seen straight on, from a little above: the foot's bottom and
the pavement show as flat shapes lying on the ground, the pavement a little wider at its front edge
than at its back edge. No light and no shadow.
- Barrel: one tall shape with straight upright sides, about twice as tall as it is wide, standing a
  little above the middle of the image. Color: red #d8433b.
- Collar: one flat band with rounded ends lying on the barrel's top edge (one shared line), a little
  wider than the barrel at both ends, about four line-widths tall. Color: cream #f6e7b8.
- Dome: one rounded dome sitting on the collar (one shared line), a little narrower than the collar,
  about as tall as it is wide. Color: watermelon pink #ee5a6a. Exactly four ribs: single curved
  lines running from the ring down to the collar, following the dome's curve, evenly spaced,
  dividing the dome into five strips, each at least three line-widths wide. Charcoal lines with no
  color.
- Ring: one small flat band with rounded ends sitting on the dome's top (one shared line), about one
  third as wide as the dome, about three line-widths tall. Color: red #d8433b.
- Top nut: one small upright shape with rounded corners sitting on the ring (one shared line), about
  half as wide as the ring, a little taller than the ring. Color: cream #f6e7b8.
- Front cap: one big circle floating in the middle of the barrel, about two thirds as wide as the
  barrel, with a clear strip of red at least three line-widths wide all around it. Color: cream
  #f6e7b8. In its middle, one six-sided nut floating, about one third as wide as the cap. Color:
  gray #c9ced6.
- Side nozzles: exactly two, one on each side of the barrel, level with the front cap, mirror images
  of each other. Each is three parts in a row going outward: a short neck attached to the barrel's
  side (one shared edge), color watermelon pink #ee5a6a; a cap, one taller shape with rounded
  corners attached to the neck's outer end (one shared line), color gray #c9ced6; and a knob, one
  smaller shape with rounded corners on the cap's outer end (one shared line), also gray #c9ced6, on
  purpose.
- Foot: one gray shape under the barrel: its top edge is the barrel's bottom edge (one shared line),
  its two sides flare outward in one smooth curve each, and its bottom is the front half of a wide
  flat oval, about twice as wide as the barrel. Color: gray #c9ced6.
- Pavement: one flat four-sided shape lying on the ground under the foot, much wider than the foot,
  its back edge level and a little shorter than its level front edge, its left and right sides
  slanting outward toward the front. Two single lines divide it into exactly three slabs, each line
  running from the back edge to the front edge and slanting outward like the sides: the middle slab,
  under the foot, is a little wider than the foot, color cream #f6e7b8; the two outer slabs are gray
  #c9ced6. The hydrant stands in front of the middle of the pavement's back edge: that edge stops on
  the foot's outline on each side, and the foot's bottom lies wholly inside the middle slab.
Nothing else: no light, shading, shadow side or cast shadow, no shine lines, no chains, no bolts, no
water, no cobbles, no curb, no other stones or ground. Twenty-one shapes and lines in total. Count:
one barrel with a front cap and its nut; one collar; one dome with four ribs; one ring and one top
nut; two nozzles, each a neck, a cap and a knob; one foot; one pavement in three slabs, divided by
two lines.
```

### 9 · `rooftops`

Objective: Tiled roof in three rows over a gable window, with a two-pot chimney and a water tank.

Kept picture (2026-09-30): the creator's own design, and it is the lesson (`urban/rooftops-openai.png`, a white
margin added): one roof where the prompt asked for four. A cream gable wall with an arched window on a ledge (four
panes round a white cross, no dormer); a band of four tiles down the gable's edge, a ball at the peak and a band of
tiles along the top; the roof itself tiled, five slanting lines crossed by three rows of six bumps; a cream chimney
with a cap and two pots standing through the roof; a brown water tank with two hoops, a blue pointed lid and a knob,
on two legs braced with an X; a green tree behind. The roof's slanting lines, the marks on the top band and the
cap's corner are thin see-through strokes in the picture: `from-image` made them brown slivers, so the lesson is
traced from a working copy in which those pixels are ink. The tracer ran each bump on into the slanting line below
it; the lines were cut at every crossing and put back together as five slanting lines and eighteen bumps, and each
color area runs along the drawn lines (the traced ones spilled past the tank's lid). The picture's orange snaps to
the palette's red, and its slate lid to blue. The prompt below is the one it started from.

```text
SUBJECT: a view across the rooftops of a town: four roofs at four different angles, one behind
another, with a dormer window on the nearest roof, a round window in the pointed one, two
chimneys topped by chimney pots and one water tank standing on the flattest roof. Here the roofs
do overlap: that is what this lesson teaches. A roof in front hides part of the roof behind it,
and the lines behind stop exactly on its outline; the dormer stands in front of its roof the same
way. Only the roofs show: no walls or streets under them.
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
  Roof 3 and roof 4 do not touch: a clear gap of white at least three line-widths wide lies
  between them, and the same between roof 3 and roof 2. Roof 2's peak stays at least three
  line-widths below roof 4's top edge.
- Dormer: one small upright shape standing in front of roof 1, a little right of its middle, like
  a small house: two upright sides, a level bottom edge a clear strip above roof 1's eaves, and a
  pointed top whose peak stays a clear strip below roof 1's ridge. Roof 1 shows all around it.
  Color: cream #f6e7b8. In it, one small window with four straight sides, floating with a clear
  strip of cream around it. Color: blue #5b8fc7.
- Round window: one small circle floating in the middle of roof 2, with a clear band of red all
  around it. Color: blue #5b8fc7.
- Chimneys: exactly two, each a small upright shape with four straight sides, taller than wide.
  One stands on roof 1's ridge toward its left end, in front of roof 3, which shows around it; the
  other stands on roof 4's top edge toward its left end. Each one's bottom edge is that roof's
  top edge (one shared line). Color: brown #8a5a33.
- Chimney pots: exactly two on each chimney, four in all: small upright rounded shapes standing
  side by side on the chimney's top edge (shared), with a clear gap at least three line-widths
  wide between them, where roof 3 or the white paper behind shows. Color: orange #f08a2c.
- Water tank, on roof 4's top edge toward its right end: exactly three legs, single straight
  upright lines standing on the roof's top edge, evenly spaced, about half as tall as the tank,
  charcoal lines with no color; on
  their tops a tank, one upright shape with straight sides and a flat bottom resting on the legs,
  a little taller than wide, color brown #8a5a33; on the tank a pointed cap, one low triangle a
  little wider than the tank sitting on its top edge (shared), color gray #c9ced6.
Nothing else: no roof tiles or tile lines, no walls, doors or other windows, no antennas, no
smoke, no birds, no sky, no clouds, no sun. Eighteen shapes and lines in total. Count: four
roofs, one dormer with one window, one round window, two chimneys, four pots, one tank with a cap
on three legs.
```

### 10 · `cafe`

Objective: Two-story café seen from its corner: tiled roof, striped awning, a table and two chairs.

Kept picture (2026-09-30): the creator's own design, with no prompt behind it, and it is the lesson and the path's
last one (`urban/cafe-openai.png`). A cream two-story house seen from its corner: a tiled roof with a ball at its
peak, a band of five tiles down the gable's edge and a chimney with two pots; an arched window over a flower box
with two bushes; a green band across the front, and under it a red and cream awning of seven stripes, a shop window
of four panes, a door with a pane and a panel, and a round table between two chairs; two windows on ledges on the
side wall. It pulls together what the path drew before it: the shop front's awning, the balcony's flower box, the
brick window's arch, the rooftop's tiles and chimney.

The creator asked for small changes so it fits the app, and four were made to the picture before tracing:
- the potted bush at the side wall's foot was taken out (one step fewer), and the wall's corner it hid was finished
  with the two straight lines that lead to it;
- the tabletop was moved eight pixels lower: it all but touched the line above it, and the two fused in the trace;
- the dark rim shadows on the two chimney pots were painted the pots' own color (one came out as a line, the other
  as an orange sliver);
- the pale off-white of the frames, ledges, stripes, cap and tabletop was painted the wall's cream, because the
  palette has no white and it snapped to gray in speckles. `from-image` was given the palette without gray and brown
  (`--snap-distance 40`), so the table's leg is orange like the chairs.

Still fused in the trace, and drawn as they came: the hem's last two bumps lie on the door's top line, and the right
chair's back ends on the shop window's corner. The roof's lines were cut at every crossing and put back together as
three wavy lines down the roof, one along its foot and eight bumps; the color areas are the regions the drawn lines
enclose, each given the color the picture has there.

## What to send back

The PNGs you like, one per lesson, named `<lesson-id>-<model>.png`, for `docs/curriculum/urban/`. The
usual failures to watch for on this path: vanishing point dots or guide lines where none are asked for, window bars
and panes, bricks or tiles spread over whole walls and roofs, letters on the sign or the tram, wheels on the tram
lesson, a shadow cutting across a stone, a colored street or a frame round the finale, and people or pigeons. And,
from the shop front: pale or white shine lines, two parts nearly touching (a hair of white between their lines,
which the trace fuses into one dark block), rims, bands and stacked copies nobody asked for, and a landscape image.
Before keeping a picture, trace it: `svg from-image <png> --palette ../docs/curriculum/palette.json
--max-colours 12`, rendered with `rsvg-convert`, and look at the tight places.
