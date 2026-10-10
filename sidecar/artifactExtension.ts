/** show_artifact: the agent shows one or more HTML or markdown pages in its tool row, as tabs. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ARTIFACT_TOOL } from "../shared/agentTypes.ts";

type Page = { title: string; html?: string; markdown?: string };

/** Why nothing would show when a page has neither `html` nor `markdown`, else undefined. */
export function emptyPages(pages: Page[]): string | undefined {
  const empty = pages.filter(
    (page) =>
      typeof page.html !== "string" && typeof page.markdown !== "string",
  );
  if (!empty.length) return undefined;
  const names = empty.map((page) => `"${page.title}"`).join(", ");
  return `Nothing shown: ${names} has no \`html\` or \`markdown\`. Give every page one of them.`;
}

export default function showArtifact(pi: ExtensionAPI) {
  pi.registerTool({
    name: ARTIFACT_TOOL,
    label: "Artifact",
    description:
      "Show the user an artifact in the conversation: a mockup, design options, an interactive demo, a chart, a report. " +
      "Give several pages to show alternatives or screens side by side; the user switches between them as tabs. " +
      "Each page is either `markdown` (rendered like your replies) or `html`, a self-contained page " +
      "in a sandboxed frame: scripts on, no access to the app and no network, so nothing loads from a URL. " +
      "Inline all CSS, JS, fonts and images (data: URLs); size HTML pages to fit `height`.",
    promptSnippet: `${ARTIFACT_TOOL}: show HTML or markdown pages (mockups, designs, reports) in the conversation`,
    parameters: Type.Object({
      title: Type.String({ description: "A short name for the artifact." }),
      pages: Type.Array(
        Type.Object({
          title: Type.String({ description: "The page's tab label." }),
          html: Type.Optional(
            Type.String({ description: "The whole page's HTML." }),
          ),
          markdown: Type.Optional(
            Type.String({ description: "The page as markdown." }),
          ),
        }),
        {
          minItems: 1,
          description: "One or more pages, each with `html` or `markdown`.",
        },
      ),
      height: Type.Optional(
        Type.Number({
          description: "HTML frame height in px, 80 to 1200 (default 360).",
        }),
      ),
    }),
    async execute(_id, { pages }) {
      const error = emptyPages(pages);
      if (error) throw new Error(error);
      return {
        content: [{ type: "text", text: "Shown to the user." }],
        details: {},
      };
    },
  });
}
