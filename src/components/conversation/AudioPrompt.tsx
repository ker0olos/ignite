import { ArgPath } from "@/components/conversation/ArgPath";
import { PromptBox } from "@/components/conversation/PromptBox";
import type { AudioGeneration } from "@/lib/media";

/** A generated clip's script and direction (speech) or prompt (music), and the file it was saved to. */
export function AudioPrompt({
  generation,
  path,
  folder,
}: {
  generation: AudioGeneration;
  path: string;
  folder: string;
}) {
  const { script, prompt } = generation;
  return (
    <div className="space-y-3 p-3">
      {script && <PromptBox label="Script" text={script} />}
      {prompt && (
        <PromptBox label={script ? "Direction" : "Prompt"} text={prompt} />
      )}
      <p className="text-muted-foreground">
        <ArgPath text={path} folder={folder} />
      </p>
    </div>
  );
}
