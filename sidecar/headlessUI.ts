import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { HostMessage } from "../shared/hostProtocol.ts";

// Extensions only report problems (a failed MCP sign-in) through a bound UI.
// This one declines every prompt and passes errors on to the app.
export function createHeadlessUI(
  send: (message: HostMessage) => void,
): ExtensionUIContext {
  return {
    select: async () => undefined,
    confirm: async () => false,
    input: async () => undefined,
    notify: (message: string, type?: "info" | "warning" | "error") => {
      process.stderr.write(`pi-host: ${type ?? "info"}: ${message}\n`);
      if (type === "error") send({ type: "extension_error", message });
    },
    onTerminalInput: () => () => {},
    setStatus: () => {},
    setWorkingMessage: () => {},
    setWorkingVisible: () => {},
    setWorkingIndicator: () => {},
    setHiddenThinkingLabel: () => {},
    setWidget: () => {},
    setFooter: () => {},
    setHeader: () => {},
    setTitle: () => {},
    custom: async () => undefined,
    pasteToEditor: () => {},
    setEditorText: () => {},
    getEditorText: () => "",
    editor: async () => undefined,
    addAutocompleteProvider: () => {},
    setEditorComponent: () => {},
    getEditorComponent: () => undefined,
    // Styling helpers (fg, bold, ...) return the text as is; nothing is drawn.
    theme: new Proxy(
      {},
      {
        get:
          () =>
          (...args: unknown[]) =>
            args.at(-1),
      },
    ),
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: () => ({ success: false, error: "No UI" }),
    getToolsExpanded: () => false,
    setToolsExpanded: () => {},
  } as unknown as ExtensionUIContext;
}
