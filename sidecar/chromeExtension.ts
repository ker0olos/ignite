/**
 * Chrome tools: list tabs, screenshot, run JS, navigate, and raw CDP calls,
 * on a headless Chrome the app starts or, when asked, the user's own (`chrome.ts`).
 */
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { IMAGE_TOOL } from "../shared/agentTypes.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { chrome, pages, withTab, type Tab } from "./chrome.ts";
import { capture, evaluate, settle } from "./chromePage.ts";
import { chromeToolsOn } from "./chromeSettings.ts";
import {
  NO_BROWSER_CALLS,
  NO_OWN_BROWSER_CALLS,
  NO_USER_IN_TASK,
  scopeOf,
  type Scope,
} from "./taskTabs.ts";

const TabParam = Type.Optional(
  Type.String({
    description:
      "Tab id from chrome_tabs, or part of its title or URL. Default: the active tab.",
  }),
);

const UserParam = Type.Optional(
  Type.Boolean({
    description:
      "Use the user's own Chrome, with their logins, instead of the app's headless one. Its tab ids differ.",
  }),
);

const text = (value: string) => ({
  content: [{ type: "text" as const, text: value }],
  details: undefined,
});

const show = (value: unknown) =>
  typeof value === "string"
    ? value
    : (JSON.stringify(value, null, 2) ?? "undefined");

export default function chromeTools(pi: ExtensionAPI) {
  const scope = scopeOf(pi);
  registerLooking(pi, scope);
  registerActing(pi, scope);
  // Read before each run, so a switch in Settings applies to the next message.
  pi.on("before_agent_start", async () => {
    const on = await chromeToolsOn();
    const others = pi.getActiveTools().filter((n) => !n.startsWith("chrome_"));
    pi.setActiveTools([...others, ...on]);
  });
}

function registerLooking(pi: ExtensionAPI, scope: Scope) {
  pi.registerTool({
    name: "chrome_tabs",
    label: "Chrome tabs",
    description: "List the open Chrome tabs: id, title and URL.",
    promptSnippet:
      "chrome_tabs / chrome_screenshot / chrome_eval / chrome_navigate / chrome_cdp: drive Chrome",
    promptGuidelines: [
      "The chrome_* tools drive a headless Chrome the app started, with its own profile. Use it for testing and browsing.",
      "Only when a page needs a login you can't complete there yourself, pass user_chrome: true to use the user's own Chrome: their logins, sessions and data (Chrome may ask them to allow it). There, touch only the tab the task needs, close nothing, and ask before submitting forms, buying, sending or deleting anything.",
      "Look at a chrome_screenshot before saying a page looks right.",
    ],
    parameters: Type.Object({ user_chrome: UserParam }),
    async execute(_id, { user_chrome }) {
      const task = await scope.task();
      if (task && user_chrome) throw new Error(NO_USER_IN_TASK);
      const cdp = await chrome(!!user_chrome);
      const { targetInfos } = await cdp.send<{ targetInfos: Tab[] }>(
        "Target.getTargets",
      );
      const whose = task
        ? "This task's own tabs, in the app's headless Chrome."
        : cdp.own
          ? "The app's headless Chrome."
          : "The user's own Chrome.";
      const lines = pages(targetInfos)
        .filter((t) => scope.shows(task, t.targetId))
        .map((t) => `${t.targetId}  ${t.title}  ${t.url}`);
      return text([whose, ...lines].join("\n"));
    },
  });

  pi.registerTool({
    name: "chrome_screenshot",
    label: "Chrome screenshot",
    description: `Take a screenshot of a Chrome tab: the viewport, or the whole page. It's also saved to a file, to show the user with ${IMAGE_TOOL}.`,
    parameters: Type.Object({
      tab: TabParam,
      full: Type.Optional(
        Type.Boolean({ description: "The whole page, not just the viewport." }),
      ),
      user_chrome: UserParam,
    }),
    async execute(id, { tab, full, user_chrome }) {
      const at = await scope.at(tab, user_chrome);
      const { data, title } = await withTab(
        at.tab,
        async (cdp, sessionId, t) => ({
          data: await capture(cdp, sessionId, full),
          title: `${t.title}  ${t.url}`,
        }),
        at.user,
        at.skip,
      );
      const file = join(tmpdir(), `${APP_NAME}-screenshot-${id}.jpg`);
      await writeFile(file, Buffer.from(data, "base64"));
      return {
        content: [
          { type: "text", text: `${title}\nSaved to ${file}` },
          { type: "image", data, mimeType: "image/jpeg" },
        ],
        details: undefined,
      };
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
      user_chrome: UserParam,
    }),
    async execute(_id, { expression, tab, user_chrome }) {
      const at = await scope.at(tab, user_chrome);
      return withTab(
        at.tab,
        async (cdp, sessionId) =>
          text(show(await evaluate(cdp, sessionId, expression))),
        at.user,
        at.skip,
      );
    },
  });
}

function registerActing(pi: ExtensionAPI, scope: Scope) {
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
      user_chrome: UserParam,
    }),
    async execute(_id, { url, tab, new_tab, user_chrome }) {
      if (new_tab) {
        const task = await scope.task();
        if (task && user_chrome) throw new Error(NO_USER_IN_TASK);
        const user = !!user_chrome;
        const cdp = await chrome(user);
        const { targetId } = await cdp.send<{ targetId: string }>(
          "Target.createTarget",
          { url },
        );
        if (task) scope.claim(targetId);
        return withTab(
          targetId,
          async (c, sessionId) => {
            await settle(c, sessionId);
            return text(`Opened ${url} in tab ${targetId}`);
          },
          user,
        );
      }
      const at = await scope.at(tab, user_chrome);
      return withTab(
        at.tab,
        async (cdp, sessionId, t) => {
          const { errorText } = await cdp.send<{ errorText?: string }>(
            "Page.navigate",
            { url },
            sessionId,
          );
          if (errorText) throw new Error(errorText);
          await settle(cdp, sessionId);
          return text(`Loaded ${url} in tab ${t.targetId}`);
        },
        at.user,
        at.skip,
      );
    },
  });

  pi.registerTool({
    name: "chrome_cdp",
    label: "Chrome DevTools call",
    description:
      "Any Chrome DevTools Protocol method, for what the other chrome tools can't do " +
      "(Input.dispatchMouseEvent, Emulation.setDeviceMetricsOverride, Network.*…). " +
      "Runs in a tab, or on the user's Chrome with browser: true and user_chrome: true (Target.*, Browser.*).",
    parameters: Type.Object({
      method: Type.String({ description: 'e.g. "Input.dispatchKeyEvent".' }),
      params: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      tab: TabParam,
      browser: Type.Optional(Type.Boolean()),
      user_chrome: UserParam,
    }),
    async execute(_id, { method, params, tab, browser, user_chrome }) {
      if (browser) {
        if (await scope.task()) throw new Error(NO_BROWSER_CALLS);
        if (!user_chrome) throw new Error(NO_OWN_BROWSER_CALLS);
        return text(show(await (await chrome(true)).send(method, params)));
      }
      const at = await scope.at(tab, user_chrome);
      return withTab(
        at.tab,
        async (cdp, sessionId) =>
          text(show(await cdp.send(method, params, sessionId))),
        at.user,
        at.skip,
      );
    },
  });
}
