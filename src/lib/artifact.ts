import { CAPTURE_SCRIPTS } from "@/lib/artifactCapture";
import { ARTIFACT_CSP } from "../../shared/agentTypes";
import { artifactLibraries, type Library } from "@/lib/artifactStyles";

/** One page of an artifact: an HTML page (with the libraries it asked for) or markdown, under its tab label. */
export type ArtifactPage = {
  title: string;
} & ({ html: string; libraries: Library[] } | { markdown: string });

/** The message a page sends when Esc is pressed in it. */
export const ESCAPE_MESSAGE = "ignite-escape";

// Keys pressed in the frame never reach the app, so the expanded view couldn't close on Esc.
const ESCAPE_SCRIPT = `<script>addEventListener("keydown", (e) => e.key === "Escape" && parent.postMessage({ type: "${ESCAPE_MESSAGE}" }, "*"));</script>`;

/** An HTML page with the policy, capture scripts and library CSS first, after any doctype so it stays in standards mode. */
export function embeddedPage(html: string, css = ""): string {
  const styles = css && `<style>${css}</style>`;
  return html.replace(
    /^\s*(<!doctype[^>]*>)?/i,
    (doctype) =>
      doctype + ARTIFACT_CSP + CAPTURE_SCRIPTS + ESCAPE_SCRIPT + styles,
  );
}

/** The frame's height in px: the agent's, kept between 80 and 1200, else 360. */
export function frameHeight(height: unknown): number {
  const px = Number(height);
  if (!Number.isFinite(px) || px <= 0) return 360;
  return Math.min(1200, Math.max(80, px));
}

function readPage(page: unknown, i: number): ArtifactPage | undefined {
  if (!page || typeof page !== "object") return undefined;
  const fields = page as Record<string, unknown>;
  const { title, html, markdown } = fields;
  const label = typeof title === "string" && title ? title : `Page ${i + 1}`;
  if (typeof markdown === "string") return { title: label, markdown };
  if (typeof html === "string")
    return { title: label, html, libraries: artifactLibraries(fields) };
  return undefined;
}

/** An artifact call's pages; a show_html call (the tool's earlier form) is one HTML page. */
export function artifactPages(args: Record<string, unknown>): ArtifactPage[] {
  if (!Array.isArray(args.pages)) {
    const page = readPage({ ...args, markdown: undefined }, 0);
    return page ? [page] : [];
  }
  return args.pages.flatMap((page, i) => readPage(page, i) ?? []);
}
