import { useContext, useState } from "react";
import { resultImages, type ToolCall } from "../../../shared/agentTypes";
import { MarkupDialog } from "@/components/app/MarkupDialog";
import { ImageCompare } from "@/components/conversation/ImageCompare";
import { MediaHeader } from "@/components/conversation/MediaHeader";
import { MediaMarkup } from "@/components/conversation/MediaMarkup";
import { MediaPrompt } from "@/components/conversation/MediaPrompt";
import { EditOriginalsContext } from "@/components/conversation/shared";
import { imageUrl } from "@/lib/images";
import type { Generation } from "@/lib/media";
import { basename, relativeTo } from "@/lib/paths";
import type { ToolRun } from "@/lib/transcript";

/** A generated or edited image with the model and prompt that made it; only the header until it arrives. */
export function MediaCard({
  call,
  generation,
  run,
  folder,
}: {
  call: ToolCall;
  generation: Generation;
  run: ToolRun | undefined;
  folder: string;
}) {
  const [open, setOpen] = useState(false);
  const before = useContext(EditOriginalsContext).get(call.id);
  const image = resultImages(run?.result)[0];
  const path = String(call.arguments.path ?? "");
  const name = basename(path);
  return (
    <div className="overflow-hidden rounded-lg border bg-card text-[13px] text-foreground">
      <MediaHeader generation={generation} divided={!!image}>
        {image && <MediaMarkup onClick={() => setOpen(true)} />}
      </MediaHeader>
      {image && (
        <>
          {before ? (
            <ImageCompare before={before} after={image} name={name} wide />
          ) : (
            <button
              type="button"
              aria-label={`Open ${name}`}
              onClick={() => setOpen(true)}
              className="block w-full cursor-zoom-in"
            >
              <img
                src={imageUrl(image)}
                alt={name}
                className="block max-h-[28rem] w-full object-contain"
              />
            </button>
          )}
          <div className="space-y-3 p-3">
            <MediaPrompt
              generation={generation}
              path={relativeTo(path, folder)}
              folder={folder}
            />
          </div>
          <MarkupDialog
            image={image}
            name={name}
            open={open}
            onOpenChange={setOpen}
          />
        </>
      )}
    </div>
  );
}
