// No network: the page could otherwise send what the agent read past the sandbox's allowed hosts.
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:">`;

/** show_html's page with the policy first, after any doctype so it stays in standards mode. */
export function embeddedPage(html: string): string {
  return html.replace(/^\s*(<!doctype[^>]*>)?/i, (doctype) => doctype + CSP);
}

/** The frame's height in px: the agent's, kept between 80 and 1200, else 360. */
export function frameHeight(height: unknown): number {
  const px = Number(height);
  if (!Number.isFinite(px) || px <= 0) return 360;
  return Math.min(1200, Math.max(80, px));
}
