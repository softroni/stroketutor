import { Composition, Still } from "remotion";

import { Overview } from "./Overview";
import { FPS, TOTAL_FRAMES, X_FRAMES, X_SCENES } from "./scenes";
import { Thumbnail } from "./Thumbnail";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PaperCoachTour" component={Overview} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="PaperCoachTourX" component={() => <Overview scenes={X_SCENES} />} durationInFrames={X_FRAMES} fps={FPS} width={1920} height={1080} />
    <Still id="Thumbnail" component={Thumbnail} width={1920} height={1080} />
  </>
);
