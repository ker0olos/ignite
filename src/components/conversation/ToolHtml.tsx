import { embeddedPage, frameHeight } from "@/lib/htmlEmbed";

/** show_html's page, in a frame that may run scripts but can't reach the app or the network. */
export function ToolHtml({ args }: { args: Record<string, unknown> }) {
  return (
    <iframe
      title={String(args.title ?? "")}
      srcDoc={embeddedPage(String(args.html ?? ""))}
      sandbox="allow-scripts"
      style={{ height: frameHeight(args.height) }}
      // A page with no background of its own draws on white, as in a browser.
      className="mt-1 w-full rounded-lg border bg-white"
    />
  );
}
