import { embeddedPage } from "@/lib/artifact";

/** The message that carries a draft page into its frame. */
export const DRAFT_MESSAGE = "ignite-draft";

// Runs in the frame: swaps each draft in without a reload (keeping its scroll), never its scripts or event handlers.
// Head nodes are replaced only when they changed, so fonts aren't fetched again.
const RECEIVER = `<script>addEventListener("message", (e) => {
  if (e.source !== parent || e.data?.type !== "${DRAFT_MESSAGE}") return;
  const next = new DOMParser().parseFromString(e.data.html, "text/html");
  next.querySelectorAll("script, meta").forEach((node) => node.remove());
  for (const el of next.querySelectorAll("*"))
    for (const { name } of [...el.attributes])
      if (/^on/i.test(name)) el.removeAttribute(name);
  const head = [...next.head.children];
  head.forEach((node) => node.setAttribute("data-draft", ""));
  const old = [...document.head.querySelectorAll("[data-draft]")];
  const html = (nodes) => nodes.map((node) => node.outerHTML).join("");
  if (html(old) !== html(head)) {
    old.forEach((node) => node.remove());
    document.head.append(...head.map((node) => document.importNode(node, true)));
  }
  const root = document.documentElement;
  for (const { name } of [...root.attributes])
    if (!next.documentElement.hasAttribute(name)) root.removeAttribute(name);
  for (const { name, value } of next.documentElement.attributes)
    root.setAttribute(name, value);
  document.body.replaceWith(document.importNode(next.body, true));
});</script>`;

/** The page a draft's frame loads once; each draft is then posted into it. */
export const DRAFT_SHELL = embeddedPage(
  `<!doctype html><html><head>${RECEIVER}</head><body></body></html>`,
);
