---
name: author-lesson
description: Turn a source SVG into a StrokeTutor lesson as a human would draw it, or plan a path of lessons
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
- **One to six lines per step, and they belong together:** the two edges of a trunk, both windows,
  a spine and its first leaflets. Within a step, list the lines in the order to draw them.
- **4 to 12 steps.** Fewer and each step asks too much; more and the lesson drags.
- **Colour after every outline.** One colour per step, or two or three small areas together, large
  areas first. Name the colour in plain words (dark green, sand) and say what it covers.
- **Titles short and direct:** "Draw the trunk", "Colour the leaves".
- **Instructions are one or two calm sentences for an adult.** Say what to notice as well as what to
  do: where the line starts, what it lines up with, how big it is next to something already on the
  page. No exclamation marks, no praise, no art jargon, nothing written for a child.
- **About five minutes in all.** `lessons quality` warns beyond it, on a step with more than six
  lines, on many tiny lines, and on a complexity jump from the previous lesson in the path. Warnings
  never block, but each one is a reason to regroup, or to ask the creator for a simpler SVG.
- **Prefer a few confident lines to dense tracing.** If the trace has far more lines than a hand
  would draw, trace again with `--max-strokes 32`, or run `svg optimize --simplify` first, before
  planning. A lesson is not a vectorisation.

## The workflow

1. **Prepare the file.** `svg optimize <file> --simplify` rewrites it as plain paths on the lesson
   canvas and drops specks; work from the optimised file when the source is busy.
2. **Trace and read it.** `svg trace <file> --out t.json --summary` prints every line (id, box,
   length, open or closed, colour) and every colour area (id, colour, area, box). `--max-strokes`
   sets how much detail is kept.
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
     ]
   }
   ```

   Every id must be in the trace and used once; a line or colour left out joins the last step of
   its kind and is reported. An id that is not there is refused before anything is written.
5. **Build it.** `svg to-steps <file> --plan plan.json --trace t.json --id <id> --title "…"
   --objective "…" --source "…" --license "…" [--path <path> --position <n>]`. No model, no key.
   The lesson is kept as a draft with the SVG as its reference and the build in its History.
6. **Look again.** `lessons render <id> --sheet --out sheet.png` is a contact sheet: one panel per
   step as the player shows it (earlier steps faded, this step's lines labelled s1..sN, the colour
   so far beneath) and a Finished panel. Judge it as a learner: does each step make sense on its
   own, does the order feel like drawing, does anything start in empty space?
7. **Adjust.** `lessons summary <id>` prints the lesson as ids (s1..sN, f1..fM per step, with start
   and end points). Then:
   - `lessons apply <id> --layer steps --plan p.json` regroups and rewords (`steps` with
     `strokeIds`/`fillIds` over the labels, every label once);
   - `lessons apply <id> --layer order --plan p.json` reorders steps and the lines within them and
     takes `reversedStrokeIds`, every step listing exactly its own labels;
   - `lessons apply <id> --layer instructions --plan p.json` rewords only;
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
