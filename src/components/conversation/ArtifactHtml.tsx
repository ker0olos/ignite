import { useDraftFrame } from "@/hooks/useDraftFrame";
import { useEmbeddedPage } from "@/hooks/useEmbeddedPage";
import { frameHeight } from "@/lib/artifact";
import { DRAFT_SHELL } from "@/lib/artifactDraft";
import type { Library } from "@/lib/artifactStyles";
import { cn } from "@/lib/utils";

/** An artifact's HTML page, in a frame that may run scripts but can't reach the app or the network. */
export function ArtifactHtml({
  title,
  html,
  libraries,
  height,
  fill,
  draft,
}: {
  title: string;
  html: string;
  libraries: Library[];
  height?: unknown;
  /** Fills its parent's height instead of taking `height`. */
  fill?: boolean;
  /** Still being written: updated in place rather than reloaded. */
  draft?: boolean;
}) {
  const page = useEmbeddedPage(html, libraries);
  const [frameRef, onLoad] = useDraftFrame(draft ? page : undefined);
  const style = fill ? undefined : { height: frameHeight(height) };
  const className = cn("w-full rounded-lg border", fill && "h-full");
  if (page === undefined && !draft)
    return <div data-artifact-loading style={style} className={className} />;
  return (
    <iframe
      ref={frameRef}
      onLoad={onLoad}
      title={title}
      srcDoc={draft ? DRAFT_SHELL : page}
      sandbox="allow-scripts"
      style={style}
      className={className}
    />
  );
}
