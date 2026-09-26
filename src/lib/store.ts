import { listen } from "@tauri-apps/api/event";
import { load } from "@tauri-apps/plugin-store";

const FILE = "state.json";

/** App-wide persisted state, shared by every window. */
export const store = load(FILE);

export type StoreKey = "folders" | "current" | "theme";

// Store's own onKeyChange filters by a per-webview resource id, so it misses other windows.
export function onStoreChange(cb: (key: StoreKey, value: unknown) => void) {
  return listen<{ path: string; key: StoreKey; value: unknown }>(
    "store://change",
    ({ payload }) => {
      if (payload.path.endsWith(FILE)) cb(payload.key, payload.value);
    },
  );
}
