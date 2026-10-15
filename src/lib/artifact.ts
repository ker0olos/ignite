import { CAPTURE_SCRIPTS } from "@/lib/artifactCapture";
import { parse as parsePartialJson } from "partial-json";
import {
  ARTIFACT_CSP,
  ARTIFACT_TOOL,
  LEGACY_HTML_TOOL,
  type ToolCall,
} from "../../shared/agentTypes";
import { artifactLibraries, type Library } from "@/lib/artifactStyles";
import type { ToolRun } from "@/lib/transcript";

/** One page of an artifact: an HTML page (with the libraries it asked for) or markdown, under its tab label. */
export type ArtifactPage = {
  title: string;
  /** Still being written: its HTML has no scripts yet. */
  draft?: boolean;
} & ({ html: string; libraries: Library[] } | { markdown: string });

/** The message a page sends when Esc is pressed in it. */
export const ESCAPE_MESSAGE = "ignite-escape";

// Keys pressed in the frame never reach the app, so the expanded view couldn't close on Esc.
const ESCAPE_SCRIPT = `<script>addEventListener("keydown", (e) => e.key === "Escape" && parent.postMessage({ type: "${ESCAPE_MESSAGE}" }, "*"));</script>`;

// A page with no background of its own draws on white, as in a browser; the frame itself stays clear,
// since white behind it bleeds through the edges of a dark page. Drafts call it again after each swap.
const BACKDROP_SCRIPT = `<script>function igniteBackdrop() {
  document.getElementById("ignite-backdrop")?.remove();
  const clear = (el) => !el || (getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(el).backgroundImage === "none");
  if (!clear(document.documentElement) || !clear(document.body)) return;
  const style = Object.assign(document.createElement("style"), { id: "ignite-backdrop", textContent: "html{background:#fff}" });
  document.head.prepend(style);
}
addEventListener("DOMContentLoaded", igniteBackdrop);</script>`;

// Before the page's CSS, so its own scrollbar styles win. Gray reads on light and dark pages.
const SCROLLBAR_CSS =
  "::-webkit-scrollbar{width:7px;height:7px;background:transparent}::-webkit-scrollbar-thumb{background:rgb(128 128 128/.4) padding-box;border:2px solid transparent;border-radius:4px}::-webkit-scrollbar-corner{background:transparent}";

/** An HTML page with the policy, capture scripts and library CSS first, after any doctype so it stays in standards mode. */
export function embeddedPage(html: string, css = ""): string {
  const styles = `<style>${SCROLLBAR_CSS}${css}</style>`;
  return html.replace(
    /^\s*(<!doctype[^>]*>)?/i,
    (doctype) =>
      doctype +
      ARTIFACT_CSP +
      CAPTURE_SCRIPTS +
      ESCAPE_SCRIPT +
      BACKDROP_SCRIPT +
      styles,
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

/** A streamed call's arguments so far; partial strings, arrays and objects are cut where the JSON ends. */
export function draftArgs(json: string): Record<string, unknown> {
  try {
    const args: unknown = parsePartialJson(json);
    return args && typeof args === "object"
      ? (args as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** A page still being written, safe to draw: no scripts (they run once it's whole) and no half-written tag at its end. */
export function draftHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?(?:<\/script\s*>|$)/gi, "")
    .replace(/<[^>]*$/, "");
}

const ARTIFACT_TOOLS = new Set([ARTIFACT_TOOL, LEGACY_HTML_TOOL]);

/** The pages an artifact call's row shows: drafts until its check passes; none while it asks, after it failed, or once a stopped run left it unrun. */
export function rowPages(
  { name, args }: { name: string; args: ToolCall["arguments"] },
  run: ToolRun | undefined,
  running: boolean,
): ArtifactPage[] {
  if (
    !ARTIFACT_TOOLS.has(name) ||
    run?.approval ||
    run?.status === "error" ||
    (!run && !running)
  )
    return [];
  const pages = artifactPages(args);
  if (run?.status === "done") return pages;
  return pages.map((page) =>
    "html" in page
      ? { ...page, html: draftHtml(page.html), draft: true }
      : page,
  );
}

/** An artifact call's pages; a show_html call (the tool's earlier form) is one HTML page. */
export function artifactPages(args: Record<string, unknown>): ArtifactPage[] {
  if (!Array.isArray(args.pages)) {
    const page = readPage({ ...args, markdown: undefined }, 0);
    return page ? [page] : [];
  }
  return args.pages.flatMap((page, i) => readPage(page, i) ?? []);
}
