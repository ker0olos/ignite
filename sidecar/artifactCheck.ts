/** Loads show_artifact's HTML pages in the app's headless Chrome first, so a page that throws never reaches the user. */
import { ARTIFACT_CSP } from "../shared/agentTypes.ts";
import { chrome, hiddenContexts, type Cdp } from "./chrome.ts";
import { evaluate, settle } from "./chromePage.ts";
import { chromeToolsOn } from "./chromeSettings.ts";

// One line, so the page's own line numbers stay as written. The frame has no
// allow-modals, so dialogs do nothing there; here they would block the page.
const CATCH = `<script>window.__artifactErrors=[];alert=confirm=prompt=print=()=>{};addEventListener("error",(e)=>__artifactErrors.push(e.message+(e.lineno?" (line "+e.lineno+")":"")));addEventListener("unhandledrejection",(e)=>__artifactErrors.push("Unhandled rejection: "+e.reason));addEventListener("securitypolicyviolation",(e)=>__artifactErrors.push("Blocked by the frame's policy: "+(e.blockedURI||"inline")+" ("+e.effectiveDirective+")"));</script>`;

// A page that loops forever would otherwise hold the tool call.
const TIMEOUT_MS = 20_000;

/** The page as the check loads it: the frame's policy and an error log before anything of its own. */
export function checkedPage(html: string): string {
  return html.replace(
    /^\s*(<!doctype[^>]*>)?/i,
    (doctype) => doctype + ARTIFACT_CSP + CATCH,
  );
}

async function load(cdp: Cdp, browserContextId: string, html: string) {
  const { targetId } = await cdp.send<{ targetId: string }>(
    "Target.createTarget",
    { url: "about:blank", browserContextId },
  );
  const { sessionId } = await cdp.send<{ sessionId: string }>(
    "Target.attachToTarget",
    { targetId, flatten: true },
  );
  const { frameTree } = await cdp.send<{
    frameTree: { frame: { id: string } };
  }>("Page.getFrameTree", {}, sessionId);
  // Set rather than navigated to: a data: URL stops at 2MB.
  await cdp.send(
    "Page.setDocumentContent",
    { frameId: frameTree.frame.id, html: checkedPage(html) },
    sessionId,
  );
  await settle(cdp, sessionId);
  return (await evaluate(cdp, sessionId, "__artifactErrors")) as string[];
}

/** The errors `html` throws or the policy blocks as it loads; none when Chrome is off or can't check it. */
export async function pageErrors(html: string): Promise<string[]> {
  if (!(await chromeToolsOn()).length) return [];
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<string[]>((resolve) => {
    timer = setTimeout(() => resolve([]), TIMEOUT_MS);
  });
  try {
    const cdp = await chrome();
    const { browserContextId } = await cdp.send<{ browserContextId: string }>(
      "Target.createBrowserContext",
    );
    hiddenContexts.add(browserContextId);
    try {
      return await Promise.race([load(cdp, browserContextId, html), timeout]);
    } finally {
      // Closes its tab too, even one still stuck in the page's script.
      await cdp
        .send("Target.disposeBrowserContext", { browserContextId })
        .catch(() => {});
      hiddenContexts.delete(browserContextId);
    }
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
