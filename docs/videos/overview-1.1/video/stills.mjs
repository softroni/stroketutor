// node stills.mjs <out dir> <frame> [<frame> ...]: PNG stills of the tour, bundled once, to check the look.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const [outDir, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride: (c) => c, enableCaching: true });
const composition = await selectComposition({ serveUrl, id: "PaperCoachTour" });
for (const f of frames) {
  try {
    await renderStill({ composition, serveUrl, output: path.join(outDir, `f${String(f).padStart(5, "0")}.png`), frame: Number(f) });
    console.log("still", f);
  } catch (e) {
    console.log("FAILED", f, String(e.message ?? e).split("\n")[0]);
  }
}
