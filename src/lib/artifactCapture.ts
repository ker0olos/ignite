import { toPng } from "html-to-image";
import htmlToImage from "html-to-image/dist/html-to-image.js?raw";
import type { ImageContent } from "../../shared/agentTypes";
import { googleFontCss } from "@/lib/artifactFonts";
import { pngImage } from "@/lib/markup";

const CAPTURE = "ignite-capture";

// The frame draws itself (it's sandboxed off the app's origin); Google Fonts come from captureFrame.
const LISTENER = `addEventListener("message", (e) => {
  if (e.source !== parent || e.data?.type !== "${CAPTURE}") return;
  const reply = (r) => parent.postMessage({ type: "${CAPTURE}", id: e.data.id, ...r }, "*");
  const own = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
    .filter((r) => r instanceof CSSFontFaceRule).map((r) => r.cssText);
  const fontEmbedCSS = [e.data.fonts, ...own].join("\\n");
  htmlToImage.toPng(document.documentElement, { pixelRatio: 2, backgroundColor: "white", fontEmbedCSS })
    .then((url) => reply({ url }), (err) => reply({ error: String(err) }));
});`;

/** The scripts that let an HTML page answer `captureFrame`. */
export const CAPTURE_SCRIPTS = `<script>${htmlToImage}</script><script>${LISTENER}</script>`;

/** An HTML page's frame drawn as a PNG, by the page itself. */
export async function captureFrame(
  frame: HTMLIFrameElement,
  timeout = 10000,
): Promise<ImageContent> {
  const fonts = await googleFontCss(frame.srcdoc);
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      removeEventListener("message", onMessage);
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error("The page didn't draw itself in time."));
    }, timeout);
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; id?: string; url?: string };
      if (e.source !== frame.contentWindow || data?.id !== id) return;
      done();
      if (data.url) resolve(pngImage(data.url));
      else reject(new Error((e.data as { error?: string }).error));
    }
    if (!frame.contentWindow) {
      done();
      reject(new Error("The page isn't loaded."));
      return;
    }
    addEventListener("message", onMessage);
    frame.contentWindow.postMessage({ type: CAPTURE, id, fonts }, "*");
  });
}

/** An artifact page as a PNG: its frame's page, else its whole markdown, not just what's scrolled into view. */
export async function capturePage(page: HTMLElement): Promise<ImageContent> {
  if (page.querySelector("[data-artifact-loading]"))
    throw new Error("The page is still loading.");
  const frame = page.querySelector("iframe");
  if (frame) return captureFrame(frame);
  const content =
    page.querySelector<HTMLElement>("[data-artifact-content]") ?? page;
  // The token, not the body's color: under Liquid Glass the body is transparent.
  const backgroundColor = getComputedStyle(page)
    .getPropertyValue("--background")
    .trim();
  return pngImage(
    await toPng(content, {
      pixelRatio: 2,
      backgroundColor: backgroundColor || "white",
    }),
  );
}
