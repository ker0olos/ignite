/** The Chrome tools, each switchable in Settings (`[chrome] disabled_tools`). */
export const CHROME_TOOLS = [
  {
    name: "chrome_tabs",
    label: "List tabs",
    description: "See the open tabs' titles and URLs.",
  },
  {
    name: "chrome_screenshot",
    label: "Screenshots",
    description: "Look at a tab to check how a page looks.",
  },
  {
    name: "chrome_eval",
    label: "Run JavaScript",
    description: "Run code in a tab: read the page, click, fill in forms.",
  },
  {
    name: "chrome_navigate",
    label: "Open pages",
    description: "Go to a URL, reload, or open a new tab.",
  },
  {
    name: "chrome_cdp",
    label: "DevTools calls",
    description:
      "Send any DevTools protocol command, for what the others can't do.",
  },
] as const;
