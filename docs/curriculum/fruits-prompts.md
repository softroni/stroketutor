# Fruits — image-generation prompts

Source art for the ten `fruits` lessons (Starter level) in `plan.json`, written for a raster image
model (OpenAI image, Gemini / Nano Banana). The **style prompt** is the same for every path in the
curriculum; only the **lesson prompt** changes.

## How to run them

- Image models have no separate system prompt in most tools. Send **style prompt + a blank line +
  lesson prompt** as one message. Where a tool does have a system / instructions field (the OpenAI
  Responses API, Gemini's system instruction), put the style prompt there.
- Square, 1024 × 1024 or larger, PNG, opaque white background.
- **Lock the look with a reference image.** Generate `apple` until one is right, then attach that
  image to every later request with the line under "Reference line" below. Both OpenAI and Gemini
  accept image input, and this does more for consistency than any wording.
- Generate 3–4 candidates per lesson and keep the one with the fewest, cleanest lines, not the
  prettiest. A lesson is drawn with a pen, one line at a time.
- Record model, date and the prompt version (`style-v1`) for each kept image; that is its provenance.

## Style prompt (`style-v1`) — identical for all 13 paths

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

## Reference line (add from the second lesson on, with the approved apple attached)

```text
Match the attached image exactly in line colour, line weight, corner rounding, flatness of colour,
margins and overall feel. Only the subject changes.
```

## Lesson prompts

Each is complete as written; the counts are the lesson's teaching points, so reject a candidate
that gets a count wrong.

### 1 · `apple`

```text
SUBJECT: one apple.
- Body: a single round apple outline, slightly wider than tall, with a shallow dip at the top
  centre where the stem sits and a very slight dip at the bottom. Colour: red.
- Stem: a short, slightly curved stem rising from the top dip, drawn as a narrow closed shape.
  Colour: brown.
- Leaf: one simple pointed leaf attached to the stem, leaning to the right, with a single centre
  vein line. Colour: leaf green.
Nothing else. About 6 lines in total.
```

### 2 · `cherries`

```text
SUBJECT: two cherries joined at the stem.
- Two round cherries side by side near the bottom, the same size, the right one overlapping the
  left one slightly so part of the left outline is hidden. Colour: red.
- Two thin stems, each a single curved line rising from the top of a cherry and meeting at one
  point above and between them.
- One simple pointed leaf at the point where the stems meet, with a single centre vein line.
  Colour: leaf green.
Nothing else. About 7 lines in total.
```

### 3 · `pear`

```text
SUBJECT: one pear.
- Body: a single smooth outline, narrow and rounded at the top, swelling to a wide, heavy,
  rounded bottom. The widest point is in the lower third. Colour: pale green.
- Stem: a short stem from the top, leaning slightly left, drawn as a narrow closed shape.
  Colour: brown.
- Leaf: one small pointed leaf at the base of the stem, leaning right, with a single centre
  vein line. Colour: leaf green.
Nothing else. About 6 lines in total.
```

### 4 · `banana`

```text
SUBJECT: one banana, unpeeled, lying as a curve like a smile: both ends higher than the middle.
- Body: a long curved closed shape, thicker in the middle and narrowing towards both ends.
  Colour: yellow.
- Stem tip: a short blunt stem at the left end, as its own small closed shape. Colour: brown.
- Bottom tip: a very small dark blunt tip at the right end. Colour: brown.
- Ridge lines: exactly two long lines running along the length of the body, following its curve,
  from near the stem to near the tip, dividing the body into three bands.
Nothing else. About 7 lines in total.
```

### 5 · `watermelon-slice`

```text
SUBJECT: one triangular slice of watermelon, point at the top, curved rind along the bottom.
- Flesh: a triangle with two straight sides meeting at a rounded point at the top and a gently
  curved bottom edge. Colour: watermelon pink.
- Inner rind: a thin curved band directly under the flesh, following the bottom curve.
  Colour: pale green.
- Outer rind: a second curved band under the inner rind, the outside of the slice.
  Colour: dark green.
- Seeds: exactly five small teardrop seeds in the flesh, points facing the top, arranged two
  above three. Each seed is a small closed shape filled with the dark charcoal line colour.
Nothing else. No bite mark, no drips.
```

### 6 · `strawberry`

```text
SUBJECT: one strawberry.
- Body: a rounded heart shape without the top notch: wide rounded shoulders at the top, narrowing
  to a soft point at the bottom. Colour: red.
- Leafy top: a cap of exactly five short pointed leaves sitting on the top of the berry, fanning
  outwards like a small star, overlapping the top edge of the body. Colour: leaf green.
- Stem: a very short stem from the centre of the leaves. Colour: dark green.
- Seeds: exactly six small teardrop seeds on the body, evenly spread in rows of one, two and
  three from the bottom up. Each seed is a small closed shape. Colour: yellow.
Nothing else.
```

### 7 · `orange-half`

```text
SUBJECT: one orange cut in half, the cut face turned straight towards the viewer, so it is a
perfect circle.
- Peel rim: an outer circle and, just inside it, a second circle, making a narrow ring.
  Colour of the ring: orange.
- Pith: a thin ring between the peel and the segments. Colour: cream.
- Segments: exactly eight equal wedge-shaped segments arranged like a wheel around the centre,
  each with slightly rounded corners, separated from each other by thin cream gaps.
  Colour of the segments: yellow.
- Centre: one small circle where the segments meet. Colour: cream.
Nothing else. No juice drops, no leaf, no second half.
```

### 8 · `grapes`

```text
SUBJECT: one bunch of grapes hanging from a vine.
- Grapes: exactly ten round grapes, all the same size, packed in an upside-down triangle: a row
  of four at the top, then three, then two, then one at the bottom. Each grape overlaps the
  grapes in the row above it, so the hidden parts of the circles are not drawn. Colour: purple.
- Stem: a short thick stem rising from the top centre of the bunch. Colour: brown.
- Vine: exactly one curly tendril, a single spiral line, coming off the stem to the right.
- Leaf: one simple broad leaf with three points, attached to the stem on the left, with a single
  centre vein line. Colour: leaf green.
Nothing else. Count the grapes: ten.
```

### 9 · `pineapple`

```text
SUBJECT: one pineapple, upright.
- Body: a tall oval, slightly flattened at the top and bottom. Colour: yellow.
- Crosshatch: exactly three diagonal lines leaning left and exactly three diagonal lines leaning
  right across the body, evenly spaced, each running from edge to edge of the oval and gently
  curved to follow its roundness, forming a diamond grid. No dots or marks inside the diamonds.
- Crown: exactly seven long pointed leaves growing from the top of the body, fanning upwards and
  outwards: one straight up in the centre and three curving away on each side, the inner leaves
  overlapping the outer ones. Colour: leaf green for the centre and the two outermost leaves,
  dark green for the rest.
Nothing else.
```

### 10 · `fruit-bowl`

```text
SUBJECT: a bowl holding four fruits. This one image is seen from slightly above, so the rim of
the bowl is a flat ellipse.
- Bowl: a wide, shallow bowl. The rim is a flat ellipse; below it the body of the bowl is a
  smooth half-round shape narrowing to a small flat foot. The back of the rim is hidden by the
  fruit. Colour: blue, with the foot in the same blue.
- Four fruits resting in the bowl, overlapping one another, in the same shapes as earlier in the
  course and with no extra detail:
  1. an apple (red) at the front left, with its brown stem and one leaf-green leaf;
  2. a pear (pale green) at the front right, overlapping the apple slightly, with a brown stem;
  3. a banana (yellow, brown tips) lying across the back, curving over the top of the other
     fruit, with its two ridge lines;
  4. a bunch of exactly six purple grapes hanging over the rim at the far right.
  The rim of the bowl passes in front of the lower part of every fruit.
- Cast shadow: one flat, soft-cornered ellipse on the table under the bowl, shifted slightly to
  the right. Colour: grey, with no outline. This is the only shadow in the image.
Nothing else: no table edge, no cloth, no background.
```

## What to send back

The PNGs you like (any number per lesson), named `<lesson-id>-<model>.png`. Flat colour and an even
dark line are what make them traceable; if a model keeps adding shine spots, gradients or faces
despite the style prompt, that model is the wrong one for the course, whatever it looks like.
