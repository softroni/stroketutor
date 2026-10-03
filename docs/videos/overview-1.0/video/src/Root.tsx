import { Composition, Still } from "remotion";

import { Overview } from "./Overview";
import { FPS, totalFrames } from "./scenes";
import { Thumbnail } from "./Thumbnail";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PaperCoachOverview" component={Overview} durationInFrames={totalFrames} fps={FPS} width={1920} height={1080} />
    <Still id="Thumbnail" component={Thumbnail} width={1920} height={1080} />
  </>
);
