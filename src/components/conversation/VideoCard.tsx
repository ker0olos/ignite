import { Clapperboard } from "lucide-react";
import type { ToolCall } from "../../../shared/agentTypes";
import { MediaHeader } from "@/components/conversation/MediaHeader";
import { VideoPrompt } from "@/components/conversation/VideoPrompt";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { resultVideo, type VideoGeneration } from "@/lib/media";
import { basename, relativeTo } from "@/lib/paths";
import type { ToolRun } from "@/lib/transcript";

/** A video, with the model and prompt that made it when the agent says; only the header until it arrives. */
export function VideoCard({
  call,
  generation,
  run,
  folder,
}: {
  call: ToolCall;
  generation: VideoGeneration;
  run: ToolRun | undefined;
  folder: string;
}) {
  const video = resultVideo(run?.result);
  const url = useMediaUrl(video);
  const { model, from } = generation;
  const path = String(call.arguments.path ?? "");
  return (
    <div className="overflow-hidden rounded-lg border bg-card text-[13px] text-foreground">
      <MediaHeader
        icon={Clapperboard}
        title={model ? "Generated video" : "Video"}
        model={model}
        note={from && `from ${basename(from)}`}
        divided={!!video}
      />
      {video && (
        <>
          {url === "missing" ? (
            <p className="border-b px-3 py-2 text-muted-foreground">
              The video file is gone, so it can't play.
            </p>
          ) : (
            <video
              src={url}
              controls
              loop
              playsInline
              preload="metadata"
              className="block aspect-video max-h-[28rem] w-full bg-black object-contain"
            />
          )}
          <VideoPrompt
            generation={generation}
            path={relativeTo(path, folder)}
            folder={folder}
          />
        </>
      )}
    </div>
  );
}
