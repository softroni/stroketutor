# iOS learner app · screen designs

Interactive layouts of every screen of the StrokeTutor iOS app, with developer notes, made on 2026-09-12 as the
design input to milestone M7 (iOS product shell, master plan §29–§31) and M8 (private sketchbook, §32).

**Open [`v3.html`](v3.html) in a browser** for the current design of the app: white paper, one bold green,
tactile buttons, the path as lesson nodes (see its Design handbook for what changed and why). [`v2.html`](v2.html) is
the first design of the same screens in the same document chrome; [`index.html`](index.html) the first design in the
first chrome. All three are built from `src/` and share the screen ids, so `v3.html#hp-home` and `v2.html#hp-home`
are the same screen in two designs.

**About the document.** It is one file: an index of screens, one screen at a time on a sketch
mat with its developer notes beside it (or every phone at once as a contact sheet), and live flows: Continue walks
through onboarding, a lesson card opens its preview, Start drawing opens the player, I drew it advances it.
`/` finds a screen, `←` `→` step through them.

Start with the **Developer handbook** at the top of the sidebar: the rules the app follows, the app map, the
SwiftUI shape, the design tokens, the on-device data model and the voice-narration pipeline.

## Two decisions this design adds to the master plan

- **Narration.** Every step is spoken by the tutor's recorded voice while it draws (produced later in the Studio
  with the ElevenLabs API, shipped as `shared/Assets/Voice/<lessonId>/<stepId>.m4a`, optional per step, mutable in
  Settings). The written instruction is always on screen.
- **Lina, the tutor.** An adult artist in the product's pen-and-ink style who teaches during onboarding, is only
  a voice in the player, and says one calm line at completion. She never counts streaks or awards points; the
  plan's tone rules (§30) still hold. The character art here is a placeholder for an illustrator.

## Layout

```
v3.html                 the current design (commit it; it is what people open)
v2.html                 the first design, same document chrome
index.html              the first design, first document chrome
build.mjs               node build.mjs [--check|--lax]   assembles all three from src/, validates fragments
src/
  BRIEF.md              the product brief the screens were designed from
  CONTRACT.md           the fragment format (one <article> per screen, ids, variants, data-goto links)
  design-system.css     tokens and components; mirrors StrokeTutor/Views/Theme.swift where one exists
  symbols.svg.html      Lina (four poses) and the icon set, inlined once
  shell-v2.html         the document chrome of v2.html: index rail, sketch mat, spec-sheet notes, contact sheet
  shell.html            the first chrome (index.html)
  handbook.html         the developer handbook
  screens/              one fragment file per group, in sidebar order (first design)
  v3/                   the v3 design: BRIEF.md, design-system.css, handbook.html, screens/ (same ids as above)
```

Nothing under `StrokeTutor/`, `web/` or `shared/` is touched by this folder. To preview while editing:
`python3 -m http.server 4173 --directory docs/ios-design` (or the `ios-design` entry in `.claude/launch.json`).
