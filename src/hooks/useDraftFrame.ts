import { useEffect, useState } from "react";
import { DRAFT_MESSAGE } from "@/lib/artifactDraft";

/** Posts each new draft page into its frame once the frame's shell has loaded; returns the frame's ref and onLoad. */
export function useDraftFrame(page: string | undefined) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded && page !== undefined)
      frame?.contentWindow?.postMessage(
        { type: DRAFT_MESSAGE, html: page },
        "*",
      );
  }, [frame, loaded, page]);
  return [setFrame, () => setLoaded(true)] as const;
}
