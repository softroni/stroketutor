# Food & Treats — image-generation prompts

Source art for the ten `food-treats` lessons (Starter level) in `plan.json`, written for a raster
image model (OpenAI image, Gemini / Nano Banana). Same pipeline as the fruits:
PNG → `svg from-image --palette ../docs/curriculum/palette.json` → `author-lesson`.

## How to run them

- The **style prompt is not repeated here**: use `style-v2` from
  [fruits-prompts.md](fruits-prompts.md#style-prompt-style-v2--identical-for-all-13-paths), unchanged.
  Send **style prompt + a blank line + reference line + lesson prompt** as one message (or put the
  style prompt in the system / instructions field where the tool has one).
- Attach the **approved apple** (`fruits/apple-openai.png`) to every request, with the reference line
  below. It is still the look of the whole course. For `snack-tray`, also attach the kept `burger`,
  `fries` and `boba-tea` pictures.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. Reject any candidate that gets a count wrong: the counts are the teaching points.
- Save the kept PNGs as `docs/curriculum/food-treats/<lesson-id>-<model>.png`, and record model,
  date and prompt version (`style-v2`) in the lesson's `--source`.

Things this path needs that the fruits did not, all asked for explicitly in the prompts so the
DRAWABLE rules allow them: wavy edges (icing, lettuce, scoops) always come with a **number of
waves**, a hole or a bite shows the **white background**, and clear things (the boba cup and lid)
are drawn **opaque**, in a flat color.

## Reference line

```text
Match the attached image exactly in line color, line weight, corner rounding, flatness of color,
margins and overall feel. Only the subject changes.
```

## Lesson prompts

### 1 · `donut`

```text
SUBJECT: one ring donut with icing, seen from straight above, so it is a perfect circle.
- Dough: one outer circle. Color: orange.
- Hole: one small circle in the exact center, about a quarter of the donut's width. The white
  background shows through the hole; it is the only white inside the subject.
- Icing: one closed wavy shape lying on the donut, inside the outer circle, leaving an even ring of
  orange dough visible all the way around it. Its edge has exactly six soft, rounded lobes; the lobe
  at the lower right is longer than the others, like a drip, but still stays inside the outer
  circle without touching it. The icing runs right up to the hole. Color: watermelon pink.
- Sprinkles: exactly five sprinkles on the icing, each a short bar with round ends drawn as a small
  closed shape, each at a different angle, spread evenly around the ring, touching nothing.
  Colors: two yellow, two blue, one purple.
Nothing else: no bite, no shine on the icing. Count the sprinkles: five.
```

### 2 · `popsicle`

```text
SUBJECT: one ice popsicle on a stick, upright.
- Body: a tall rounded rectangle, about twice as tall as it is wide, with very round top corners
  and slightly rounded bottom corners. Color: red.
- Bite: the top right corner of the body is missing, bitten away. The bite edge is exactly two
  small round scoops side by side, curving into the body. The white background shows where the
  bite was taken.
- Grooves: exactly two short straight vertical lines in the lower half of the body, side by side,
  the same length, touching neither the outline nor each other.
- Stick: a narrow upright rectangle with a rounded bottom end, coming out of the center of the
  body's bottom edge, about a third as long as the body. Color: cream.
Nothing else: no drips, no melting, no puddle. About 6 lines in total.
```

### 3 · `ice-cream-cone`

```text
SUBJECT: one ice cream cone with two scoops, upright.
- Cone: a tall upside-down triangle with two straight sides, a straight top edge and a softly
  rounded point at the bottom. Color: orange.
- Crosshatch: exactly three straight diagonal lines leaning left and exactly three leaning right
  across the cone, evenly spaced, forming a diamond grid. Each line stops just short of the cone's
  outline at both ends. Nothing inside the diamonds.
- Bottom scoop: a round dome sitting on the cone, a little wider than the cone's top, overlapping
  and hiding the cone's top edge. Its bottom edge is a soft skirt of exactly three rounded
  scallops. Color: watermelon pink.
- Top scoop: a second round dome, slightly smaller, sitting on the first and overlapping its top,
  so the hidden part of the bottom scoop is not drawn. Its bottom edge is also exactly three
  rounded scallops. Color: pale green.
Nothing else: no cherry, no sprinkles, no drips, no wafer. Count the crosshatch: three and three.
```

### 4 · `cupcake`

```text
SUBJECT: one cupcake with a frosting swirl, upright.
- Wrapper: a trapezoid, wider at the top than at the bottom, with straight sides, a straight
  bottom and slightly rounded bottom corners. Color: blue.
- Ridges: exactly four straight lines running down the wrapper, evenly spaced, fanning very
  slightly to follow its sides. Each starts just below the wrapper's top edge and stops just above
  its bottom edge, touching nothing.
- Frosting: a swirl made of exactly three stacked tiers, each a smooth, rounded, sausage-like band.
  The bottom tier is a little wider than the wrapper's top and overlaps it, hiding the wrapper's
  top edge. The middle tier is narrower and sits on the bottom one, overlapping its top. The top
  tier is the smallest and ends in one soft point leaning slightly to the right. All three tiers
  are the same color here: watermelon pink.
Nothing else: no cherry, no sprinkles, no candle, no cake showing between wrapper and frosting.
About 9 lines in total.
```

### 5 · `pizza-slice`

```text
SUBJECT: one slice of pizza, crust at the top, point at the bottom.
- Crust: a thick, gently arched band across the top with rounded ends, a little wider than the
  cheese below it. Color: orange.
- Cheese: a long triangle hanging from the crust, with two straight sides meeting at a softly
  rounded point at the bottom. Color: yellow.
- Cheese drip: exactly one drip. Halfway down the left side, the cheese outline bulges out into
  one rounded teardrop hanging straight down, then returns to the straight side. The right side has
  no drip.
- Toppings: exactly five round slices of pepperoni on the cheese, all the same size, arranged from
  the top down in rows of two, two and one. Each is a plain circle, well inside the cheese,
  touching neither the outline nor another slice. Color: red.
Nothing else: no other toppings, no bite, no strings of cheese, no dots on the crust.
Count the pepperoni: five.
```

### 6 · `fries`

```text
SUBJECT: one carton of fries, upright.
- Carton: a tapered box seen from the front: straight sides leaning inwards, so it is clearly
  narrower at the bottom than at the top, with a straight bottom and slightly rounded bottom
  corners. Its top edge is one smooth shallow curve that dips in the middle and rises to a soft
  corner at each side. Color: red. The carton is plain: no stripe, no logo, no letter.
- Fries: exactly eight fries standing in the carton. Each is a long, narrow rectangle with slightly
  rounded corners, its bottom hidden behind the carton's top edge. They are different heights and
  fan outwards very slightly.
  - Front row: three fries, spaced apart, drawn whole down to the carton's edge.
  - Back row: five fries, taller, showing in the spaces between and beside the front three and
    overlapped by them, so their hidden parts are not drawn.
  All eight are the same color: yellow.
Nothing else: no sauce, no salt, no loose fries. Count the fries: eight.
```

### 7 · `burger`

```text
SUBJECT: one burger seen from the side, as a stack of five layers, each lying directly on the one
below. From the top down:
- Top bun: a wide dome with a flat bottom and rounded bottom corners. Color: orange.
- Sesame seeds: exactly five small teardrop seeds on the top bun, spread evenly, well inside its
  outline, each a small closed shape. Color: cream.
- Lettuce: a thin band sticking out a little wider than the bun on both sides. Its top edge is
  hidden under the bun; its bottom edge is a wavy line with exactly five soft, even waves.
  Color: leaf green.
- Cheese: a thin flat band as wide as the bun, with exactly one corner showing: near the left, a
  single triangle of cheese hangs down over the front of the patty, pointing straight down.
  Color: yellow.
- Patty: a thick band with fully rounded ends, as wide as the bun. Color: brown.
- Bottom bun: a flat slab with a straight top, rounded bottom corners and a gently curved bottom,
  about half as tall as the top bun. Color: orange.
Nothing else: no tomato, no onion, no sauce, no toothpick, no plate.
Count the waves: five. Count the seeds: five.
```

### 8 · `boba-tea`

```text
SUBJECT: one cup of boba milk tea with a dome lid and a straw, upright. The cup and lid are drawn
opaque, in flat color, not see-through.
- Cup: a tall tapered cup seen from the front: a straight top, straight sides leaning inwards so it
  is narrower at the bottom, and a straight bottom with slightly rounded corners. Color: cream.
- Pearls: exactly eight round pearls in the bottom of the cup, all the same size, in two rows:
  five along the bottom and three above them. Each is a plain circle, touching neither the cup's
  outline nor another pearl. Color: brown.
- Lid rim: a thin band with rounded ends lying across the top of the cup, slightly wider than the
  cup. Color: blue.
- Dome: a smooth half-circle sitting on the rim band, a little narrower than the band.
  Color: gray.
- Straw: a long, narrow, straight rectangle coming out of the top of the dome, slightly right of
  center and leaning slightly to the right, with a flat top end. Only the part above the dome is
  drawn; the straw is not visible inside the dome or the cup. Color: watermelon pink.
Nothing else: no label, no sleeve, no ice, no tea line, no drops, no stripes on the straw.
Count the pearls: eight.
```

### 9 · `ramen-bowl`

```text
SUBJECT: one bowl of ramen with chopsticks. This one image is seen from slightly above, so the rim
of the bowl is a flat ellipse and the soup inside it can be seen.
- Bowl: a deep bowl. The rim is a wide, flat ellipse; below it the body is a smooth half-round
  shape narrowing to a small flat foot. Color: red, with the foot in the same red.
- Soup: the whole inside of the rim ellipse is one flat area. Color: yellow.
- Noodles: exactly three wavy lines lying across the middle of the soup, one above the other, each
  with exactly three soft waves. They are lines, not shapes, and touch neither the rim, the
  toppings nor each other.
- Toppings, each floating in the soup, clear of the rim and of each other:
  1. half a boiled egg at the front left: one oval (cream) with one circle inside it (orange);
  2. a sheet of seaweed at the back left: one upright rectangle with slightly rounded corners,
     standing in the soup and rising above the back of the rim, which it overlaps.
     Color: dark green;
  3. exactly three small slices of green onion at the front right: three plain small circles.
     Color: leaf green.
- Chopsticks: exactly two long, thin, straight sticks, parallel with a clear gap between them,
  resting on the right side of the rim and leaning up and out to the upper right. Their lower ends
  dip into the soup at the right; their upper ends reach well past the bowl. Each is a narrow
  closed shape with a flat end. Color: brown.
Nothing else: no steam, no spoon, no pattern on the bowl, no fish cake, no shadow, no table.
Count the noodle lines: three.
```

### 10 · `snack-tray`

```text
SUBJECT: a tray holding a burger, a carton of fries and a boba tea. The tray is seen from slightly
above; the three snacks standing on it are drawn from the front, in the same shapes as the three
other attached images, with less detail.
- Tray: a wide, shallow, rounded rectangle seen from slightly above, so it is much wider than it
  is tall and its far edge is a little shorter than its near edge. One inner line follows the
  outline all the way around, a little inside it, making a raised rim. Color: gray, rim and floor
  the same gray.
- Fries at the back, in the center: the red tapered carton with exactly six yellow fries, three in
  front and three behind.
- Burger at the front left, overlapping the lower left of the fries' carton: orange top bun with
  exactly three cream sesame seeds, leaf-green lettuce with a wavy bottom edge of exactly five
  waves, yellow cheese with its one hanging corner, brown patty, orange bottom bun.
- Boba tea at the front right, overlapping the lower right of the fries' carton: cream tapered
  cup with exactly five brown pearls in one row along the bottom, blue lid rim, gray dome,
  watermelon-pink straw leaning right. It is the tallest thing on the tray.
- The burger and the boba tea do not touch: there is a clear gap between them, and the fries'
  carton shows through it. All three stand on the floor of the tray, inside the inner line, and
  hide the part of the tray's far rim behind them. Here things do overlap: that is what this
  lesson teaches.
Nothing else: no napkin, no sauce cup, no table, no shadow, no background.
```

## What to send back

The PNGs you like (any number per lesson), in `docs/curriculum/food-treats/`, named
`<lesson-id>-<model>.png`. The usual failures to watch for on this path: shine spots on icing and
frosting, a see-through boba cup, a logo or stripe on the fries carton, steam over the ramen, and
extra toppings that were never asked for.
