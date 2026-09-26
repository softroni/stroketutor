---
name: author-lesson
description: Turn a source SVG into a Paper Coach lesson as a human would draw it, or plan a path of lessons
---

# Author a lesson

You are the author. The code traces the creator's SVG into exact lines and colours; you look at the
drawing, decide the order a hand would draw it in, group the lines into steps, write the words, and
put the colour last. Every command below runs in `web/` as `npm run studio -- <command>`; nothing
here invents geometry, and nothing is written to `shared/` until `publish`.

This is one method in three places: this skill, the prompts an OpenRouter model is given
(`web/server/prompts/svgLessonPrompt.ts`, `regeneratePrompt.ts`), and the master plan (§7 what a
good lesson feels like, §18 guide the lesson rather than redraw it, §23 making drawings feel human).
Change the method here and in the prompts together.

## The method

Adults who never learned to draw copy each step onto real paper with a pen, one step at a time,
while a phone animates that step. A lesson reads as handwritten when it is ordered the way a hand
would order it.

- **Study the picture first.** Name the few big shapes that make the subject recognisable, the
  details that add character, and what the traced lines leave out. Decide where the drawing starts.
- **Big structure first, then the main features, then details.** Trunk before fronds, walls before
  roof, the body before the ears.
- **Each new line starts where it meets something on the page.** A person places a pen against a
  line they have already drawn; a step that starts in empty space is hard to copy.
- **A line is animated from its start.** When a hand would draw it the other way (a roof edge from
  the eaves up to the ridge, a trunk from the ground up, a long edge left to right), reverse it:
  `reversedStrokeIds` in an order plan, or `strokes reverse` afterwards.
- **The learner is 8 to 16 and copies with a pen on paper. Choose what is intuitive, easy and natural
  to follow over what is economical**, even when that means more steps, or going over a stretch of
  line twice. The next three rules are the creator's, from the first Fruits lesson (2026-09-19).
- **A line is one comfortable movement of the hand.** A large curved outline is never one line: a
  child cannot keep a long curve even and land it back on its own start. Split it where a pen would
  naturally lift (a dip, a corner, a tip; on a plain round shape, top and bottom) with
  `strokes split`, and give each part its own short step: an apple is "Draw the left side", then
  "Draw the right side", both begun at the top dip and both ending at the bottom one, so the second
  is a mirror of something already on the page. Small closed shapes (a cherry, a grape, a seed, a
  leaf) and straight-sided ones (walls, a window) stay whole. `lessons quality` warns with
  `long-stroke` when a curved closed line is longer than 0.6 of the canvas diagonal (about 850 units).
