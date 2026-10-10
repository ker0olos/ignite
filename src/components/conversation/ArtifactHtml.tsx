import { useMemo } from "react";
import { embeddedPage, frameHeight } from "@/lib/artifact";

/** An artifact's HTML page, in a frame that may run scripts but can't reach the app or the network. */
export function ArtifactHtml({
  title,
  html,
  height,
}: {
  title: string;
  html: string;
  height: unknown;
}) {
  const page = useMemo(() => embeddedPage(html), [html]);
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
