import lina from "@/assets/lina-wave.svg";
import mushroom from "@/assets/mushroom.svg";
import pineTree from "@/assets/pine-tree.svg";
import sunflower from "@/assets/sunflower.svg";
import { CrownIcon } from "./icons";

/**
 * Lina and three of the Plants path's drawings, two of them Premium (PaywallArt):
 * what the subscription is for, without a word. Small and straight on the page, so
 * the price under it is what the eye lands on. The drawings are the lessons' own
 * (shared/Tutorials), drawn as the app's thumbnails draw them; Lina is the design's
 * #lina-wave.
 */
const LESSONS = [
  { src: pineTree, premium: false },
  { src: mushroom, premium: true },
  { src: sunflower, premium: true },
] as const;

export function PaywallArt() {
  return (
    <div className="pc-art" aria-hidden="true">
      <img className="pc-art-lina" src={lina} alt="" draggable={false} />
      <div className="pc-art-tiles">
        {LESSONS.map((lesson) => (
          <div className="pc-tile" key={lesson.src}>
            <img src={lesson.src} alt="" draggable={false} />
            {lesson.premium ? (
              <span className="pc-crown">
                <CrownIcon />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
