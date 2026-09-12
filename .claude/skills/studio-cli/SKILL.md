---
name: studio-cli
description: How to drive StrokeTutor Studio from the terminal with `npm run studio` - every command, its options, selectors, plan files, output, exit codes and the gotchas an agent hits
---

# The Studio command line

Everything the StrokeTutor Studio UI does can be done from a terminal, on the same workspace, through
the same store, validators and editing operations (`web/cli/`). This skill is the operating manual.
For *how to author a good lesson* (the drawing method), load `author-lesson`; this skill is *how the
tool works*. `reference.md` beside this file is every command's `--help`, verbatim.

## Running it

```bash
cd web
npm run studio -- <command> [options]      # the `--` is required: it stops npm eating the options
node cli/studio.mjs <command> [options]    # the same thing, without npm
npm run studio                              # lists every command
npm run studio -- lessons apply --help      # describes one command
```

- Run from `web/`. The bootstrap starts Vite as a module loader only (no port, no browser).
- Command names are one to three words (`status`, `paths create`, `lessons reference set`); the
  longest match wins, so `lessons reference set` is not `lessons` with extra arguments.
- Options take `--name value` or `--name=value`. Quote values with spaces. Boolean flags take no value.
- Positionals in `<angle brackets>` are required, `[square]` optional, `<name...>` takes the rest.

## Global options (every command)

| Option | Meaning |
|---|---|
| `--workspace <file>` | The SQLite workspace (default `STUDIO_WORKSPACE`, else `../.studio/workspace.sqlite`) |
| `--shared <dir>` | The `shared/` directory (default `../shared`) |
| `--json` | One JSON document on stdout, for scripts; notes and warnings go to stderr |
| `-y`, `--yes` | Answer the typed confirmation of destructive changes |
| `-q`, `--quiet` | Only results and errors |
| `--model <id>` | The OpenRouter model to generate with (default `OPENROUTER_MODEL`) |
| `-h`, `--help` | Usage of the command |

