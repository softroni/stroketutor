# StrokeTutor iOS — design brief for the screen agents

You are designing one part of the StrokeTutor iOS learner app as an interactive HTML mockup with developer notes.
Read this file, then `CONTRACT.md`, `design-system.css`, `symbols.svg.html` and `screens/_example.html`.
The repo root is `/Users/zakaria/dev/softroni/stroketutor`; the master plan is `docs/StrokeTutor_Master_Plan.pdf`
(a text extraction is at the path given in your prompt). Do not change anything outside `docs/ios-design/src/screens/`.

## The product in one paragraph
StrokeTutor is a guided *physical* sketching system for adult beginners, especially people around 40 and older who
always wanted to draw. The learner uses a real pen and real paper; the phone is a calm instructor. The app animates one
meaningful drawing step, stops, and waits. The learner copies that step onto paper and taps **"I drew it"** before
anything continues. Nothing auto-advances; no timer decides readiness (plan §4, §31). There is no digital canvas, no
accuracy score, no XP, no leaderboards, no public feed (§2, §30, §32). The finished drawing goes into a private,
local **sketchbook** as a photo of the real page (§7, §32).

## Who it's for → what that means on screen (§2)
| Audience | Implication |
|---|---|
| Adults first, ~40+ beginners | Mature tone, readable type (body ≥ 17 pt, instruction 22 pt), calm pace, tap targets ≥ 60 pt (`Theme.minimumTapTarget`), no childish visual language |
| No art training | Teach by doing and observing; no terminology-heavy copy |
| Real-world subjects | Houses, trees, architecture, landscapes, plants, streets, nature, everyday places |
| Physical sketchbook | Phone is the guide; the paper drawing is the outcome |
| Limited time | Most lessons 3–5 minutes; say so |
| Wants confidence, not judgement | No scores, grades, likes, or competition |

## Tone (§30) — this is a hard rule
| Use | Avoid |
|---|---|
| "Nice work. Your cottage is finished." | "AMAZING!!! +500 XP!!" |
| Calm, direct, capable adult language | Childlike praise, mascot-driven motivation |
| Progress through finished drawings | Leaderboards, public comparison |
| A visible path destination | Pressure-heavy daily streaks |

Write every string on your screens in this voice. Short sentences. No exclamation marks except at most one on the
completion screen, and only if it earns it.

## Learning model (§6, §7)
- **Paths** are subjects (Houses, Trees, Flowers, Mountains, Landscapes, Streets & Places, Plants & Leaves, Water &
  Coast, Everyday Objects, Architecture Details — candidate list). Inside a path lessons **unlock sequentially** as a
  recommendation: the locked sheet names the lesson to draw first and also offers "Try it anyway";
  across paths the learner switches freely, and progress is remembered per path. A path holds roughly 8–12 lessons.
- **Lesson anatomy:** reference photo → preview of the finished pen drawing → optional one-idea orientation → guided
  step (animate, stop) → learner draws on paper → "I drew it" → repeat → completion → invite to photograph the page.
- **Houses path example (App. A):** 1 Simple House · 2 House With Chimney · 3 Small Cottage · 4 House From an Angle ·
  5 Two-Story House · 6 Barn · 7 Farmhouse · 8 House + Tree · 9 Cottage With Foreground · 10 Small Street Scene.
  Each lesson reuses prior vocabulary and adds one idea. Use these names for mock content.
- Published today in `shared/`: **Simple House** (5 steps: walls, roof, door, two windows, chimney; canvas 1000×1000;
  strokes below) and **Palm Tree 4** (16 steps, v2 with colour fills; Trees path). `cat-face` exists but is not in the
  curriculum. Objective strings live in `shared/Catalog/lessons.json` (`objective`, `complexity` 1–5, `reference`
  {file, source, license}). Paths in `shared/Catalog/paths.json` ({id, title, description, lessonIds}).

Simple House strokes (use these for real-looking canvases; `stroke-width` 16 for walls/roof, 12 for the rest):
```
walls    M 250 480 L 750 480 L 750 850 L 250 850 Z                 2.4 s
roof     M 200 480 L 500 260 L 800 480 Z                            2.2 s
door     M 440 850 L 440 690 L 560 690 L 560 850                    1.6 s
windows  M 320 540 L 420 540 L 420 640 L 320 640 Z  +  M 580 540 L 680 540 L 680 640 L 580 640 Z   1.3 s each
chimney  M 620 348 L 620 200 L 700 200 L 700 407                    1.6 s
```
Instructions in the file are still child-toned ("Great job, your house is done!"); the catalog says to rewrite them
in a calm adult voice — do that in your mockups, e.g. "Draw one square in the middle of the page. This is the front
wall."

