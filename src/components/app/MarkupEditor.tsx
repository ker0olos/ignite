import type Konva from "konva";
import { useEffect, useRef } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import { MarkupStage } from "@/components/app/MarkupStage";
import { MarkupTextInput } from "@/components/app/MarkupTextInput";
import { MarkupToolbar } from "@/components/app/MarkupToolbar";
import { useElementSize } from "@/hooks/useElementSize";
import { useMarkup } from "@/hooks/useMarkup";
import { useMarkupImage } from "@/hooks/useMarkupImage";
import { useMarkupKeys } from "@/hooks/useMarkupKeys";
import { useMarkupView } from "@/hooks/useMarkupView";
import { imageUrl } from "@/lib/images";
import { exportRatio, pngImage, worthKeeping } from "@/lib/markup";

const NO_SIZE = { width: 0, height: 0 };

/**
 * An opened image to zoom into and draw on. Done (`doneLabel`, or ⌘Enter)
 * saves the marks into it, at full size, as a PNG; `onDirty` says whether
 * there's drawing that closing would lose. Shortcuts wait while `paused`.
 * The image fits the space the toolbar leaves; a click beside it `onDismiss`es.
 */
export function MarkupEditor({
  image,
  name,
  doneLabel,
  paused = false,
  onSave,
  onCancel,
  onDirty,
  onDismiss,
}: {
  image: ImageContent;
  name: string;
  doneLabel?: string;
  paused?: boolean;
  onSave: (image: ImageContent) => void;
  onCancel: () => void;
  onDirty: (dirty: boolean) => void;
  onDismiss: () => void;
}) {
  const [area, box] = useElementSize();
  const { image: img, scale: fit } = useMarkupImage(
    imageUrl(image),
    image.mimeType === "image/svg+xml",
    box,
  );
  const markup = useMarkup(
    img ? { width: img.naturalWidth, height: img.naturalHeight } : NO_SIZE,
  );
  const view = useMarkupView(
    img
      ? { width: img.naturalWidth * fit, height: img.naturalHeight * fit }
      : NO_SIZE,
  );
  const layer = useRef<Konva.Layer>(null);

  const dirty = worthKeeping(markup.marks) || !!markup.editing;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const done = () => {
    const drawn = layer.current;
    const stage = drawn?.getStage();
    if (!drawn || !stage || markup.marks.length === 0) return onSave(image);
    // Export the whole image, not the zoomed-in part on screen.
    stage.scale({ x: fit, y: fit });
    stage.position({ x: 0, y: 0 });
    onSave(pngImage(drawn.toDataURL({ pixelRatio: exportRatio(fit) })));
  };

  useMarkupKeys((action) => {
    if (paused) return false;
    if (action !== "done") return view.act(action) || markup.act(action);
    if (doneLabel) done();
    return !!doneLabel;
  });

  return (
    <>
      <div
        ref={area}
        onClick={(e) => e.target === e.currentTarget && onDismiss()}
        className="flex min-h-0 w-full flex-1 items-center justify-center"
      >
        {img && fit > 0 && (
          <div
            aria-label={`Marking up ${name}`}
            className="relative overflow-hidden rounded-lg shadow-2xl"
          >
            <MarkupStage
              image={img}
              fit={fit}
              markup={markup}
              view={view}
              layer={layer}
            />
            {markup.editing && (
              <MarkupTextInput
                key={markup.editing.id}
                mark={markup.editing}
                scale={fit * view.view.scale}
                offset={view.view}
                onType={markup.type}
                onDone={markup.finishText}
              />
            )}
          </div>
        )}
      </div>
      <MarkupToolbar
        markup={markup}
        view={view}
        doneLabel={doneLabel}
        onCancel={onCancel}
        onDone={done}
      />
    </>
  );
}
