/** show_html: the agent embeds an HTML page in its tool row, drawn in a sandboxed frame. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { HTML_TOOL } from "../shared/agentTypes.ts";

export default function showHtml(pi: ExtensionAPI) {
  pi.registerTool({
    name: HTML_TOOL,
    label: "Show HTML",
    description:
      "Embed a self-contained HTML page in the conversation: a mockup, an interactive demo, a chart, a table. " +
      "It runs in a sandboxed frame: scripts on, no access to the app and no network, so nothing loads from a URL. " +
      "Inline all CSS, JS, fonts and images (data: URLs); size it to fit `height`.",
    promptSnippet: `${HTML_TOOL}: embed an HTML page in the conversation`,
    parameters: Type.Object({
      title: Type.String({ description: "A short name for the page." }),
      html: Type.String({ description: "The whole page's HTML." }),
      height: Type.Optional(
        Type.Number({
          description: "Frame height in px, 80 to 1200 (default 360).",
        }),
      ),
    }),
    async execute() {
      return {
        content: [{ type: "text", text: "Shown to the user." }],
        details: {},
      };
    },
  });
}
