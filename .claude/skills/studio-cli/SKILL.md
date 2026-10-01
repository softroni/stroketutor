---
name: studio-cli
description: How to drive Paper Coach Studio from the terminal with `npm run studio` - every command, its options, selectors, plan files, output, exit codes and the gotchas an agent hits
---

# The Studio command line

Everything the Paper Coach Studio UI does can be done from a terminal, on the same workspace, through
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

**Levels** (`levels …`) — the bands the path list is grouped into

| Command | Notes |
|---|---|
| `list` | Every level, easiest first, with how many paths it groups |
| `create [id] --title … [--description …]` | Id fixed once created; derived from the title when omitted |
| `rename <id> <title>`, `describe <id> <text>` | Empty description removes it |
| `move <id> --to <n>` or `--up` / `--down` | Position of the level in the curriculum |
| `delete <id>` | Only a level with no path under it |

**Curriculum** (`curriculum …`)

| Command | Notes |
|---|---|
| `apply <file> [--dry-run]` | Lay a whole plan over the curriculum: levels, paths, and planned lessons in order. Safe to repeat |

**Paths** (`paths …`)

| Command | Notes |
|---|---|
| `list`, `show <id>` | `list` has level and color columns; `show` names both |
| `create [id] --title … [--description …] [--level id] [--color name]` | Id fixed once created; derived from the title when omitted. Without `--color` it takes one no other path wears |
| `rename <id> <title>`, `describe <id> <description>` | Empty description removes it |
| `level <id> <levelId>` or `--none` | Which level groups the path |
| `color <id> <color>` | `sky`, `peach`, `pink`, `butter`, `leaf`, `lavender`, `aqua`, `indigo`, `orchid` or `sand`: its cards in the app and the backdrop of its videos. Publish the curriculum for the app to have it |
| `move <id> --to <n>` or `--up` / `--down` | Position of the path in the curriculum |
| `reorder <id> <lessonId> --to <n>` or `--earlier` / `--later` | Position of a lesson within its path |
| `add <id> <lessonId...>` | Appends catalogued lessons, taking each out of its old path |
| `delete <id> [--lessons unfile\|trash]` | To the trash; lessons stay unfiled unless `--lessons trash` |

**Lessons** (`lessons …`)

| Command | Notes |
|---|---|
| `list [--path id] [--unfiled] [--status planned\|draft\|needs-review\|approved] [--state planned\|workspace\|published\|published-edited]` | A planned lesson shows steps and time as `-` |
| `show <id>` | Details, steps, quality warnings. A planned lesson shows its title, objective, path and how to generate it |
| `plan <id> --title … --objective … --path <id> [--position n]` | Hold a place for a lesson nobody has drawn yet |
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
| `video <id> [--intro words] [--signoff words] [--cta words] [--out file.mp4] [--stills dir]` | A vertical draw-along video for Shorts, TikTok and Reels (see *Lesson videos*). Default `.studio/videos/<id>.mp4`, outside git, with the post caption beside it as `.txt` |

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
| `split <id> <stroke> --at "x,y [x,y…]"` | Cut one stroke into several at the nearest points of the line: shape unchanged, animation time shared by length. One cut opens a closed line there; two make two lines, each running the way the original did |
| `join <id> <first> <second>` | Two open strokes become one, the second carrying on from the end of the first (reverse one first if it runs the wrong way) |
| `delete <id> <strokes...>` | For good; the last stroke of a lesson cannot go |
| `set <id> <strokes...> --duration <s> --line-width <w>` | Either or both |

**History** (`history …`): `list <id>`, `show <id> <entry> [--out file]`, `use <id> <entry>`. Entry is
the number from `history list` (1 is newest), the entry id, or a unique prefix of it.

**Publishing** (`publish …`): `pending`, `lessons <id...>` (publishing approves), `curriculum`, `all`
(every approved lesson with changes, plus the curriculum). Each prints the `git add` line; nothing is
committed for you.

**Trash** (`trash …`): `list`, `restore <id>`, `purge <id>`, `empty`.

