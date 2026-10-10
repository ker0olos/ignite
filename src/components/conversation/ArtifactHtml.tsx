import { useEmbeddedPage } from "@/hooks/useEmbeddedPage";
import { frameHeight } from "@/lib/artifact";
import type { Library } from "@/lib/artifactStyles";

/** An artifact's HTML page, in a frame that may run scripts but can't reach the app or the network. */
export function ArtifactHtml({
  title,
  html,
  libraries,
  height,
}: {
  title: string;
  html: string;
  libraries: Library[];
  height: unknown;
}) {
  const page = useEmbeddedPage(html, libraries);
  if (page === undefined)
    return (
      <div
        data-artifact-loading
        style={{ height: frameHeight(height) }}
        className="w-full rounded-lg border bg-white"
      />
    );
  return (
    <iframe
      title={title}
      srcDoc={page}
      sandbox="allow-scripts"
      style={{ height: frameHeight(height) }}
      // A page with no background of its own draws on white, as in a browser.
      className="w-full rounded-lg border bg-white"
    />
  );
}
