import { IMAGE_TOOL, type ImageContent } from "../../../shared/agentTypes";
import { ZoomableImage } from "@/components/app/ZoomableImage";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { cn } from "@/lib/utils";

/** Images a tool call returned or showed the user, under any text it returned with them. */
export function ToolImages({
  images,
  text,
  tool,
}: {
  images: ImageContent[];
  text: string;
  tool: string;
}) {
  // show_image's and read's text only acknowledge the image.
  const caption = tool === IMAGE_TOOL || tool === "read" ? "" : text;
  // An image the agent read is a thumbnail; a click opens it whole.
  const small = tool === "read";
  return (
    <>
      {caption && <OutputPreview text={caption} />}
      <div className="flex flex-wrap gap-2 pt-1">
        {images.map((image, i) => (
          <ZoomableImage
            key={i}
            image={image}
            className={cn(
              "max-w-full rounded-lg border object-contain",
              small ? "max-h-32" : "max-h-96",
              // An SVG has no size of its own, so it gets a height.
              image.mimeType === "image/svg+xml" &&
                (small ? "h-32 w-auto" : "h-80 w-auto"),
            )}
          />
        ))}
      </div>
    </>
  );
}
