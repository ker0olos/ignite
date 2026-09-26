import { emit } from "@tauri-apps/api/event";

/** Absolute path the fake store reports in change events, like the real plugin. */
export const STORE_PATH = "/app-data/state.json";

/**
 * Handles the store and dialog plugin commands, for passing to fakeFs as
 * `extra`. Like the real store plugin, every `set` is broadcast to all
 * windows as a `store://change` event.
 *
 * `dialogResult` is what the folder picker returns (null means cancelled).
 */
export function fakeStore(
  initial: Record<string, unknown> = {},
  dialogResult: string | null = null,
) {
  const data = new Map(Object.entries(initial));
  const sets: [string, unknown][] = [];

  function handle(cmd: string, args: unknown) {
    const { key, value } = (args ?? {}) as { key: string; value: unknown };
    switch (cmd) {
      case "plugin:store|load":
        return 1;
      case "plugin:store|get":
        return [data.get(key) ?? null, data.has(key)];
      case "plugin:store|set":
        data.set(key, value);
        sets.push([key, value]);
        void emit("store://change", { path: STORE_PATH, key, value });
        return null;
      case "plugin:dialog|open":
        return dialogResult;
      default:
        throw new Error(`unmocked command: ${cmd}`);
    }
  }

  return { handle, data, sets };
}