`STUDIO_WORKSPACE`, `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are read from `web/.env.local` and
the environment, as Vite reads them.

## Exit codes and output

| Code | Meaning |
|---|---|
| 0 | Done |
| 1 | Refused: a validation problem, a missing lesson, a bad plan, a model's failure. The reason is on stderr, or in the JSON as `{ "error": "…", "issues": [{ "path", "message", "value" }] }` |
| 2 | The command line could not be understood; usage is printed |

Without `--json` the output is sentences and tables for a person. With `--json` parse stdout only.
A save that lands on a version changed meanwhile (the creator's `npm run dev`, say) is refused with
"run the command again": re-run, it re-reads the latest version.

## The rules that hold everywhere

- **Only `publish` writes `shared/`.** Every other command changes the SQLite workspace. For an
  experiment, point `STUDIO_WORKSPACE` (or `--workspace`) at a scratch file; `shared/` is then read
  but never written, and `lessons delete --yes` plus `trash empty --yes` clean up.
- **Destructive changes ask for the id to be typed.** Unpublishing, deleting a published lesson,
  trashing a path with its lessons, `trash purge`, `trash empty`. Without a terminal nothing happens
  until `--yes` is passed. Deleting a workspace draft goes straight to the Trash.
- **Every edit is validated, then saved as a checkpoint** (a History entry, like ⌘S in the Studio);
  `--no-checkpoint` saves like an autosave. `history list` shows versions, `history use` brings one
  back. An edit that would leave the lesson invalid is refused and nothing is saved.
- **SVG commands need Chromium.** `svg trace|optimize|render|preview|to-steps`, `lessons generate`
  with an SVG, `lessons regenerate` and `lessons render` without `--svg` open the Studio's own browser
  code in headless Chromium through Playwright. Once: `cd web && npm install && npx playwright install
  chromium`, or set `STUDIO_CHROMIUM` to a Chrome executable. Chromium starts only for commands that
  need it, once per command. `--svg` on `svg preview` and `lessons render` needs no browser.
- **Generation needs a key and a model** (`OPENROUTER_API_KEY`, `--model` or `OPENROUTER_MODEL`);
  `--dry-run` says what would be sent without spending anything. `--plan` and `--no-model` need
  neither.
- **Never stage the creator's uncommitted `shared/` edits**, and never write into `shared/History`.

## Naming things

- A **lesson** by its id (`simple-house`); a **path** by its id (`houses`).
- A **step** by its number in `steps list` (1-based) or its id (`walls`).
- **Strokes** by selectors `<step>.<n>`: `2.1`; a range `2.1-3`; all of a step `walls.*`; a list
  `2.1,2.4-5`. Several selectors may be given. `strokes list <id>` prints them.
- In **plans** and **summaries**, lines are `s1..sN` and colours `f1..fM` in the lesson's drawing
  order across all steps; `lessons summary <id>` prints them. A trace's own ids (`svg trace
  --summary`) are also `s1..`/`f1..`, but numbered by the tracer, not by any lesson.

## Commands

The table gives each command's shape and what matters; `reference.md` has every option verbatim.

**The Studio**

| Command | What it does |
|---|---|
| `status` | Paths, lessons, what publishing would change |
| `settings` | Where the command line reads and writes; whether generation is possible |
| `models` | OpenRouter models that take images and honour structured output |
| `adopt-shared` | Accept `shared/Catalog` as it now is (after a `git pull` or hand edit); publishing refuses until then |

**Paths** (`paths …`)

| Command | Notes |
|---|---|
| `list`, `show <id>` | |
| `create [id] --title … [--description …]` | Id fixed once created; derived from the title when omitted |
| `rename <id> <title>`, `describe <id> <description>` | Empty description removes it |
| `move <id> --to <n>` or `--up` / `--down` | Position of the path in the curriculum |
| `reorder <id> <lessonId> --to <n>` or `--earlier` / `--later` | Position of a lesson within its path |
| `add <id> <lessonId...>` | Appends catalogued lessons, taking each out of its old path |
| `delete <id> [--lessons unfile\|trash]` | To the trash; lessons stay unfiled unless `--lessons trash` |

**Lessons** (`lessons …`)

| Command | Notes |
|---|---|
| `list [--path id] [--unfiled] [--status draft\|needs-review\|approved] [--state workspace\|published\|published-edited]` | |
| `show <id>` | Details, steps, quality warnings |
| `export <id> [--out file]` | The tutorial JSON as stored |
| `import <file> [--id] [--title] [--objective] [--path] [--position]` | A tutorial JSON becomes a draft |
| `set <id> --objective … --status … --complexity 1-5 --notes … --title …` | `--objective` also catalogues an uncatalogued lesson; `--notes ""` removes notes |
| `move <id> --path id [--position n]` or `--unfiled` | |
| `duplicate <id>` | A new draft right after it |
| `delete <id>`, `unpublish <id>` | Ask for the id; `--yes` for scripts |
| `approve <id> [--fail-on-warnings]` | |
| `validate <id-or-file>`, `quality <id>` | Strict check; the quality warnings (they never block) |
| `reference set <id> <file> --source … --license …`, `reference export <id> [--out]` | JPEG, PNG, WebP or SVG, typed by bytes |
| `generate <file> …` | Either a photo or an SVG; see Generation below |
| `regenerate <id> --layer instructions\|steps\|order\|drawing [--note …] [--use] [--out] [--dry-run]` | Recorded in History; `--use` makes it the lesson |
| `summary <id>` | The lesson as ids: per step, each line (label, box, start, end, length) and colour (label, colour, box, area) |
| `apply <id> --layer steps\|order\|instructions --plan <file> [--no-checkpoint]` | A plan by hand; see Plans below |
| `render <id> [--sheet] [--columns 3] [--no-labels] [--size px] [--svg] [--out file]` | The finished drawing, or a contact sheet (one panel per step, this step's lines labelled). Default `<id>.png` / `<id>.sheet.png` in the cwd |

**Steps** (`steps …`; all edits take `--no-checkpoint`)

| Command | Notes |
|---|---|
| `list <id>` | Numbers, ids, titles, counts, animation seconds, instructions |
| `set <id> <step> --title … --instruction …` | Either or both |
| `split <id> <step> --at <n>` | New step starts with stroke `n` of the step |
| `merge <id> <step>` | Folds the next step in, keeping this step's words |
| `move <id> <step> --to <n>` | |
| `group <id> <strokes...> [--title] [--instruction]` | Selected strokes become one new step where the first was |

**Strokes** (`strokes …`; all edits take `--no-checkpoint`)

| Command | Notes |
|---|---|
| `list <id> [step]` | Selector, step, duration, width, colour, length, `d` |
| `move <id> <strokes...> --to-step <step>` | To the end of that step; a step left empty goes |
| `reorder <id> <step> <n> --to <n>` | Within a step |
| `reverse <id> <strokes...>` | Same shape, animated from the other end; twice gives the original back |
| `delete <id> <strokes...>` | For good; the last stroke of a lesson cannot go |
| `set <id> <strokes...> --duration <s> --line-width <w>` | Either or both |

**History** (`history …`): `list <id>`, `show <id> <entry> [--out file]`, `use <id> <entry>`. Entry is
the number from `history list` (1 is newest), the entry id, or a unique prefix of it.

**Publishing** (`publish …`): `pending`, `lessons <id...>` (publishing approves), `curriculum`, `all`
(every approved lesson with changes, plus the curriculum). Each prints the `git add` line; nothing is
committed for you.

**Trash** (`trash …`): `list`, `restore <id>`, `purge <id>`, `empty`.

**SVG** (`svg …`) and **image**

| Command | Notes |
|---|---|
| `svg trace <file> [--out t.json] [--summary] [tracer options]` | Lines and colours as a lesson would be built from them; `--summary` prints ids, boxes, lengths, colours; `--json` with `--summary` gives the summary object plus `notes` and `outlineCoverage` |
| `svg optimize <file> [--simplify] [--epsilon 1.2] [--min-size 4] [--decimals 1] [--size 1000] [--out]` | One path per shape, absolute M/L/C/Q/Z, transforms applied, fitted to the canvas. Without `--simplify` the drawing is unchanged. Default `<file>.optimized.svg` |
| `svg render <file> [--size 1536] [--out]` | PNG on white paper, as a model is sent it |
| `svg preview <file> [--only s30-s40,f1] [--crop x0,y0,x1,y1] [--no-labels] [--size 1536] [--svg] [--out] [tracer options]` | The trace with every id drawn on it: a line's at its start point (red dot), a colour's at its centre. `--only` labels just those ids (ranges allowed) and fades the other lines; `--crop` shows one part of the canvas with labels scaled to it. `<file>` is an SVG (traced now) or a trace JSON by `.json` extension (no browser with `--svg`). Default `<file>.preview.png`. Here `--size` is the PNG's pixels, not the canvas |
| `svg to-steps <file> --id … --title … --objective … --source … --license … [--goal …] [--path id --position n] [--trace t.json] [--plan p.json \| --no-model \| --model id] [--no-keep] [--out] [--dry-run] [tracer options]` | A new lesson from an SVG; see Generation |
| `image to-steps <file> --id … --title … --objective … --goal … --source … --license … [--path --position] [--no-keep] [--out] [--dry-run]` | A new lesson from a photo; a model draws it. `--plan`/`--no-model` are refused (a photo has no trace) |

Tracer options (on `svg trace`, `svg preview`, `svg to-steps`, `lessons generate`, `lessons
regenerate --layer drawing`): `--max-strokes 32|64|96` (64 default), `--max-colours 8`, `--size 1000`
(the canvas; not on `svg preview`), `--min-stroke-length 16`, `--ink-max-channel 56`,
`--max-outline-width 26`, `--max-bend 55`, `--join-gap 10`.

## Generation, three ways

All three end as "Keep as draft" does: the tutorial, the reference image with `--source` and
`--license`, a draft catalog entry, and a `generated` History entry. `--goal` is required only when
a model is asked. `--no-keep` shows the candidate and keeps nothing; `--out` writes it as JSON.

1. **A model** (`svg to-steps file.svg …` or `image to-steps photo.jpg …`, `--model` or
   `OPENROUTER_MODEL`, key required). For an SVG the code traces and the model only orders, groups
   and names; for a photo the model invents the drawing.
2. **A plan by hand** (`svg to-steps file.svg --plan plan.json [--trace t.json] …`): no model, no
   key. This is how an agent authors; the method is in the `author-lesson` skill.
3. **No plan at all** (`--no-model`): the traced lines six per step, then one colour step. A
   starting point to regroup with `lessons apply` or `steps`/`strokes`.

`--plan` with `--no-model` is a usage error (exit 2).

## Plans

Plans use the vocabulary the OpenRouter models answer in, so one language serves an agent, the
prompts and the server. Every plan is checked in full before anything is built or written, and each
refusal names the fault: a missing list, a step without title or instruction, an id that is not
there, an id used twice, a label left out, a line listed under another step's id in an order plan.

**For `svg to-steps --plan`** (ids from `svg trace --summary` / `svg preview`):

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

`colourSteps` may be omitted only when the trace has no colours. A line or colour not placed joins
the last step of its kind, and the output says so.

**For `lessons apply --layer steps`** (labels from `lessons summary`; every s/f label exactly once;
title and instruction on each step; `fillIds` may be omitted):

```json
{ "steps": [
  { "id": "body", "title": "Draw the body", "instruction": "…", "strokeIds": ["s1", "s2"], "fillIds": [] }
] }
```

**For `lessons apply --layer order`** (every existing step id exactly once, each with exactly its own
labels in the new order; `reversedStrokeIds` names lines to animate from the other end; no words
needed):

```json
{ "steps": [ { "id": "roof", "strokeIds": ["s2"], "fillIds": [] }, { "id": "walls", "strokeIds": ["s1"], "fillIds": [] } ],
  "reversedStrokeIds": ["s2"] }
