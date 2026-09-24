# Voice

Lina's recordings, written by the Studio (`npm run studio -- voice publish <lesson>`) and bundled by
the iOS app as `Voice/` — one folder reference in `PaperCoach.xcodeproj`, so a lesson narrated
tomorrow needs no change to the project file.

```
Voice/
  <lessonId>/
    manifest.json      VoiceManifest: every step that was recorded, its file and the words in it
    <stepId>.m4a       AAC, 48 kbps mono
  app/
    manifest.json      AppVoiceManifest: the lines Lina says outside a lesson, keyed by line id
    hello.m4a          the onboarding "Meet the voice" sample and the Settings sample
    lesson-1..4.m4a    the four closing lines of a lesson    (CompletionLines)
    path-1..4.m4a      the four closing lines of a whole path
```

The shapes are `VoiceManifest` and `AppVoiceManifest` in `web/src/voice/types.ts`; the app reads them
in `PaperCoach/Features/Player/VoiceLibrary.swift`. The manifest, not the folder, is what says a
recording exists: a folder without one is a publish that did not finish, and the app stays silent for
it. A lesson with no recordings is silent and hides its narration chip, which is what every lesson
did before any audio shipped at all.

This file is why the folder is in git. Xcode's copy of a folder reference fails outright when the
folder is not there, so the empty `Voice/` has to exist in a fresh checkout; git cannot keep an empty
directory, and a `.gitkeep` would ship in the app bundle saying nothing. This README ships instead,
and says what the folder is for.

A frozen voice's reference recording (`reference/`) is **not** part of what the app plays. It is the
Studio's own material for putting Lina back on a speech server, and it should not be inside a folder
the app bundles whole — see the note in the S8 milestone in the root README.
