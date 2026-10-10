import { useState } from "react";
import { PenLine } from "lucide-react";
import type { ImageContent } from "../../../shared/agentTypes";
import { MarkupDialog } from "@/components/app/MarkupDialog";
import { Button } from "@/components/ui/button";
import { useImageTarget } from "@/hooks/useImageTarget";
import { capturePage } from "@/lib/artifactCapture";

/** Captures the shown artifact page and opens it in the markup editor. */
export function ArtifactMarkupButton({
  page,
  name,
}: {
  page: () => HTMLElement | null;
  name: string;
}) {
  const [image, setImage] = useState<ImageContent>();
  const [state, setState] = useState<"idle" | "capturing" | "failed">("idle");
  const target = useImageTarget();
  // Nowhere to send the marked-up page (no composer or task input showing).
  if (!target) return null;
  const capture = () => {
    const element = page();
    if (!element) return;
    setState("capturing");
    capturePage(element)
      .then((shot) => {
        setImage(shot);
        setState("idle");
      })
      .catch(() => setState("failed"));
  };
  return (
    <>
      <Button
        size="xs"
        variant="ghost"
        className="ml-auto text-[13px] text-muted-foreground"
        disabled={state === "capturing"}
        onClick={capture}
      >
        <PenLine />
        {state === "failed" ? "Couldn't capture" : "Mark up"}
      </Button>
      {image && (
        <MarkupDialog
          image={image}
          name={name}
          open
          onOpenChange={(open) => !open && setImage(undefined)}
        />
      )}
    </>
  );
}
