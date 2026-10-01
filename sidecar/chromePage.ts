/** CDP calls on an attached tab, for the chrome_* tools. */
import type { Cdp } from "./chrome.ts";

// Keeps a full page within models' 8000px image limit at 2x.
// ponytail: taller pages are cut off; scroll and shoot again, or tile them if it matters.
const MAX_FULL_HEIGHT = 4000;

/** Runs `expression` in the tab as a user gesture; its value, or throws its exception. */
export async function evaluate(
  cdp: Cdp,
  sessionId: string,
  expression: string,
) {
  const { result, exceptionDetails } = await cdp.send<{
    result: { value: unknown };
    exceptionDetails?: { text: string; exception?: { description?: string } };
  }>(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true, userGesture: true },
    sessionId,
  );
  if (exceptionDetails) {
    throw new Error(
      exceptionDetails.exception?.description ?? exceptionDetails.text,
    );
  }
  return result.value;
}

/** Waits up to 10s for the tab's document to finish loading. */
export async function settle(cdp: Cdp, sessionId: string) {
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const state = await evaluate(cdp, sessionId, "document.readyState").catch(
      () => null,
    );
    if (state === "complete") return;
  }
}

/** A JPEG of the tab's viewport, or of the whole page (up to MAX_FULL_HEIGHT). */
export async function capture(cdp: Cdp, sessionId: string, full?: boolean) {
  const params: Record<string, unknown> = { format: "jpeg", quality: 80 };
  if (full) {
    const { cssContentSize } = await cdp.send<{
      cssContentSize: { width: number; height: number };
    }>("Page.getLayoutMetrics", {}, sessionId);
    const height = Math.min(cssContentSize.height, MAX_FULL_HEIGHT);
    params.captureBeyondViewport = true;
    params.clip = { x: 0, y: 0, width: cssContentSize.width, height, scale: 1 };
  }
  const { data } = await cdp.send<{ data: string }>(
    "Page.captureScreenshot",
    params,
    sessionId,
  );
  return data;
}
