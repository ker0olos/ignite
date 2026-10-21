import { ArgPath } from "@/components/conversation/ArgPath";
import { CopyButton } from "@/components/conversation/CopyButton";
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
      <div className="space-y-2">
        <span className="block text-muted-foreground">
          {editOf ? "Edit instruction" : "Prompt"}
        </span>
        <div className="group relative rounded-md border bg-muted/40 py-2 pr-10 pl-3">
          <p>{prompt}</p>
          <div className="absolute top-1 right-1 rounded-md bg-background opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <CopyButton text={() => prompt} />
          </div>
        </div>
      </div>
      {avoid && <p className="text-muted-foreground">Avoid: {avoid}</p>}
      <p className="text-muted-foreground">
        <ArgPath text={path} folder={folder} />
        {size && ` · ${size}`}
      </p>
    </>
  );
}