## The player today (EXISTING — mirror it, then improve it)
`StrokeTutor/Player/PlayerViewModel.swift` state machine: `idle → drawing(step) → awaitingUser(step) → drawing(step+1)
… → finished`. Strokes in a step play strictly in sequence; a pencil-tip dot follows the active stroke; earlier steps
stay on the paper faded; the current step draws over them; the finished screen shows the whole drawing at full
strength. Controls: **I drew it** (primary, green, 68 pt, 26 pt heavy rounded), **Watch again** (secondary), and a
quiet row **Back · Replay · Speed 0.5×/1×/1.5×**. A header shows the lesson title and "Step 3 of 5 · Add the roof",
plus `StepProgressDots` (filled done, ringed current, faint ahead). While drawing, the card says "Watch carefully…".
The whole thing is `Theme.swift`: rounded SF type, page `#EDEBE6`, paper `#FAF7F0`, ink `#2B2B2B`, accent `#2178D9`,
success `#1C8F5C`. Keep all of this recognisable; M7 wraps it in a product shell, it does not replace it.

## Visual priority in the player (§31)
1. real-world reference / connection to reality → 2. the drawing canvas → 3. concise step instruction →
4. progress ("Step 4 of 9") → 5. the primary "I drew it" → 6. secondary controls (replay, back, speed, restart).
Keep the reference available during drawing: side-by-side on iPad landscape, a persistent expandable thumbnail on
iPhone. No countdowns. No auto-advance. Landscape when it materially helps.

## Voice narration (NEW — a product decision for this design)
Every step is narrated by the tutor's recorded voice: a short spoken version of the instruction, produced later in
the Studio with the ElevenLabs API and shipped as audio files beside the tutorial (`shared/Assets/Voice/<lessonId>/
<stepId>.m4a`, proposal). The schema already reserves `step.voiceover`. Design rules:
- Narration starts when a step starts drawing (like the Simply Draw app: the voice tells you *how* to draw the line
  while it draws). "Watch again" replays both the animation and the voice.
- The written instruction is always on screen; audio is never the only channel.
- A visible **narration chip** (`.narration`) shows the wave while speaking, with a **mute** toggle that persists in
  settings. Muted = the chip greys out; nothing else changes.
- Onboarding introduces the voice once ("Lina will talk you through each step. You can turn her off any time.").
- Respect the silent switch and other audio (duck music, never interrupt a call). Note these in developer notes.

