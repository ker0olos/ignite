/**
 * The conversation `npm run demo` shows first: the agent adding dark mode to
 * the sample project in demo/tempo. Its files are the finished result, so the
 * diffs here match them (checked in demo.test.ts).
 */
import {
  HTML_TOOL,
  IMAGE_TOOL,
  type AgentMessage,
  type AssistantMessage,
  type ToolCall,
  type ToolResultMessage,
} from "../../shared/agentTypes";
import { THEME_PREVIEW } from "./demoHtml";
import { DARK_MOCKUP } from "./demoTaskImages";

export const T = Date.UTC(2026, 8, 27, 9, 30);

export const assistant = (
  content: AssistantMessage["content"],
  last = false,
): AssistantMessage => ({
  role: "assistant",
  content,
  provider: "claude-bridge",
  model: "claude-opus-5-5",
  stopReason: last ? "stop" : "toolUse",
  timestamp: T,
});

export const call = (
  id: string,
  name: string,
  args: Record<string, unknown>,
): ToolCall => ({ type: "toolCall", id, name, arguments: args });

export const result = (
  call: ToolCall,
  text: string,
  details?: unknown,
): ToolResultMessage => ({
  role: "toolResult",
  toolCallId: call.id,
  toolName: call.name,
  content: [{ type: "text", text }],
  details,
  isError: false,
  timestamp: T,
});

const readSettings = call("r1", "read", { path: "src/settings.ts" });
const readStyles = call("r2", "read", { path: "src/styles.css" });
const search = call("r3", "grep", { pattern: "prefers-color-scheme" });
const showDark = call("i1", IMAGE_TOOL, { path: "/tmp/tempo-dark.png" });
const showPreview = call("h1", HTML_TOOL, {
  title: "Tempo theme preview",
  html: THEME_PREVIEW,
  height: 300,
});

export const THEME = `export type Theme = "system" | "light" | "dark";

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
let chosen: Theme = "system";

/** Shows the page in the chosen theme; "system" follows the OS. */
export function applyTheme(theme: Theme) {
  chosen = theme;
  const dark = theme === "dark" || (theme === "system" && systemDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

// Follow the OS live while the choice is "system".
systemDark.addEventListener("change", () => applyTheme(chosen));
`;

const writeTheme = call("w1", "write", {
  path: "src/theme.ts",
  content: THEME,
});
const editSettings = call("e1", "edit", { path: "src/settings.ts" });
const editStyles = call("e2", "edit", { path: "src/styles.css" });
const editHtml = call("e3", "edit", { path: "index.html" });
const runTests = call("b1", "bash", { command: "npm test" });

/** Edit diffs in pi's format: `+N added`, `-N removed`, ` N context`. */
export const DEMO_DIFFS: Record<string, string> = {
  "src/settings.ts": [
    '+ 1 import { applyTheme, type Theme } from "./theme";',
    '  2 import { setDurations } from "./timer";',
    "    ...",
    "  7   sound: boolean;",
    "+ 8   theme: Theme;",
    "  9 };",
    "    ...",
    " 14   sound: true,",
    '+15   theme: "system",',
    " 16 };",
    "    ...",
    " 29   setDurations(settings.focusMinutes, settings.breakMinutes);",
    "+30   applyTheme(settings.theme);",
    " 31 }",
  ].join("\n"),
  "src/styles.css": [
    "+ 1 :root {",
    "+ 2   --bg: #fbfaf7;",
    "+ 3   --text: #1f1d1a;",
    "+ 4   --muted: #7a756c;",
    "+ 5   --accent: #e0643b;",
    "+ 6 }",
    "+ 7 ",
    '+ 8 :root[data-theme="dark"] {',
    "+ 9   --bg: #161514;",
    "+10   --text: #f2efe9;",
    "+11   --muted: #9c968c;",
    "+12   --accent: #f07a52;",
    "+13 }",
    "+14 ",
    " 15 body {",
    " 16   margin: 0;",
    " 17   font-family: system-ui, sans-serif;",
    "- 4   background: #fbfaf7;",
    "- 5   color: #1f1d1a;",
    "+18   background: var(--bg);",
    "+19   color: var(--text);",
    " 20 }",
    "    ...",
    " 27 .accent {",
    "-14   color: #e0643b;",
    "+28   color: var(--accent);",
    " 29 }",
  ].join("\n"),
  "index.html": [
    ' 16       <label>Sound <input name="sound" type="checkbox" /></label>',
    "+17       <label>",
    "+18         Theme",
    '+19         <select name="theme">',
    '+20           <option value="system">Match system</option>',
    '+21           <option value="light">Light</option>',
    '+22           <option value="dark">Dark</option>',
    "+23         </select>",
    "+24       </label>",
    " 25     </dialog>",
  ].join("\n"),
};

const edited = (edit: ToolCall) => {
  const path = String(edit.arguments.path);
  return result(edit, `Updated ${path}`, { diff: DEMO_DIFFS[path] });
};

/** The conversation up to the passing tests, oldest first; demoDarkMode.ts delivers it. */
export const DEMO_WORK: AgentMessage[] = [
  {
    role: "user",
    content:
      "Add a dark mode to Tempo. It should follow the system setting by default, and let people pick Light or Dark in Settings.",
    timestamp: T,
  },
  assistant([
    {
      type: "text",
      text: "I'll look at how settings and styles work first.",
    },
    readSettings,
    readStyles,
    search,
  ]),
  result(readSettings, "export type Settings = {\n  focusMinutes: number;\n…"),
  result(
    readStyles,
    "body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: #fbfaf7;\n  color: #1f1d1a;\n}\n…",
  ),
  result(search, "No matches found"),
  assistant([
    {
      type: "text",
      text: "The colors are hard-coded in the stylesheet, so I'll move them into variables and add a dark set. Then a small theme module, the choice saved with the other settings, and a picker.",
    },
    writeTheme,
    editSettings,
    editStyles,
    editHtml,
  ]),
  result(writeTheme, "Wrote src/theme.ts"),
  edited(editSettings),
  edited(editStyles),
  edited(editHtml),
  assistant([runTests]),
  result(
    runTests,
    " ✓ tests/timer.test.ts (2 tests) 3ms\n\n Test Files  1 passed (1)\n      Tests  2 passed (2)",
  ),
  assistant([
    { type: "text", text: "Here's the Today screen in dark:" },
    showDark,
  ]),
  result(showDark, "Shown to the user.", { image: DARK_MOCKUP }),
  assistant([
    {
      type: "text",
      text: "And a live preview of both palettes, so you can flip between them:",
    },
    showPreview,
  ]),
  result(showPreview, "Shown to the user."),
];