```

**For `lessons apply --layer instructions`** (every existing step id exactly once, with its new title
and instruction; nothing else changes):

```json
{ "steps": [ { "id": "walls", "title": "Draw the walls", "instruction": "…" } ] }
```

A script can build an order or instructions plan from `lessons summary <id> --json`: its `steps`
carry `id`, `title`, `instruction`, `strokes[].id` and `fills[].id`.

## Recipes

```bash
# See the state of things
npm run studio -- status
npm run studio -- lessons list --path houses --json

# A lesson from an SVG, authored by hand (see the author-lesson skill for the method)
npm run studio -- svg optimize palm.svg --simplify                       # → palm.optimized.svg
npm run studio -- svg trace palm.optimized.svg --out t.json --summary
npm run studio -- svg preview t.json --out preview.png                   # look at the ids
npm run studio -- svg to-steps palm.optimized.svg --plan plan.json --trace t.json \
  --id palm --title "Coconut Palm" --objective "…" --source "…" --license "CC0" --path trees
npm run studio -- lessons render palm --sheet --out sheet.png            # look at the steps
npm run studio -- lessons summary palm --json > summary.json             # write order.json from it
npm run studio -- lessons apply palm --layer order --plan order.json
npm run studio -- lessons quality palm

# Small edits
npm run studio -- steps split palm 4 --at 3
npm run studio -- strokes move palm 5.1,5.2 --to-step 4
npm run studio -- strokes reverse palm 1.1
npm run studio -- steps set palm 1 --title "Draw the trunk" --instruction "…"
npm run studio -- history list palm && npm run studio -- history use palm 2