## The tutor character (NEW — a deliberate, bounded departure from §30)
The plan says "avoid mascot-driven motivation". The creator wants the learner to feel that *someone is teaching them*,
so this design adds **Lina**, an adult artist drawn in the product's own pen-and-ink language (symbols `#lina-*`).
Bounded use:
- Onboarding: she is the guide, with a speech bubble (Duolingo's Duo-plus-bubble pattern, calmer, see below).
- Player: she is only a voice — the narration chip carries a tiny `lina--xs` portrait; she never pops over the canvas.
- Completion: one short line in her voice, no confetti, no dancing.
- Never: streak nagging, guilt, points, cheering, notifications in her voice unless the learner opted in.
Say in your notes that the art is a placeholder direction for an illustrator (pose set: neutral, pen, point, wave).

## Duolingo patterns observed on Mobbin (use for craft, not as proof of anything)
- **Onboarding:** thin progress bar across the top with a back chevron; mascot on the left + speech bubble with one
  question; a single-choice list of big rounded rows with a selected state; one full-width CONTINUE pinned at the
  bottom. Some beats are just mascot + bubble + button, which is fine for the emotional beats.
- **Home:** a unit banner card at the top ("Section 1, Unit 10 · Order food and drink"); a vertical, gently zig-zagging
  path of round lesson nodes; tapping a node opens a popover card with the lesson name and one START button; the
  mascot sits beside the path. Bottom tab bar with 5 tabs. We use fewer, calmer nodes and a 3-tab bar.
- **Completion:** mascot, one headline, one sub-line, three stat tiles (XP, accuracy, time), one CLAIM button. Ours
  keeps the shape (portrait of the finished drawing, one calm headline, two honest facts like steps and minutes) and
  drops XP/accuracy.
- **Locked/next:** visual states for done (gold), current (green, animated), locked (grey) nodes.

## App structure (decided)
Tab bar, three tabs, identical markup everywhere:
```html
<nav class="tabbar">
  <button class="tab is-active" type="button" data-goto="hp-home"><svg><use href="#i-pen"/></svg>Learn</button>
  <button class="tab" type="button" data-goto="sk-book"><svg><use href="#i-book"/></svg>Sketchbook</button>
  <button class="tab" type="button" data-goto="st-settings"><svg><use href="#i-gear"/></svg>Settings</button>
</nav>
```
(Move `is-active` to the right tab.) The player and onboarding are full-screen covers without the tab bar.

## Screen map and ids (cross-links must use these exact ids)
| Group (data-group) | id | Screen | Owner |
|---|---|---|---|
| Onboarding | `ob-splash` | Launch screen | A |
| Onboarding | `ob-1` … `ob-8` | The eight first-run beats of §30, in order | A |
| Onboarding | `ob-voice` | Meet the voice: narration on/off, optional gentle reminder | A |
| Onboarding | `ob-ready` | "Your first lesson is ready" → `hp-preview` | A |
| Home & paths | `hp-home` | Learn tab: continue card + paths | B |
| Home & paths | `hp-paths` | All paths (browse / switch) | B |
| Home & paths | `hp-path` | Path detail (ordered lessons, next, done, locked, destination) | B |
| Home & paths | `hp-preview` | Lesson preview (reference, final sketch, time, objective, Start) | B |
| Player | `pl-player` | The player, variants: orientation · drawing · awaiting · reference · muted · last-step | C |
| Player | `pl-ipad` | Player on iPad landscape | C |
| Player | `pl-leave` | Leave-lesson sheet and resume | C |
| Completion & sketchbook | `sk-complete` | Lesson complete | D |
| Completion & sketchbook | `sk-capture` | Photograph the page (camera, review, saved) | D |
| Completion & sketchbook | `sk-book` | Sketchbook tab (empty, filled) | D |
| Completion & sketchbook | `sk-entry` | One sketchbook page | D |
| Completion & sketchbook | `sk-path-done` | A path finished | D |
| Settings & system | `st-settings` | Settings | E |
| Settings & system | `st-voice` | Narration & voice | E |
| Settings & system | `st-access` | Accessibility (large text preview, reduce motion, left-handed) | E |
| Settings & system | `st-reminder` | Practice reminder (optional, gentle) | E |
| Settings & system | `st-about` | About, photo credits & licences, privacy | E |
| Settings & system | `st-system` | System states: permissions primers, reset confirm, content problems, offline | E |

Flow links: `ob-ready` → `hp-preview` (or `hp-home`); `hp-home` continue → `hp-preview`; path card → `hp-path`;
lesson row → `hp-preview`; locked row → `hp-path` variant `locked`; `hp-preview` Start → `pl-player` variant
`drawing`; player close → `pl-leave`; last step "Finish" → `sk-complete`; "Add to sketchbook" → `sk-capture`;
"Next lesson" → `hp-preview`; "Not now" → `hp-path`; tabs as above.

## Content to use for mock data
- Learner: no name (no account). Paths: **Houses** (10 lessons, App. A names; learner on lesson 3), **Trees**
  (8 lessons; learner on lesson 1: Palm Tree), **Flowers**, **Streets & Places**, **Mountains** (not started).
- Times: "About 4 min". Steps: Simple House 5, Small Cottage 7, Palm Tree 16.
- Objective strings: "See a house as a box with a triangle on top, then place the door, windows and chimney." /
  "Reuse the body and roof; add one chimney and see how a single detail gives a house character."
- Dates: September 2026. Sketchbook: 6 pages across Houses and Trees.

## Quality bar
Every screen must be something a senior iOS designer would sign off: correct safe areas, nothing clipped, real
copy, one primary action, secondary actions quiet, consistent spacing (20 pt gutters, 12 pt between stacked
controls), and honest states (loading, empty, error) where they exist. Then the developer notes must let an engineer
build it without asking you anything.