**Social** (`social …`): `check`, `queue`, `post <id>`, `next`, `announce`, `pin <id>`, `status`, `stats`. Lesson videos,
step pins and release news posted to Softroni's accounts through Upload-Post; see *Posting lesson videos*.

**SVG** (`svg …`) and **image**

| Command | Notes |
|---|---|
| `svg trace <file> [--out t.json] [--summary] [tracer options]` | Lines and colours as a lesson would be built from them; `--summary` prints ids, boxes, lengths, colours; `--json` with `--summary` gives the summary object plus `notes` and `outlineCoverage` |
| `svg optimize <file> [--simplify] [--epsilon 1.2] [--min-size 4] [--decimals 1] [--size 1000] [--out]` | One path per shape, absolute M/L/C/Q/Z, transforms applied, fitted to the canvas. Without `--simplify` the drawing is unchanged. Default `<file>.optimized.svg` |
| `svg from-image <file> [--palette <hex,hex…\|file.json>] [--snap-distance 18] [--max-colours 8] [--min-area 48] [--size 1000] [--out]` | A flat-colour PNG, JPEG or WebP (a generated drawing: even dark outlines, solid colour, white paper) as an SVG of plain filled shapes, one per colour, to trace. `--palette ../docs/curriculum/palette.json` snaps each colour to the course's. Not for photographs. Default `<file>.svg` |
| `svg trace … --smoothing <n>` | How calm traced lines are: passes of smoothing with corners kept (default 40, 0 follows every pixel) |
| `svg render <file> [--size 1536] [--out]` | PNG on white paper, as a model is sent it |
| `svg preview <file> [--only s30-s40,f1] [--crop x0,y0,x1,y1] [--no-labels] [--size 1536] [--svg] [--out] [tracer options]` | The trace with every id drawn on it: a line's at its start point (red dot), a colour's at its centre. `--only` labels just those ids (ranges allowed) and fades the other lines; `--crop` shows one part of the canvas with labels scaled to it. `<file>` is an SVG (traced now) or a trace JSON by `.json` extension (no browser with `--svg`). Default `<file>.preview.png`. Here `--size` is the PNG's pixels, not the canvas |
| `svg to-steps <file> --id … --title … --objective … --source … --license … [--goal …] [--path id --position n] [--trace t.json] [--plan p.json \| --no-model \| --model id] [--no-keep] [--out] [--dry-run] [tracer options]` | A new lesson from an SVG; see Generation |
| `image to-steps <file> --id … --title … --objective … --goal … --source … --license … [--path --position] [--no-keep] [--out] [--dry-run]` | A new lesson from a photo; a model draws it. `--plan`/`--no-model` are refused (a photo has no trace) |

Tracer options (on `svg trace`, `svg preview`, `svg to-steps`, `lessons generate`, `lessons
regenerate --layer drawing`): `--max-strokes 32|64|96` (64 default), `--max-colours 8`, `--size 1000`
(the canvas; not on `svg preview`), `--min-stroke-length 16`, `--ink-max-channel 56`,
`--max-outline-width 26`, `--max-bend 55`, `--join-gap 10`.

## Levels and planned lessons

The curriculum has two more shapes than paths and lessons.

**Levels** group the paths in the learner's path list — Starter, Core, Advanced. A level only groups
and recommends an order; it never locks a path. A curriculum with no levels is one flat list, and
`paths.json` then has no `levels` key at all. A path with no level is listed after the levels.
`publish` writes only the levels that still have a published path under them.

**A planned lesson** is a place held in a path before anything is drawn: a catalog entry with an id,
a `title`, an `objective` and `status: "planned"`, and nothing else — no tutorial, no reference
image, no steps. It is how a whole curriculum can be laid out in one go and filled in one lesson at
a time. A planned lesson:

- is listed by `lessons list` with status and state `planned` and `-` for steps and time, and
  counted apart by `status` ("134 lessons: 130 planned, …");
- never appears in `publish pending` and is never written to `shared/`; `publish lessons <id>`
  refuses it by name;
- refuses every command that needs a drawing (`steps`, `strokes`, `history`, `lessons duplicate`,
  `lessons unpublish`, `lessons regenerate`, `voice`) with a sentence saying so;
