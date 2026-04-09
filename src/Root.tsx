import "./index.css";
import { Composition } from "remotion";
import { VideoGameTowers, FRAMES_PAUSE, FRAMES_TRAVEL } from "./VideoGameTowers";

// 20 pauses + 19 travels + 90-frame final hold
const TOTAL_FRAMES = 20 * FRAMES_PAUSE + 19 * FRAMES_TRAVEL + 90; // 1836

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VideoGameRankings"
      component={VideoGameTowers}
      durationInFrames={TOTAL_FRAMES}
      fps={60}
      width={1080}
      height={1920}
    />
  );
};
