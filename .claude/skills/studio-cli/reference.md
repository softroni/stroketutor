# Every Studio command, as `--help` prints it

Generated in `web/` on 2026-09-12 by the loop at the end of `SKILL.md`. Global options (`--workspace`, `--shared`, `--json`, `--yes`, `--quiet`, `--model`, `--help`) are accepted by every command and left out here.

```text
Usage: studio status

The working library: paths, lessons, what publishing would change.

Usage: studio settings

Where the command line reads and writes, and whether generation is possible.

Usage: studio models

The OpenRouter models that take images and honour structured output.

Usage: studio adopt-shared

Take shared/Catalog as it now is, after a git pull or a hand edit.

Usage: studio paths list

Every path in the working curriculum, in order.

Usage: studio paths show <id>

One path and its lessons in unlock order.

Usage: studio paths create [id]

A new path at the end of the curriculum. The id is fixed once created.

Options:
      --title <title>              The title learners see.
      --description <description>  What the path teaches, in a sentence or two.

Usage: studio paths rename <id> <title>

A new title for a path.

Usage: studio paths describe <id> <description>

A new description for a path; an empty text removes it.

Usage: studio paths move <id>

Change where a path comes in the curriculum.

Options:
      --to <n>  Its new place, counting from 1.
      --up      One place earlier.
      --down    One place later.

Usage: studio paths reorder <id> <lessonId>

Change where a lesson comes in its path.

Options:
      --to <n>   Its new place in the path, counting from 1.
      --earlier  One place earlier.
      --later    One place later.

Usage: studio paths add <id> <lessonId...>

Put catalogued lessons at the end of a path, taking each out of the path it was in.

Usage: studio paths delete <id>

Move a path to the trash. Its lessons stay, in no path, unless --lessons trash.

Options:
      --lessons <unfile|trash>  `unfile` (the default) keeps the lessons outside every path; `trash` deletes them too.

Usage: studio lessons list

Every lesson in the working library, with its status and where it sits.

Options:
      --path <id>        Only the lessons of this path, in unlock order.
      --unfiled          Only lessons in no path.
      --status <status>  Only draft, needs-review or approved.
      --state <state>    Only workspace, published or published-edited.

Usage: studio lessons show <id>

One lesson: its details, its steps and its quality warnings.

Usage: studio lessons export <id>

The lesson’s tutorial JSON, as stored.

Options:
      --out <file>  Write to this file instead of stdout.

Usage: studio lessons import <file>

A tutorial JSON file becomes a workspace draft (Import & test’s "Save as workspace draft").

Options:
      --id <id>                The lesson id; also its file name once published. Defaults to the document’s id.
      --title <title>          A title, replacing the document’s.
      --objective <objective>  The one-line objective shown in the path.
      --path <id>              The path to put it in.
      --position <n>           Its place in that path, counting from 1 (the end by default).

Usage: studio lessons set <id>

Change a lesson’s details: objective, status, complexity, notes, title.

Options:
      --objective <objective>  The one-line objective. Also catalogues a lesson that is not in the curriculum yet.
      --status <status>        draft, needs-review or approved.
      --complexity <n>         1 (a path’s first lesson) to 5.
      --notes <notes>          Notes for the creator; "" removes them.
      --title <title>          The lesson’s title (in the tutorial itself).

Usage: studio lessons move <id>

Put a lesson in a path, or take it out of every path.

Options:
      --path <id>     The path to move it to.
      --position <n>  Its place in that path, counting from 1 (the end by default).
      --unfiled       Take it out of every path.

Usage: studio lessons duplicate <id>

A copy of a lesson as a new draft, right after it in its path.

Usage: studio lessons delete <id>

Move a lesson to the trash. A published lesson is unpublished first.

Usage: studio lessons unpublish <id>

Take a lesson out of shared/, keeping it in the workspace.

Usage: studio lessons approve <id>

Mark a lesson approved, after its quality warnings.

Options:
      --fail-on-warnings  Refuse to approve while there are quality warnings.

Usage: studio lessons validate <id-or-file>

Check a lesson, or a tutorial JSON file, strictly.

Usage: studio lessons quality <id>

The quality warnings the Studio shows before approval.

Usage: studio lessons reference set <id> <file>

Store a reference image (JPEG, PNG, WebP or SVG) with a lesson, recording its source and licence.

Options:
      --source <source>    Where the image came from.
      --license <license>  The terms it may be used under.

Usage: studio lessons reference export <id>

Write a lesson’s reference image to a file.

Options:
      --out <file>  The file to write (default: the reference’s own name).

Usage: studio lessons generate <file>

A new lesson from a reference image (a photo, or an SVG traced into exact lines), kept as a draft.

Options:
      --id <id>                    The new lesson’s id (lowercase, digits, dashes); also its file name once published.
      --title <title>              The lesson’s title.
      --objective <objective>      The one-line objective shown in the path.
      --goal <goal>                The learning goal the lesson is planned around.
      --constraints <constraints>  Anything the model must respect, in a sentence or two.
      --source <source>            Where the reference image came from.
      --license <license>          The terms the image may be used under.
      --path <id>                  The path to put the lesson in.
      --position <n>               Its place in that path, counting from 1 (the end by default).
      --trace <file>               A trace from `svg trace --out`, instead of tracing the SVG again.
      --no-model                   SVG only: build the lesson from the trace without asking a model, a few lines per step.
      --plan <file>                SVG only: build the lesson from the trace and this plan (outlineSteps and colourSteps over the trace’s ids, plus reversedStrokeIds) instead of asking a model.
      --no-keep                    Show (and --out) the candidate; keep nothing in the workspace.
      --out <file>                 Write the candidate, its analysis and notes as JSON here.
      --dry-run                    Say what would be sent to the model, and stop.
      --max-strokes <n>            Lines to keep, longest first: 32 for fewer, 64 as New lesson traces, 96 for more.
      --max-colours <n>            Colours to reduce the file to (default 8).
      --size <units>               The square canvas the drawing is fitted into (default 1000).
      --min-stroke-length <units>  Lines shorter than this are texture and are left out (default 16).
      --ink-max-channel <n>        A fill is ink when no colour channel is above this, 0–255 (default 56).
      --max-outline-width <units>  Dark areas wider than this are coloured in, not drawn (default 26).
      --max-bend <deg>             A line carries on through a junction bending less than this, in degrees (default 55).
      --join-gap <units>           Line ends this close that continue the same way are joined (default 10).

Usage: studio lessons regenerate <id>

Redo one layer of a lesson: its instructions, steps, order, or the whole drawing.

Options:
      --layer <layer>              What to regenerate: instructions, steps, order or drawing.
      --note <note>                What should be different this time.
      --goal <goal>                The learning goal (default: the one it was generated with, else the objective).
      --constraints <constraints>  What the model must respect (default: the ones it was generated with).
      --use                        Make the regenerated version the lesson (kept in History like ⌘S). Otherwise it is only recorded.
      --out <file>                 Write the regenerated version, its rationale and notes as JSON here.
      --dry-run                    Say what would be sent to the model, and stop.
      --max-strokes <n>            Lines to keep, longest first: 32 for fewer, 64 as New lesson traces, 96 for more.
      --max-colours <n>            Colours to reduce the file to (default 8).
      --size <units>               The square canvas the drawing is fitted into (default 1000).
      --min-stroke-length <units>  Lines shorter than this are texture and are left out (default 16).
      --ink-max-channel <n>        A fill is ink when no colour channel is above this, 0–255 (default 56).
      --max-outline-width <units>  Dark areas wider than this are coloured in, not drawn (default 26).
      --max-bend <deg>             A line carries on through a junction bending less than this, in degrees (default 55).
      --join-gap <units>           Line ends this close that continue the same way are joined (default 10).

Usage: studio lessons summary <id>

The lesson as ids: each step with its lines (s1, s2, …) and colours (f1, f2, …), for writing a plan.

Usage: studio lessons apply <id>

Reshape a lesson with a plan written by hand: regroup its steps, reorder them, or reword them.

Options:
      --layer <layer>  What the plan changes: steps (regroup and reword), order (steps, lines within them, reversed lines) or instructions (words only).
      --plan <file>    The plan JSON: `steps` over the labels `lessons summary` prints, plus `reversedStrokeIds` for --layer order.
      --no-checkpoint  Save like an autosave: do not keep this version in History.

Usage: studio lessons render <id>

A picture of a lesson: its finished drawing, or with --sheet one panel per step with this step’s lines labelled as `lessons summary` names them.

Options:
      --out <file>   Where to write the picture.
      --no-labels    Leave the ids off.
      --size <px>    Pixels on the longer side of the PNG (default 1536; a sheet's own size for --sheet, so its panels stay legible).
      --svg          Write the picture as SVG text instead of a PNG; no browser is needed.
      --sheet        A contact sheet: one panel per step, then the finished drawing.
      --columns <n>  Panels across the sheet (default 3).

Usage: studio steps list <id>

The steps of a lesson, numbered as the other commands name them.

Usage: studio steps set <id> <step>

A step’s title and instruction.

Options:
      --title <title>              The new title.
      --instruction <instruction>  The new instruction.
      --no-checkpoint              Save like an autosave: do not keep this version in History.

Usage: studio steps split <id> <step>

Split a step before one of its strokes; the second half becomes a new step after it.

Options:
      --at <n>         The stroke the new step starts with, counting from 1 within the step.
      --no-checkpoint  Save like an autosave: do not keep this version in History.

Usage: studio steps merge <id> <step>

Fold the next step into this one, keeping this step’s words.

Options:
      --no-checkpoint  Save like an autosave: do not keep this version in History.

Usage: studio steps move <id> <step>

Change where a step comes in the lesson.

Options:
      --to <n>         Its new number.
      --no-checkpoint  Save like an autosave: do not keep this version in History.

Usage: studio steps group <id> <strokes...>

Turn the selected strokes into one new step, where the first of them was.

Options:
      --title <title>              The new step’s title.
      --instruction <instruction>  The new step’s instruction.
      --no-checkpoint              Save like an autosave: do not keep this version in History.

Usage: studio strokes list <id> [step]

The strokes of a lesson, or of one step, with their selectors.

Usage: studio strokes move <id> <strokes...>

Move the selected strokes to the end of another step. A step left empty goes.

Options:
      --to-step <step>  The step to move them into.
      --no-checkpoint   Save like an autosave: do not keep this version in History.

Usage: studio strokes reorder <id> <step> <n>

Change where a stroke comes within its step.

Options:
      --to <n>         Its new place in the step, counting from 1.
      --no-checkpoint  Save like an autosave: do not keep this version in History.

Usage: studio strokes reverse <id> <strokes...>

Draw the selected strokes from their other end: the same shape, animated the other way round.

Options:
      --no-checkpoint  Save like an autosave: do not keep this version in History.

Usage: studio strokes delete <id> <strokes...>

Remove the selected strokes for good, and any step they leave empty.

Options:
      --no-checkpoint  Save like an autosave: do not keep this version in History.

Usage: studio strokes set <id> <strokes...>

Retime the selected strokes, or change their line width.

Options:
      --duration <s>    Seconds of animation for each selected stroke.
      --line-width <w>  Line width in canvas units.
      --no-checkpoint   Save like an autosave: do not keep this version in History.

Usage: studio history list <id>

Every recorded version of a lesson, newest first.

Usage: studio history show <id> <entry>

One recorded version: its record, and its tutorial with --out.

Options:
      --out <file>  Write the version’s tutorial JSON to this file.

Usage: studio history use <id> <entry>

Bring a recorded version back as the lesson (kept in History like ⌘S).

Usage: studio publish pending

What publishing would change in shared/.

Usage: studio publish lessons <id...>

Write these lessons, and the curriculum as it stands, into shared/. Publishing approves them.

Usage: studio publish curriculum

Write the curriculum alone into shared/Catalog: paths, titles and order of published lessons.

Usage: studio publish all

Publish every approved lesson with changes, and the curriculum.

Usage: studio trash list

What is in the trash.

Usage: studio trash restore <id>

Put a trashed lesson or path back where it was, as a draft.

Usage: studio trash purge <id>

Delete a trashed item for good, with the history of a lesson nothing else uses.

Usage: studio trash empty

Delete everything in the trash for good.

Usage: studio svg trace <file>

Trace an SVG into the lines and colours a lesson would be built from.

Options:
      --out <file>                 Write the trace as JSON here (for `svg to-steps --trace`).
      --summary                    Print the trace as ids: each line with its box, where it is drawn from and to, its length; each colour with its area and box. Never path data.
      --max-strokes <n>            Lines to keep, longest first: 32 for fewer, 64 as New lesson traces, 96 for more.
      --max-colours <n>            Colours to reduce the file to (default 8).
      --size <units>               The square canvas the drawing is fitted into (default 1000).
      --min-stroke-length <units>  Lines shorter than this are texture and are left out (default 16).
      --ink-max-channel <n>        A fill is ink when no colour channel is above this, 0–255 (default 56).
      --max-outline-width <units>  Dark areas wider than this are coloured in, not drawn (default 26).
      --max-bend <deg>             A line carries on through a junction bending less than this, in degrees (default 55).
      --join-gap <units>           Line ends this close that continue the same way are joined (default 10).

Usage: studio svg optimize <file>

Rewrite an SVG as a plain drawing: one path per shape, absolute M/L/C/Q/Z, transforms applied, fitted to the canvas.

Options:
      --out <file>        Where to write the result (default: <file>.optimized.svg).
      --simplify          Also simplify each path, drop specks and smooth the curves that remain.
      --epsilon <units>   With --simplify: how far, in canvas units, a simplified path may stray (default 1.2).
      --decimals <n>      Decimal places kept in coordinates (default 1).
      --min-size <units>  With --simplify: shapes smaller than this in both directions are specks (default 4).
      --size <units>      The square canvas the drawing is fitted into (default 1000).

Usage: studio svg render <file>

Render an SVG to a PNG on white paper, as a model would be sent it.

Options:
      --out <file>  Where to write the PNG (default: <file>.png).
      --size <px>   Pixels on the longer side (default 1536, what the Studio sends to a model).

Usage: studio svg to-steps <file>

A new lesson from an SVG: the file is traced into exact lines and colours, and a model orders them into steps (or --no-model).

Options:
      --id <id>                    The new lesson’s id (lowercase, digits, dashes); also its file name once published.
      --title <title>              The lesson’s title.
      --objective <objective>      The one-line objective shown in the path.
      --goal <goal>                The learning goal the lesson is planned around.
      --constraints <constraints>  Anything the model must respect, in a sentence or two.
      --source <source>            Where the reference image came from.
      --license <license>          The terms the image may be used under.
      --path <id>                  The path to put the lesson in.
      --position <n>               Its place in that path, counting from 1 (the end by default).
      --trace <file>               A trace from `svg trace --out`, instead of tracing the SVG again.
      --no-model                   SVG only: build the lesson from the trace without asking a model, a few lines per step.
      --plan <file>                SVG only: build the lesson from the trace and this plan (outlineSteps and colourSteps over the trace’s ids, plus reversedStrokeIds) instead of asking a model.
      --no-keep                    Show (and --out) the candidate; keep nothing in the workspace.
      --out <file>                 Write the candidate, its analysis and notes as JSON here.
      --dry-run                    Say what would be sent to the model, and stop.
      --max-strokes <n>            Lines to keep, longest first: 32 for fewer, 64 as New lesson traces, 96 for more.
      --max-colours <n>            Colours to reduce the file to (default 8).
      --size <units>               The square canvas the drawing is fitted into (default 1000).
      --min-stroke-length <units>  Lines shorter than this are texture and are left out (default 16).
      --ink-max-channel <n>        A fill is ink when no colour channel is above this, 0–255 (default 56).
      --max-outline-width <units>  Dark areas wider than this are coloured in, not drawn (default 26).
      --max-bend <deg>             A line carries on through a junction bending less than this, in degrees (default 55).
      --join-gap <units>           Line ends this close that continue the same way are joined (default 10).

Usage: studio svg preview <file>

A picture of a trace with every line and colour labelled by its id, to write a plan from. Takes an SVG, or a trace JSON from `svg trace --out`.

Options:
      --out <file>                 Where to write the picture.
      --no-labels                  Leave the ids off.
      --size <px>                  Pixels on the longer side of the PNG (default 1536; a sheet's own size for --sheet, so its panels stay legible).
      --svg                        Write the picture as SVG text instead of a PNG; no browser is needed.
      --only <ids>                 Label only these ids, a comma list with ranges (s30-s40,f1); the other lines are faded.
      --crop <box>                 Show only this part of the canvas, x0,y0,x1,y1 in canvas units; labels scale to it.
      --max-strokes <n>            Lines to keep, longest first: 32 for fewer, 64 as New lesson traces, 96 for more.
      --max-colours <n>            Colours to reduce the file to (default 8).
      --min-stroke-length <units>  Lines shorter than this are texture and are left out (default 16).
      --ink-max-channel <n>        A fill is ink when no colour channel is above this, 0–255 (default 56).
      --max-outline-width <units>  Dark areas wider than this are coloured in, not drawn (default 26).
      --max-bend <deg>             A line carries on through a junction bending less than this, in degrees (default 55).
      --join-gap <units>           Line ends this close that continue the same way are joined (default 10).

Usage: studio image to-steps <file>

A new lesson from a photo (JPEG, PNG or WebP): a model draws the steps from the picture.

Options:
      --id <id>                    The new lesson’s id (lowercase, digits, dashes); also its file name once published.
      --title <title>              The lesson’s title.
      --objective <objective>      The one-line objective shown in the path.
      --goal <goal>                The learning goal the lesson is planned around.
      --constraints <constraints>  Anything the model must respect, in a sentence or two.
      --source <source>            Where the reference image came from.
      --license <license>          The terms the image may be used under.
      --path <id>                  The path to put the lesson in.
      --position <n>               Its place in that path, counting from 1 (the end by default).
      --trace <file>               A trace from `svg trace --out`, instead of tracing the SVG again.
      --no-model                   SVG only: build the lesson from the trace without asking a model, a few lines per step.
      --plan <file>                SVG only: build the lesson from the trace and this plan (outlineSteps and colourSteps over the trace’s ids, plus reversedStrokeIds) instead of asking a model.
      --no-keep                    Show (and --out) the candidate; keep nothing in the workspace.
      --out <file>                 Write the candidate, its analysis and notes as JSON here.
      --dry-run                    Say what would be sent to the model, and stop.
      --max-strokes <n>            Lines to keep, longest first: 32 for fewer, 64 as New lesson traces, 96 for more.
      --max-colours <n>            Colours to reduce the file to (default 8).
      --size <units>               The square canvas the drawing is fitted into (default 1000).
      --min-stroke-length <units>  Lines shorter than this are texture and are left out (default 16).
      --ink-max-channel <n>        A fill is ink when no colour channel is above this, 0–255 (default 56).
      --max-outline-width <units>  Dark areas wider than this are coloured in, not drawn (default 26).
      --max-bend <deg>             A line carries on through a junction bending less than this, in degrees (default 55).
      --join-gap <units>           Line ends this close that continue the same way are joined (default 10).

```
