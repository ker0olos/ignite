import { toPng } from "html-to-image";
import htmlToImage from "html-to-image/dist/html-to-image.js?raw";
import type { ImageContent } from "../../shared/agentTypes";
import { pngImage } from "@/lib/markup";

const CAPTURE = "ignite-capture";

// The frame is sandboxed off the app's origin, so it draws itself and posts the PNG back.
const LISTENER = `addEventListener("message", (e) => {
  if (e.source !== parent || e.data?.type !== "${CAPTURE}") return;
  const reply = (r) => parent.postMessage({ type: "${CAPTURE}", id: e.data.id, ...r }, "*");
  htmlToImage.toPng(document.documentElement, { pixelRatio: 2, backgroundColor: "white" })
    .then((url) => reply({ url }), (err) => reply({ error: String(err) }));
});`;

/** The scripts that let an HTML page answer `captureFrame`. */
export const CAPTURE_SCRIPTS = `<script>${htmlToImage}</script><script>${LISTENER}</script>`;

/** An HTML page's frame drawn as a PNG, by the page itself. */
export function captureFrame(
  frame: HTMLIFrameElement,
  timeout = 10000,
): Promise<ImageContent> {
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
    frame.contentWindow.postMessage({ type: CAPTURE, id }, "*");
  });
}

/** An artifact page as a PNG: its frame's page, else its whole markdown, not just what's scrolled into view. */
export async function capturePage(page: HTMLElement): Promise<ImageContent> {
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