- can be reworded (`lessons set <id> --title … --objective …`), moved (`lessons move`, `paths
  reorder`), deleted to the trash and restored like any other lesson.

**Applying a plan.** `curriculum apply <file>` lays a whole curriculum over the working one. The file
is:

```json
{
  "levels": [{ "id": "starter", "title": "Starter", "description": "Flat shapes and clean lines." }],
  "paths": [
    {
      "id": "sky-weather", "title": "Sky & Weather", "level": "starter", "color": "sky", "description": "…",
      "lessons": [
        { "id": "sun", "title": "Sun", "objective": "Circle with eight straight rays" },
        { "id": "palm-tree-4" }
      ]
    }
  ]
}
```

A lesson given with a title and an objective is created as a planned lesson when it is new, reworded
when it is still planned, and left exactly as it is when it is a real lesson. A lesson given as
`{ "id": … }` alone must already exist. Every level and path in the plan comes first, in the plan's
order; anything the plan does not mention keeps its own order after them, and a lesson already in a
path but not in the plan waits at the end of it. A lesson is taken out of whichever path held it.

Applying is **safe to repeat**: the second run finds everything where the first put it and says
"already applied". `--dry-run` prints what it would do and changes nothing.

## Filling a placeholder

Every flow that makes a lesson fills a planned lesson of the same id instead of refusing it. The
catalog entry keeps its place in its path, its status becomes `draft`, and its `title` is dropped —
the tutorial's title is the name from then on. `--title`, `--objective` and `--path` all default to
the planned lesson's own, so an id is usually enough; passing a `--path` that is not the planned
lesson's own is a usage error (exit 2).

```bash
# What is waiting to be drawn
npm run studio -- lessons list --status planned --path sky-weather
npm run studio -- lessons show sun

# Fill it from an SVG, authored by hand (see the author-lesson skill for the method)
npm run studio -- svg optimize sun.svg --simplify
npm run studio -- svg trace sun.optimized.svg --out t.json --summary
npm run studio -- svg to-steps sun.optimized.svg --plan plan.json --trace t.json \
  --id sun --source "…" --license "CC0"        # title, objective and path come from the placeholder

# Or fill it from a tutorial JSON you already have
npm run studio -- lessons import sun.json --id sun
```

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
npm run studio -- levels list && npm run studio -- paths list
npm run studio -- lessons list --path houses --json

# Lay out a curriculum, then fill it one lesson at a time
npm run studio -- curriculum apply ../docs/curriculum/plan.json --dry-run
npm run studio -- curriculum apply ../docs/curriculum/plan.json
npm run studio -- lessons plan comet --title Comet --objective "A streaking tail" --path space
npm run studio -- lessons list --status planned

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

# A video of a lesson for Shorts, TikTok and Reels
npm run studio -- lessons video rocket --stills /tmp/rocket-stills      # five frames in seconds: look first
npm run studio -- lessons video rocket                                    # → ../.studio/videos/rocket.mp4 + rocket.txt

# Undo an experiment
npm run studio -- lessons delete palm --yes && npm run studio -- trash empty --yes

