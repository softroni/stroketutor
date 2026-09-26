# Paper Coach iOS · v3 screens — brief for the screen agents

You are redesigning one group of screens of the Paper Coach iOS learner app as an interactive HTML mockup with short
developer notes. v3 is a **new look for the app itself**: white paper, bolder type, tactile buttons, a visible path of
lesson nodes. It must feel as modern and attractive as Duolingo or Simply Draw while keeping the product's adult tone.

Read, in this order:
1. This file.
2. `../BRIEF.md` (the product: audience, tone rules, learning model, the player state machine, narration, Lina, mock
   content). Everything there still holds except the visual system, which v3 replaces.
3. `../CONTRACT.md` (the fragment format: one `<article>` per screen, ids, variants, `data-goto`, `data-set-variant`).
   Same format; the paths in it change to `src/v3/screens/` and `src/v3/design-system.css`.
4. `design-system.css` in this folder — read every rule. Use its classes; do not re-invent them. Screen-specific CSS
   goes in a `<style>` block scoped to your ids (`#hp-home .x`, or `article[id^="hp-"] .x`).
5. `../symbols.svg.html` — icons (`#i-*`) and Lina (`#lina-*`). Shared, do not redefine.
6. `screens/_example.html` — a finished v3 screen showing the hero card, the path nodes, the tab bar and the notes.
7. The v1 fragment for your group in `../screens/` — for copy, mock data, the drawing `<symbol>`s (copy the ones you
   need into your fragment with your own prefix so ids stay unique), and the flows. Do **not** copy its layout.

Repo root: `/Users/zakaria/dev/softroni/stroketutor`. Write only your own file under `docs/ios-design/src/v3/screens/`.
Check with `node docs/ios-design/build.mjs --check` and build with `node docs/ios-design/build.mjs`, then open
`docs/ios-design/v3.html#<your first id>` in a browser (or `http://localhost:4173/v3.html` if the preview server is
up) and look at every variant. Nothing may be clipped inside a phone unless the body scrolls.

## The v3 look, in rules
- **White.** Page and paper are `#FFFFFF`. Depth comes from 2 pt `--line` borders and soft `--surface` tiles, not
  shadows. Shadows only on floating things: sheets, the reference thumbnail, the narration chip, toasts.
- **One loud colour.** Green (`--green`) is the way forward: the primary button, the current node, the active tab,
  the progress fill. Gold marks finished drawings. Clay is the tutor (Lina, speech, narration). Blue only for links.
- **Tactile buttons.** `.btn-primary` is 64 pt, radius 20, with a 4 pt darker bottom edge; `.btn-secondary` is
  white with a 2 pt border and a 4 pt edge. Duolingo's affordance, adult colours and copy. One primary per screen.
- **Big type, tight tracking.** Large title 36/800, title2 24/800, instruction 24/800, body 17/500. Adults 40+ read
  this app; nothing under 13 pt, and 13 pt only for meta lines.
- **The path is visible.** Home shows the current path as round nodes (`.path`, `.node-row`, `.node--done/current/
  locked`) on a gentle zig-zag with the finished drawing inside each node. Calm: no streaks, XP, hearts, gems.
- **The paper is the product.** In the player the paper is full-bleed white, the drawing is large, and the
  instruction sits in a white sheet at the bottom with the one green button.
- **Drawings everywhere.** Thumbnails are pen drawings on white paper (`.thumb`, `.page-thumb`, node art). Use the
  real Simple House strokes and the hand-drawn symbols from the v1 fragments.
- **Copy stays adult and calm** (BRIEF §Tone). Short sentences. At most one exclamation mark in the whole app.
- **Lina** is the guide in onboarding (large, with `.speech`), a `.face` in the narration chip, and one line at
  completion. Nothing else.

