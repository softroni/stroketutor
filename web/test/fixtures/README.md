# Test fixtures

`shared/` here is a frozen copy of the repository's `shared/Catalog`, `shared/Tutorials` and
`shared/Assets/References` — the catalog the server and command-line tests are written against:

```
shared/
  Catalog/    paths.json (houses, trees, cars), lessons.json
  Tutorials/  simple-house.json (5 steps), palm-tree-4.json (16), classic-red-car.json, cat-face.json
  Assets/
    References/   the two reference drawings the catalog points at
```

**It is deliberately frozen. Never sync it with `../../../shared/`.** The live folder is the
creator's content and it moves: a path is retired, a lesson leaves the curriculum, a tutorial is
redrawn with different steps. While the tests copied it, every such change broke a few dozen
assertions that had nothing to do with the code they were testing. They copy this instead, through
`FIXTURE_SHARED` in `web/test/fixture.ts`.

Change a file here only when a test needs content this fixture does not have — a lesson with a
property nothing else has, say — and fix the tests that read it in the same commit. Never change it
to follow `shared/`.

The tests that *are* about the shipped content still read `shared/` itself, and that is their job:
`src/studio/library.test.ts` ("builds the shipped library with no problems") and
`src/catalog/validate.test.ts` ("shipped catalog") check the whole catalog and assert only what holds
for any valid one, never a particular path or lesson. `src/schema/conformance.test.ts`,
`src/schema/formatJSON.test.ts`, `src/studio/quality.test.ts` and `src/studio/editor/ops.test.ts`
read `shared/Tutorials/simple-house.json` and `cat-face.json` as goldens — real drawings the parser,
the formatter, the quality rules and the editor are held to. Retiring either file from `shared/`
means giving those tests another golden to hold.
