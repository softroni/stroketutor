import { Composition, Still } from "remotion";

import { FPS, TOTAL_FRAMES } from "./edit";
import { Thumbnail } from "./Thumbnail";
import { Tour } from "./Tour";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="StudioTour" component={Tour} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
    <Still id="Thumbnail" component={Thumbnail} width={1920} height={1080} />
  </>
);
