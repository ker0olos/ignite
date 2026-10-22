import { ArgPath } from "@/components/conversation/ArgPath";
import { PromptBox } from "@/components/conversation/PromptBox";
import type { VideoGeneration } from "@/lib/media";

/** A generated video's prompt with what it avoided, and the file it was saved to and its size. */
export function VideoPrompt({
  generation,
  path,
  folder,
}: {
  generation: VideoGeneration;
  path: string;
  folder: string;
}) {
  const { prompt, avoid, size } = generation;
  return (
    <div className="space-y-3 p-3">
      {prompt && <PromptBox label="Prompt" text={prompt} />}
      {avoid && <p className="text-muted-foreground">Avoid: {avoid}</p>}
      <p className="text-muted-foreground">
        <ArgPath text={path} folder={folder} />
        {size && ` · ${size}`}
      </p>
    </div>
  );
}