# Ship
npm run studio -- lessons approve palm
npm run studio -- publish pending
npm run studio -- publish lessons palm          # prints the git add line

# Undo an experiment
npm run studio -- lessons delete palm --yes && npm run studio -- trash empty --yes

# Work on a scratch workspace so nothing real changes
STUDIO_WORKSPACE=/tmp/ws.sqlite npm run studio -- status
```

## Gotchas

- Forgetting `--` after `npm run studio` makes npm swallow `--json`, `--yes` and the rest.
- The default output of `lessons render` and `svg preview` lands in the current directory (`web/`);
  pass `--out` to put pictures elsewhere.
- `svg preview --size` is pixels; on every other SVG command `--size` is the canvas in units.
- Labels crowd where many lines start close together (the leaflets of a frond). Read such a region
  with `svg preview t.json --crop x0,y0,x1,y1 --only s30-s40`, taking the box from `svg trace --summary`.
- `lessons render --sheet` defaults to the sheet's own width (about 2400 px) so panel labels stay
  legible; `--size` overrides.
- A published lesson edited in the workspace shows as `published-edited`; `publish` writes it again.
- `publish` refuses while `shared/Catalog` changed outside the Studio; `adopt-shared` accepts it.
- The creator may have `npm run dev` running on the same workspace; the command line and the dev
  server share the SQLite file safely, and the Studio shows your changes on its next reload. Don't
  start a second dev server.
- Tests for the command line run in-process without Vite or a browser: `cd web && npx vitest run cli`.
  Real Chromium smoke tests: `STUDIO_BROWSER_TESTS=1 npx vitest run cli/browser.smoke`.

## Regenerating `reference.md`

```bash
cd web && node cli/studio.mjs 2>&1 | grep '^  [a-z]' | sed 's/^  //; s/  .*//' | while read -r c; do
  node cli/studio.mjs $c --help | grep -v -- '--workspace\|--shared\|--json\|-y, --yes\|-q, --quiet\|--model <id>\|-h, --help'; echo
done
```
