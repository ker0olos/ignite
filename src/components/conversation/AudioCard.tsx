import { Mic, Music } from "lucide-react";
import { audioTitle, resultAudio, type AudioGeneration } from "@/lib/media";
import type { ToolCall } from "../../../shared/agentTypes";
import { AudioPlayer } from "@/components/conversation/AudioPlayer";
import { AudioPrompt } from "@/components/conversation/AudioPrompt";
import { MediaHeader } from "@/components/conversation/MediaHeader";
import { relativeTo } from "@/lib/paths";
import type { ToolRun } from "@/lib/transcript";

/** A generated clip with the model and prompt that made it; only the header until it arrives. */
export function AudioCard({
  call,
  generation,
  run,
  folder,
}: {
  call: ToolCall;
  generation: AudioGeneration;
  run: ToolRun | undefined;
  folder: string;
}) {
  const audio = resultAudio(run?.result);
  const { model, voice, script } = generation;
  const speech = !!(script || voice);
  return (
    <div className="overflow-hidden rounded-lg border bg-card text-[13px] text-foreground">
      <MediaHeader
        icon={speech ? Mic : Music}
        title={audioTitle(generation)}
        model={model}
        note={voice && `voice ${voice}`}
        divided={!!audio}
      />
      {audio && (
        <>
          <AudioPlayer audio={audio} />
          <AudioPrompt
            generation={generation}
            path={relativeTo(String(call.arguments.path ?? ""), folder)}
            folder={folder}
          />
        </>
      )}
    </div>
  );
}
