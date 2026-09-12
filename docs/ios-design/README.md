# iOS learner app · screen designs

Interactive layouts of every screen of the StrokeTutor iOS app, with developer notes, made on 2026-09-12 as the
design input to milestone M7 (iOS product shell, master plan §29–§31) and M8 (private sketchbook, §32).

**Open [`index.html`](index.html) in a browser.** It is one self-contained file: a sidebar of screens, one screen at a
time with its notes (or every phone at once in Gallery mode), and live flows: Continue walks through onboarding,
a lesson card opens its preview, Start drawing opens the player, I drew it advances it.

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
index.html              the built document (commit it; it is what people open)
build.mjs               node build.mjs [--check]   assembles index.html from src/, validates fragments
src/
  BRIEF.md              the product brief the screens were designed from
  CONTRACT.md           the fragment format (one <article> per screen, ids, variants, data-goto links)
  design-system.css     tokens and components; mirrors StrokeTutor/Views/Theme.swift where one exists
  symbols.svg.html      Lina (four poses) and the icon set, inlined once
  shell.html            the document chrome, navigation and gallery mode
  handbook.html         the developer handbook
  screens/              one fragment file per group, in sidebar order
```

Nothing under `StrokeTutor/`, `web/` or `shared/` is touched by this folder. To preview while editing:
`python3 -m http.server 4173 --directory docs/ios-design` (or the `ios-design` entry in `.claude/launch.json`).
