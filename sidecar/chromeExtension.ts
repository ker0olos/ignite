/**
 * Chrome tools: list tabs, screenshot, run JS, navigate, and raw CDP calls,
 * on the user's own Chrome or, when it doesn't allow debugging, one the app
 * starts (`chrome.ts`).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { chrome, pages, withTab, type Tab } from "./chrome.ts";
import { chromeToolsOn } from "./chromeSettings.ts";

const TabParam = Type.Optional(
  Type.String({
    description:
      "Tab id from chrome_tabs, or part of its title or URL. Default: the active tab.",
  }),
);

// Keeps a full page within models' 8000px image limit at 2x.
// ponytail: taller pages are cut off; scroll and shoot again, or tile them if it matters.
const MAX_FULL_HEIGHT = 4000;

const text = (value: string) => ({
  content: [{ type: "text" as const, text: value }],
  details: undefined,
});

const show = (value: unknown) =>
  typeof value === "string"
    ? value
    : (JSON.stringify(value, null, 2) ?? "undefined");

async function evaluate(
  cdp: Awaited<ReturnType<typeof chrome>>,
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

async function settle(
  cdp: Awaited<ReturnType<typeof chrome>>,
  sessionId: string,
) {
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const state = await evaluate(cdp, sessionId, "document.readyState").catch(
      () => null,
    );
    if (state === "complete") return;
  }
}

export default function chromeTools(pi: ExtensionAPI) {
  registerLooking(pi);
  registerActing(pi);
  // Read before each run, so a switch in Settings applies to the next message.
  pi.on("before_agent_start", async () => {
    const on = await chromeToolsOn();
    const others = pi.getActiveTools().filter((n) => !n.startsWith("chrome_"));
    pi.setActiveTools([...others, ...on]);
  });
}

function registerLooking(pi: ExtensionAPI) {
  pi.registerTool({
    name: "chrome_tabs",
    label: "Chrome tabs",
    description: "List the open Chrome tabs: id, title and URL.",
    promptSnippet:
      "chrome_tabs / chrome_screenshot / chrome_eval / chrome_navigate / chrome_cdp: drive Chrome",
    promptGuidelines: [
      "The chrome_* tools usually drive the user's own Chrome: their logins, sessions and data. Touch only the tab the task needs, close nothing, and ask before submitting forms, buying, sending or deleting anything.",
      "Look at a chrome_screenshot before saying a page looks right.",
    ],
    parameters: Type.Object({}),
    async execute() {
      const cdp = await chrome();
      const { targetInfos } = await cdp.send<{ targetInfos: Tab[] }>(
        "Target.getTargets",
      );
      const whose = cdp.own
        ? "A separate Chrome the app started (the user's own Chrome doesn't allow remote debugging)."
        : "The user's own Chrome.";
      const lines = pages(targetInfos).map(
        (t) => `${t.targetId}  ${t.title}  ${t.url}`,
      );
      return text([whose, ...lines].join("\n"));
    },
  });

  pi.registerTool({
    name: "chrome_screenshot",
    label: "Chrome screenshot",
    description:
      "Take a screenshot of a Chrome tab: the viewport, or the whole page.",
    parameters: Type.Object({
      tab: TabParam,
      full: Type.Optional(
        Type.Boolean({ description: "The whole page, not just the viewport." }),
      ),
    }),
    async execute(_id, { tab, full }) {
      return withTab(tab, async (cdp, sessionId, t) => {
        const params: Record<string, unknown> = { format: "jpeg", quality: 80 };
        if (full) {
          const { cssContentSize } = await cdp.send<{
            cssContentSize: { width: number; height: number };
          }>("Page.getLayoutMetrics", {}, sessionId);
          const height = Math.min(cssContentSize.height, MAX_FULL_HEIGHT);
          params.captureBeyondViewport = true;
          params.clip = {
            x: 0,
            y: 0,
            width: cssContentSize.width,
            height,
            scale: 1,
          };
        }
        const { data } = await cdp.send<{ data: string }>(
          "Page.captureScreenshot",
          params,
          sessionId,
        );
        return {
          content: [
            { type: "text", text: `${t.title}  ${t.url}` },
            { type: "image", data, mimeType: "image/jpeg" },
          ],
          details: undefined,
        };
      });
    },
  });

  pi.registerTool({
    name: "chrome_eval",
    label: "Chrome JavaScript",
    description:
      "Run JavaScript in a Chrome tab as a user gesture, awaiting promises; returns the result as JSON. " +
      "Use it to read the page and to click or type: controlled inputs (React) need " +
      'an "input" event with bubbles: true after setting .value.',
    parameters: Type.Object({
      expression: Type.String({ description: "The JavaScript to run." }),
      tab: TabParam,
    }),
    async execute(_id, { expression, tab }) {
      return withTab(tab, async (cdp, sessionId) =>
        text(show(await evaluate(cdp, sessionId, expression))),
      );
    },
  });
}

function registerActing(pi: ExtensionAPI) {
  pi.registerTool({
    name: "chrome_navigate",
    label: "Chrome navigate",
    description:
      "Load a URL and wait for it: in a new tab, or in an existing one (which the user may be looking at).",
    parameters: Type.Object({
      url: Type.String(),
      tab: TabParam,
      new_tab: Type.Optional(
        Type.Boolean({ description: "Open it in a new tab instead." }),
      ),
    }),
    async execute(_id, { url, tab, new_tab }) {
      if (new_tab) {
        const cdp = await chrome();
        const { targetId } = await cdp.send<{ targetId: string }>(
          "Target.createTarget",
          { url },
        );
        return withTab(targetId, async (c, sessionId) => {
          await settle(c, sessionId);
          return text(`Opened ${url} in tab ${targetId}`);
        });
      }
      return withTab(tab, async (cdp, sessionId, t) => {
        const { errorText } = await cdp.send<{ errorText?: string }>(
          "Page.navigate",
          { url },
          sessionId,
        );
        if (errorText) throw new Error(errorText);
        await settle(cdp, sessionId);
        return text(`Loaded ${url} in tab ${t.targetId}`);
      });
    },
  });

  pi.registerTool({
    name: "chrome_cdp",
    label: "Chrome DevTools call",
    description:
      "Any Chrome DevTools Protocol method, for what the other chrome tools can't do " +
      "(Input.dispatchMouseEvent, Emulation.setDeviceMetricsOverride, Network.*…). " +
      "Runs in a tab, or on the browser with browser: true (Target.*, Browser.*).",
    parameters: Type.Object({
      method: Type.String({ description: 'e.g. "Input.dispatchKeyEvent".' }),
      params: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      tab: TabParam,
      browser: Type.Optional(Type.Boolean()),
    }),
    async execute(_id, { method, params, tab, browser }) {
      if (browser)
        return text(show(await (await chrome()).send(method, params)));
      return withTab(tab, async (cdp, sessionId) =>
        text(show(await cdp.send(method, params, sessionId))),
      );
    },
  });
}
