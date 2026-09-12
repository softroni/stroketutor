# Screen fragment contract (for the agents writing `src/screens/*.html`)

Read this whole file, then `design-system.css`, `symbols.svg.html` and `screens/_example.html` before writing anything.

## What you produce
One HTML **fragment** file per assignment in `docs/ios-design/src/screens/NN-name.html` (NN keeps flow order; the build
sorts by file name). A fragment contains one `<article>` per screen, nothing else — no doctype/html/head/body, no
`<link>`, no external resources, no images (draw with inline SVG or the `.photo` placeholder). Fonts, colours,
components and icons come from the shared design system, which the build inlines once. You may add a `<style>` block at
the top of your fragment for screen-specific CSS, **prefixed with your screen ids** so it cannot leak
(e.g. `#ob-1 .hero {…}`). You may add a small `<script>` at the end of your file, wrapped in an IIFE, only when CSS
cannot do it; the shell already handles navigation, variants and `data-goto`.

## Article skeleton
```html
<article class="screen" id="<prefix>-<name>" data-title="Human title" data-group="Onboarding">
  <header><h2>Human title</h2><p class="lede">One sentence: purpose and place in the flow.</p></header>
  <div class="screen-layout">
    <div class="device-column">
      <nav class="variants"><button type="button" data-variant="a">State A</button>…</nav>   <!-- optional -->
      <div class="devices">
        <div class="phone" data-variant="a"> …status bar… …content… <div class="home-indicator"></div> </div>
        …
      </div>
      <p class="device-caption">optional</p>
    </div>
    <aside class="notes"> …developer notes, headings as in _example.html… </aside>
  </div>
</article>
```
- `id` must be unique across the whole document. Use your assigned prefix.
- `data-group` is the sidebar section. Use exactly the group name you were assigned.
- Every phone starts with `<div class="island"></div>` and the status bar from `_example.html`, and ends with
  `<div class="home-indicator"></div>`. iPad landscape variants use `class="phone phone--ipad"` and no island.
- Phones are 393×852 CSS px = iPhone 16 Pro points. **Content must fit**: the `.screen-body` clips. Use
  `.screen-body--scroll` when a real screen would scroll, and make sure the first fold is what a learner needs.

## Interactivity you get for free
- `data-goto="<article id>"` on any element navigates the document to that screen (walkthrough links: a "Continue"
  button in onboarding goes to the next onboarding screen, a lesson card goes to the lesson preview, and so on).
  Add `data-variant="x"` next to it to land on a variant. Targets are validated by the build — every `data-goto` must
  point at an existing article id. Cross-agent targets are listed in the screen map you were given; use those ids
  exactly.
- `data-set-variant="x"` on an element inside a phone switches that same article to variant `x` (e.g. tapping "I drew
  it" in the *drawing* variant shows the *awaiting* variant). Great for showing state changes in place.
- Variants: one `.phone` per `data-variant`, one button per variant in `nav.variants`. The first button is the default.

## Design system (use it, don't re-invent it)
- Tokens, type classes, `.btn` family, `.card`, `.list`, `.chip`, `.progress`, `.dots`, `.tabbar`, `.speech`,
  `.narration`, `.canvas-frame` with `.stroke.draws`, `.photo` placeholders, `.overlay/.sheet`, `.alert-overlay`,
  `.toast` — all in `design-system.css`, commented.
- Icons: `<svg><use href="#i-…"/></svg>` (list in `symbols.svg.html`). The tutor character: `#lina-neutral`,
  `#lina-pen`, `#lina-point`, `#lina-wave` via `<span class="lina lina--md"><svg><use href="#lina-pen"/></svg></span>`.
  Never redefine ids starting with `lina-` or `i-`. If you need one more icon, draw it inline in your fragment with a
  screen-prefixed id.
- Real drawings: use the real stroke data from `shared/Tutorials/simple-house.json` (walls, roof, door, windows,
  chimney; canvas 1000×1000) and `cat-face.json`, or hand-write plausible pen-and-ink paths in the same M/L/C/Q/Z
  grammar. Add `pathLength="1"` and `class="stroke draws"` with `--dur`/`--delay` to animate a step drawing on.
- The primary button is green and is reserved for the one action that moves the learner forward ("I drew it",
  "Start drawing", "Continue"). Everything else is secondary/text.

## Voice & the tutor
- Every lesson step has a recorded narration (the tutor's voice, ElevenLabs, produced in the Studio later; the
  `voiceover` field already exists in the schema). Show where narration is audible: the `.narration` chip with the
  wave while it plays, a mute control that persists, and captions = the written instruction (never rely on audio
  alone).
- The tutor ("Lina") appears in onboarding as the person teaching, and later only as a small presence (the narration
  chip, a line at completion). She never nags, never counts streaks, never awards points. Calm, direct, adult.

## Notes for developers (the `<aside class="notes">`)
Write for the iOS engineer who will build M7 in SwiftUI without you. Use these headings in this order, dropping any
that truly don't apply: Purpose · Layout · States & interactions · Data · Voice & narration · Accessibility ·
SwiftUI mapping · Open questions. Be concrete: point sizes, spacing, which token, what happens on tap, what the
state machine does, which catalog/tutorial field feeds each label, VoiceOver labels, Dynamic Type behaviour,
reduced-motion behaviour, landscape/iPad. Cite the master plan section (`<span class="tag tag--plan">§31</span>`)
or the Mobbin pattern (`<span class="tag tag--mobbin">Duolingo</span>`) a decision comes from. Keep it tight.

## Check your work
`node docs/ios-design/build.mjs --check` validates your fragments (ids, groups, goto targets, symbol refs) and
`node docs/ios-design/build.mjs` writes `index.html`; open it in a browser and look at your screens in both
"One screen" and "Gallery" modes. Fix overflow: nothing may be cut off inside a phone unless the screen scrolls.
