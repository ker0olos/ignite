import { CAPTURE_SCRIPTS } from "@/lib/artifactCapture";

/** One page of an artifact: an HTML page or markdown, under its tab label. */
export type ArtifactPage = {
  title: string;
} & ({ html: string } | { markdown: string });

// No network: the page could otherwise send what the agent read past the sandbox's allowed hosts.
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:">`;

/** An HTML page with the policy and capture scripts first, after any doctype so it stays in standards mode. */
export function embeddedPage(html: string): string {
  return html.replace(
    /^\s*(<!doctype[^>]*>)?/i,
    (doctype) => doctype + CSP + CAPTURE_SCRIPTS,
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
  const { title, html, markdown } = page as Record<string, unknown>;
  const label = typeof title === "string" && title ? title : `Page ${i + 1}`;
  if (typeof markdown === "string") return { title: label, markdown };
  if (typeof html === "string") return { title: label, html };
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
