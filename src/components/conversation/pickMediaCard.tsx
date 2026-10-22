import type { ReactNode } from "react";
import {
  AUDIO_TOOL,
  IMAGE_TOOL,
  VIDEO_TOOL,
  type ToolCall,
} from "../../../shared/agentTypes";
import { AudioCard } from "@/components/conversation/AudioCard";
import { MediaCard } from "@/components/conversation/MediaCard";
import { VideoCard } from "@/components/conversation/VideoCard";
import { audioCard, cardGeneration, videoCard } from "@/lib/media";
import type { ToolRun } from "@/lib/transcript";

type Props = { call: ToolCall; run: ToolRun | undefined; folder: string };

const CARDS: Record<string, (props: Props) => ReactNode> = {
  [IMAGE_TOOL]: (props) => {
    const generation = cardGeneration(props.call, props.run);
    return generation && <MediaCard {...props} generation={generation} />;
  },
  [AUDIO_TOOL]: (props) => {
    const generation = audioCard(props.call, props.run);
    return generation && <AudioCard {...props} generation={generation} />;
  },
  [VIDEO_TOOL]: (props) => {
    const generation = videoCard(props.call, props.run);
    return generation && <VideoCard {...props} generation={generation} />;
  },
};

/** The card for a show_image, show_audio or show_video call, or null when it draws the usual row. */
export const pickMediaCard = (props: Props): ReactNode =>
  CARDS[props.call.name]?.(props) || null;
