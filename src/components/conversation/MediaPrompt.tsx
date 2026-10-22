import { ArgPath } from "@/components/conversation/ArgPath";
import { PromptBox } from "@/components/conversation/PromptBox";
import type { Generation } from "@/lib/media";

/** A generated image's prompt with what it avoided, and the file it was saved to and its size. */
export function MediaPrompt({
  generation,
  path,
  folder,
}: {
  generation: Generation;
  path: string;
  folder: string;
}) {
  const { prompt, avoid, size, editOf } = generation;
  return (
    <>
      <PromptBox label={editOf ? "Edit instruction" : "Prompt"} text={prompt} />
      {avoid && <p className="text-muted-foreground">Avoid: {avoid}</p>}
      <p className="text-muted-foreground">
        <ArgPath text={path} folder={folder} />
        {size && ` · ${size}`}
      </p>
    </>
  );
}