## Screens and ids (cross-links must use these ids exactly)
| Group (data-group) | id | Screen | File |
|---|---|---|---|
| Onboarding | `ob-splash` | Launch: wordmark on white, a house drawing itself | 10-onboarding.html |
| Onboarding | `ob-1` | "Have you ever wanted to draw what you see?" — Lina + a reference photo → drawing | |
| Onboarding | `ob-2` | The method: watch · draw on paper · tap I drew it (three tiles, animated stroke) | |
| Onboarding | `ob-3` | What you need: a pen, paper, five minutes | |
| Onboarding | `ob-who` | Name + avatar. Exists in the app; no mockup article yet — see `10-onboarding.html` beat numbering | |
| Onboarding | `ob-level` | Choose a level: three full-width cards (Starter/Core/Advanced), Starter selected | |
| Onboarding | `ob-path` | Choose a path: picture-card grid of the chosen level's paths, first selected | |
| Onboarding | `ob-voice` | Meet the voice: narration on/off, a sample line | |
| Onboarding | `ob-ready` | Your first lesson is ready → `hp-preview` | |
| Home & paths | `hp-home` | Learn tab: hero card + the Houses path as nodes; variants in-progress · first-time | 20-home-paths.html |
| Home & paths | `hp-paths` | All paths: cards with a drawing, progress, "not yet" state | |
| Home & paths | `hp-path` | Path detail: header with big drawing, then the node path; variants default · locked · complete | |
| Home & paths | `hp-preview` | Lesson preview: reference photo + finished sketch side by side, objective, time, Start drawing | |
| Player | `pl-player` | Variants: orientation · drawing · awaiting · reference · muted · last-step | 30-player.html |
| Player | `pl-landscape` | iPhone landscape: paper left, sheet right | |
| Player | `pl-leave` | Leave sheet and the resume state on the preview | |
| Completion & sketchbook | `sk-complete` | Lesson complete: the finished drawing on a page, one line from Lina, two facts | 40-completion-sketchbook.html |
| Completion & sketchbook | `sk-capture` | Photograph the page: primer · camera · review · saved | |
| Completion & sketchbook | `sk-book` | Sketchbook tab: 2-column pages by month; empty state | |
| Completion & sketchbook | `sk-entry` | One page: photo, lesson, date, note, delete | |
| Settings | `st-settings` | Settings: grouped list, icon tiles | 50-settings.html |
| Settings | `st-voice` | Narration & voice: toggle, speed, a sample | |
| Settings | `st-reminder` | Practice reminder: gentle, off by default | |

Flow links: `ob-ready` → `hp-preview`; onboarding Continue → next beat; `hp-home` hero → `hp-preview`; a node →
`hp-preview` (current) or `hp-path` variant `locked` (locked); `hp-preview` Start → `pl-player` variant `drawing`;
player close → `pl-leave`; last step Finish → `sk-complete`; Add to sketchbook → `sk-capture`; Next lesson →
`hp-preview`; Not now → `hp-path`; tabs: Learn `hp-home`, Sketchbook `sk-book`, Settings `st-settings`.

Tab bar markup (identical everywhere, move `is-active`):
```html
<nav class="tabbar">
  <button class="tab is-active" type="button" data-goto="hp-home"><span class="ico"><svg><use href="#i-pen"/></svg></span>Learn</button>
  <button class="tab" type="button" data-goto="sk-book"><span class="ico"><svg><use href="#i-book"/></svg></span>Sketchbook</button>
  <button class="tab" type="button" data-goto="st-settings"><span class="ico"><svg><use href="#i-gear"/></svg></span>Settings</button>
</nav>
```

## Developer notes (the `<aside class="notes">`)
Shorter than v1. Headings in this order, drop what does not apply:
**Purpose · Layout · States & interactions · What changed in v3 · SwiftUI mapping · Accessibility · Open questions.**
"What changed in v3" is a short list of the layout decisions that differ from the v1 design and why (white paper,
node path, hero banner, tactile buttons, larger type…). Cite the plan (`<span class="tag tag--plan">§31</span>`) or
a pattern (`<span class="tag tag--mobbin">Duolingo</span>`) where a decision comes from. Be concrete: points, tokens,
what happens on tap. Keep each screen's notes under about 60 lines.