# Work on a scratch workspace so nothing real changes
STUDIO_WORKSPACE=/tmp/ws.sqlite npm run studio -- status
```

## Lesson videos

`lessons video <id>` films a lesson as a 1080 × 1920 draw-along for YouTube Shorts, TikTok and
Instagram Reels, with the same code as the lesson page's **Video** tab (`web/server/video/`):

1. **Opening.** The finished picture, then the whole lesson drawn fast while Lina says her opening line
   (default: "Let’s draw a rocket. Grab a pencil and draw along with me."; `--intro` changes it).
2. **Every step** at the lesson's own pace, with Lina's recording for it, her words beside her portrait
   two or three at a time on one large line, the word she is saying in yellow, and the step's title and
   "Step n of N" at the top.
3. **Ending.** "Now draw it yourself / One line at a time, at your own pace" at the top, and up to
   four stickers of the lessons after it in its path (their illustrations, die-cut as on the App Store
   screenshots) land round the card and float while Lina says the lesson's closing line, captioned
   like the steps. Then her last words (`--signoff`, default "Draw more with Paper Coach. It’s free on
   the App Store.", "free to download" for a Premium lesson, `--signoff ""` for none), as the app icon,
   "Paper Coach", Apple's "Download on the App Store" badge and the call to action (`--cta`, default
   "Free · link in bio") take her place at the bottom. It ends 1.6 s after she stops.

- It uses the lesson **as it stands in the workspace** and the **recordings the Voice section has**,
  so a draft can be filmed. Every step and the closing line must be recorded (`voice narrate <id>`);
  it refuses and names the missing steps otherwise. The opening line and the last words are spoken
  through `voice say` in the cast voice (needs her speech server the first time; cached after, so the
  last words are made once for every free lesson) and matched to the loudness of the step recordings.
  The mix is normalised to -14 LUFS.
- **No confetti.** The app's completion is calm by design ("no confetti, no dancing", docs/ios-design);
  the stickers are the celebration, and they are real lessons. Keep what moves at the end to things
  the app or its App Store screenshots really show.
- **Word timing.** Whisper (`brew install openai-whisper`, model `base.en`) listens once to each
  recording for when each word is said; that is cached by take in `.studio/videos/words/`. Without it
  the timing is estimated from the words' lengths and the command warns.
- **Safe area.** Everything sits inside `SAFE` in `page.ts` (x 180–900, y 170–1450), measured on a
  real Short on an iPhone, so the platforms' buttons, channel line and title never cover the drawing,
  the words or the call to action. Keep new elements inside it. The stickers are decoration and reach
  out over the card's sides; `STICKER_BOUNDS` keeps them off the words and the buttons (`page.test.ts`
  checks every place), and a sticker that would cover part of the drawing (a bus, a still life) moves
  up or down or shrinks outwards (`stickerCandidates`), or is left out.
- **Look before you render.** `--stills <dir>` writes six PNGs (the opening, the fast drawing, a line
  being drawn, a colour going in, the closing line with the stickers, the ending) in about half a
  minute. Read them, then make the video.
- A render takes about a minute or two: every frame is drawn at 2160 × 3840 in headless Chromium and
  scaled down, split across up to four Chromiums (`STUDIO_VIDEO_WORKERS` overrides), and frames where
  nothing moved reuse the picture before them. Needs ffmpeg and Google Chrome (or Playwright's
  Chromium, or `STUDIO_CHROMIUM`).
- Videos go to `.studio/videos/` (gitignored). **Never commit a video**; `--out` elsewhere is fine.
- Apple's badge is `docs/app-store/marketing/assets/badges/download-on-the-app-store-black.svg`, used
  as supplied (never recoloured, stretched or animated beyond the fade). Without the file the ending
  says "Free on the App Store · link in bio" instead.

## Posting lesson videos

`social …` posts lesson videos to Softroni's accounts (YouTube Shorts, TikTok, Instagram and Facebook
Reels, Threads, Pinterest, X) through Upload-Post, one request for every platform (`web/server/social/`,
`web/cli/commands/social.ts`). docs/ops/README.md, *Lesson videos on social*, is how they are run.

- **Settings** are in `~/.config/upload-post/config` (`UPLOAD_POST_CONFIG` elsewhere), shell-sourceable
  like the Pixabay key: `UPLOAD_POST_API_KEY`, `UPLOAD_POST_PROFILE` (default `softroni`), and optionally
  `UPLOAD_POST_PLATFORMS`, `UPLOAD_POST_PINTEREST_BOARD`, `UPLOAD_POST_FACEBOOK_PAGE`,
  `UPLOAD_POST_AI_LABEL` (`tiktok` default, `all`, `none`), `UPLOAD_POST_YOUTUBE_MADE_FOR_KIDS`, and
  `APP_STORE_PROVIDER_TOKEN` (with it, every App Store link is a campaign link, `ct=<platform>`). The
  environment wins over the file. Never print the key or put it in the repository.
- `social check` first: the plan, which accounts are connected, and the Pinterest board and Facebook
  Page ids to set.
- **Order** (`social queue`; `stillToPost` in `web/server/social/queue.ts`, shared with the Studio's
  Social page): `docs/ops/social-up-next.txt` first, then a free lesson and a Premium one by turns,
  starting with the kind the last video wasn't, never the same path two days running. Free lessons go
  lesson 1 of every path, then 2 and 3; Premium ones in `docs/ops/social-premium-first.txt`'s order,
  then the rest. A Premium lesson's captions and pin say it is Premium and the app free to download. Only lessons in the version on sale (the catalog at the tag of the live build in
  `.studio/ops/facts.json`, e.g. `1.0(2)`; the working catalog when that is unknown) with every step
  recorded; unrecorded ones are skipped with a warning. Lessons listed in `docs/ops/social-up-next.txt`
  (one id a line) go before the rest, in that order.
- `social post <id>` renders the lesson now (as `lessons video` does) unless `--video` names a file;
  `social next` posts the next lesson in the queue, at most once in 12 hours unless `--again`. Both
  wait for every platform to finish (up to 20 minutes) and print each post's link or error; `--log`
  adds a line to the Today page. A platform not connected to the profile (or needing reconnecting) is
  left out with a warning: Upload-Post would never answer for it. `social status --refresh` asks again
  about recent posts, finished or not.
- **Before Paper Coach is on sale** (`.studio/ops/facts.json` has no live version) a public post is
  refused, because every video ends on the App Store. `--private` tests on YouTube (private), TikTok
  ("only me") and Facebook (a draft); Instagram, Pinterest and X have no private post and are left out.
  `--dry-run` shows every field each platform would get, with no key and no render.
- On Upload-Post's free plan TikTok is left out with a warning, and the plan allows 10 uploads a month:
  test sparingly.
- Each platform gets its own text: TikTok and Instagram the export's caption ("link in bio"), YouTube
  a "How to draw … #shorts" title and a description with the App Store link, Facebook the same
  description, Pinterest a title, a note and the App Store link on the pin, X at most 280 characters
  (Upload-Post strips links from X posts). TikTok posts are marked as promoting Softroni's own app.
- **Step pins** (`social pin <id>` writes one to look at): every step of a lesson on one 1000 × 1500 image in
  the path's color, earlier lines faded, the finished drawing last (`web/server/social/pin.ts`). A lesson's
  whole video brings its step pin to Pinterest 4 hours later, on the paid plan only (`--no-pin` leaves it
  out). Pins, and the video's Pinterest post, go on the path's board, "Easy Drawings: <path>", made the
  first time it is needed; `UPLOAD_POST_PINTEREST_BOARD` is only for a lesson in no path.
- **Speed draws** (`lessons video <id> --speed`, `social post <id> --speed`): about 20 s, the whole picture
  drawn in 8 s while Lina says "Watch a … come together", then the ending. Written to `<id>-speed.mp4`.
- **Release news** (`social announce --lesson <id> --news "…" --headline "…"`): a lesson's speed draw with
  words saying what's new, to every platform. Only when the version with the news is on sale, and at
  most two or three a month (docs/ops/social-plan.md, *Release news*).
- `social stats [--days 7]`: views, likes and comments of each recent post on each platform, as Upload-Post
  reads them from the platforms, with totals per platform. The Monday numbers on Today come from it.
- What counts as posted: only a lesson's whole video. A speed draw, a step pin or news leaves the lesson
  in the queue, and doesn't hold back the next day's lesson.
- `.studio/social/posts.jsonl` (outside git) is the record: one line per post and per status seen, with
  `media` (`video`, `speed`, `pin`) and `purpose` (`lesson`, `announce`). It only grows; never edit or
  delete it.
- The repo's copy: each finished post (`postEntry` in `web/server/social/posts.ts`: day in Central time,
  lesson, each platform's link or error) is a line in `.studio/ops/history/social/posts.jsonl` on the
  `ops-history` branch, written when the post finishes or `social status` sees it finish, and pushed by
  `today.py archive`. `postsByDay` groups the posts by day for the Studio's Social page.

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
