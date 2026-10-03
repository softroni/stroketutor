// YouTube chapters for the description, from the chapter cards: `node --experimental-strip-types chapters.ts`
import { CHAPTERS } from "./src/scenes.ts";

const stamp = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
for (const c of CHAPTERS) console.log(`${stamp(c.at)} ${c.title}`);
