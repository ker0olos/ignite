import { useEmbeddedPage } from "@/hooks/useEmbeddedPage";
import { frameHeight } from "@/lib/artifact";
import type { Library } from "@/lib/artifactStyles";
import { cn } from "@/lib/utils";

/** An artifact's HTML page, in a frame that may run scripts but can't reach the app or the network. */
export function ArtifactHtml({
  title,
  html,
  libraries,
  height,
  fill,
}: {
  title: string;
  html: string;
  libraries: Library[];
  height?: unknown;
  /** Fills its parent's height instead of taking `height`. */
  fill?: boolean;
}) {
  const page = useEmbeddedPage(html, libraries);
  const style = fill ? undefined : { height: frameHeight(height) };
  const className = cn("w-full rounded-lg border bg-white", fill && "h-full");
  if (page === undefined)
    return <div data-artifact-loading style={style} className={className} />;
  return (
    <iframe
      title={title}
      srcDoc={page}
      sandbox="allow-scripts"
      style={style}
      // A page with no background of its own draws on white, as in a browser.
      className={className}
    />
  );
}