- **Finish one thing before starting the next.** Each part of the subject is drawn completely, as the
  thing it is, before the pen moves to another part: the whole stem (up one side, over the top, down
  the other, one line), and only then the leaf, and only then the leaf's centre line. A trace often
  runs one line across two things (a stem's edge carrying on as a leaf's vein) or gives one thing's
  edge to its neighbour (the top of the stem's right side traced as part of the leaf). Cut those
  apart with `strokes split` and put each thing back together with `strokes reverse` and
  `strokes join`, so that every stroke belongs to exactly one nameable part.
- **Stay on the source's lines.** Splitting, reversing and joining never move a line; nothing in a
  lesson is redrawn by hand or smoothed beyond what the tracer does. The finished drawing must sit
  on the ink of the picture it came from.
- **One to six lines per step, and they belong together:** the two edges of a trunk, both windows,
  a spine and its first leaflets. Within a step, list the lines in the order to draw them.
- **4 to 12 steps.** Fewer and each step asks too much; more and the lesson drags. Lean towards
  more, shorter steps on Starter paths. When a subject
  has more natural groups than that (seven fronds), merge the two most alike and least important
  into one step, keeping the six-line ceiling, before merging anything structural.
- **Colour after every outline.** One colour per step, or two or three areas together when a hand
  would not stop between them (two greens on the same fronds); large areas first, both across steps
  and within a step. Name the colour in plain words (dark green, sand) and say what it covers; when
  one colour covers two unrelated parts (highlights on the coconuts and specks on the sand), say both.
- **Titles short and direct:** "Draw the trunk", "Colour the leaves".
- **Instructions are one or two short sentences a child can read at a glance** (the creator,
  2026-09-19: less text on the screen, smaller sentences). Under about twelve words each and 110
  characters in all; `lessons quality` warns with `long-instruction` beyond that. Say where the pen
  starts and what to draw, in plain words and a familiar picture ("a big letter C", "like a
  mirror"); leave out sizes, proportions and anything the animation already shows. Colour steps are
  one sentence: "Colour the leaf green." Calm, no exclamation marks, no praise, no art jargon. The
  same words are what Lina speaks, so short on the screen is short in the ear too.
- **Lina speaks before and after every lesson, as a teacher would** (the creator, 2026-09-19). The
  player opens with the finished drawing and a quick run through every step while she says a few
  words ("I'm ready" starts step 1), and she says one sentence at the end. Every lesson has words
  for both without any being written (`web/src/voice/bookends.ts`: a few patterns, picked by the
  lesson's id), but a lesson is better with its own: something a child knows about the subject
  going in, and at the end a line about *their* drawing, never about getting it right.
  `voice lines set <id> lesson-intro "…"` and `voice lines set <id> lesson-outro "…"`, then
  `voice narrate <id>`. Warm, short (the intro about eight seconds, the outro one sentence), and
  ending the intro by handing over: "Watch how it comes together, then it's your turn."
- **About five minutes in all.** That is the learner's time, not the animation's: `steps list`
  shows seconds of animation, and `lessons quality` estimates the learner's minutes and warns beyond
  five, on a step with more than six lines, on many tiny lines, and on a complexity jump from the
  previous lesson in the path. Warnings never block, but each one is a reason to regroup, or to ask
  the creator for a simpler SVG.
- **Prefer a few confident lines to dense tracing.** If the trace has far more lines than a hand
  would draw, trace again with `--max-strokes 32`, or run `svg optimize --simplify` first, before
  planning. A lesson is not a vectorisation.

## The workflow

0. **A generated picture, not an SVG?** `svg from-image <file.png> --palette ../docs/curriculum/palette.json
   --out <id>.svg` turns a flat-colour PNG (see `docs/curriculum/fruits-prompts.md`) into the SVG the
   rest of this workflow expects, its colours snapped to the course's palette.
1. **Prepare the file.** `svg optimize <file> --simplify` rewrites it as plain paths on the lesson
   canvas and drops specks; work from the optimised file when the source is busy.
2. **Trace and read it.** `svg trace <file> --out t.json --summary` prints every line (id, box,
   where it is drawn from and to, length, open or closed, colour) and every colour area (id, colour,
   area, box). `--max-strokes` sets how much detail is kept. The "from → to" column is how you decide
   which lines to reverse: a line is animated from its start.
3. **Look at it.** `svg preview t.json --out preview.png` draws the trace with each line's id at its
   start point (a red dot marks where the animation begins) and each colour's id at its centre.
   Open the PNG and read the picture: which ids are the trunk, which the fronds, which a leaflet.
   On a busy drawing, `svg preview t.json --crop x0,y0,x1,y1 --only s30-s40 --out frond.png` zooms
   into one part and labels only those ids, the rest faded; take the box from `--summary`.
4. **Write the plan** as `plan.json`, in the models' answer vocabulary:

   ```json
   {
     "outlineSteps": [
       { "id": "trunk", "title": "Draw the trunk", "instruction": "…", "strokeIds": ["s21", "s45"] }
     ],
     "colourSteps": [
       { "id": "leaves", "title": "Colour the leaves", "instruction": "…", "fillIds": ["f1", "f2"] }
     ],
     "reversedStrokeIds": ["s21"]
   }
   ```

   Every id must be in the trace and used once; a line or colour left out joins the last step of
   its kind and is reported. An id that is not there is refused before anything is written.
   `reversedStrokeIds` names the lines a hand would draw from the other end (from the summary's
   "from → to" and the preview's red start dots); they are turned round in this first build, so
   direction is planned, not patched afterwards. Instructions may only point at what is already on
   the page by that step: never measure a frond against coconuts drawn five steps later.
5. **Build it.** `svg to-steps <file> --plan plan.json --trace t.json --id <id> --title "…"
   --objective "…" --source "…" --license "…" [--path <path> --position <n>]`. No model, no key.
   The lesson is kept as a draft with the SVG as its reference and the build in its History.
6. **Look again.** `lessons render <id> --sheet --out sheet.png` is a contact sheet: one panel per
   step as the player shows it (earlier steps faded, this step's lines labelled s1..sN, the colour
   so far beneath) and a Finished panel. Judge it as a learner: does each step make sense on its
   own, does the order feel like drawing, does anything start in empty space? Read the red start
   dots too: a line running the wrong way looks fine in a still picture, and only the dot shows it.
7. **Adjust.** `lessons summary <id>` prints the lesson as ids (s1..sN, f1..fM per step, with start
   and end points). These are the lesson's labels, numbered in drawing order, not the trace's ids
   from step 2: after the build, every correction is written in the lesson's labels. Then:
   - `lessons apply <id> --layer steps --plan p.json` regroups and rewords (`steps` with
     `strokeIds`/`fillIds` over the labels, every label once);
   - `lessons apply <id> --layer order --plan p.json` reorders steps and the lines within them and
     takes `reversedStrokeIds`, every step listing exactly its own labels;
   - `lessons apply <id> --layer instructions --plan p.json` rewords only;
   - `strokes split <id> <stroke> --at "x,y x,y"` cuts a line where a pen would lift (one cut opens a
     closed line at that point, two make two lines, each running the way the original did);
     `strokes join <id> <first> <second>` makes two open lines one. Take the points from
     `lessons summary` (each line's from → to) and the preview;
   - `steps split|merge|move|group|set`, `strokes move|reorder|reverse|set|delete` for one change
     at a time. Each save is a checkpoint in History; `history use` brings any version back.
8. **Finish.** `lessons quality <id>`, then `lessons approve <id>` and `publish lessons` (or
   `publish all`) when the creator says so; `publish` prints the `git add` line.

## Planning a path

`paths create --title "…"` makes the path; `paths describe` holds the plan until the drawings
exist, since a lesson cannot be in the catalog before its tutorial. For each lesson, tell the
creator what source to ask for: the subject, the view (front, three-quarter, side), how much
detail, and that it should be an SVG with plain fills, no gradients, no strokes narrower than a
pen. Each lesson adds one idea to the last (a box, then a box with a roof, then a roof with a
chimney); `lessons quality` compares complexity with the previous lesson in the path. Place each
lesson with `--path` and `--position` as it is built, or later with `lessons move`.

## When to use OpenRouter instead

`svg to-steps … --model <id>` (without `--plan`) asks a model to order and name the same trace;
`lessons regenerate <id> --layer steps|order|instructions --model <id>` asks for a second opinion
on an existing lesson and records it in History without using it. Compare the two through
`history show` and `lessons render --sheet`, and keep whichever reads more like a hand at work.
