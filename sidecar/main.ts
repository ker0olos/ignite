/**
 * The pi host sidecar's entry. The app starts it with `node sidecar/main.ts`
 * (Node runs the TypeScript directly). It turns on mods/ overrides before
 * loading anything they could replace, so this file itself can't be modded.
 */
import { overlayFromEnv } from "../shared/modsOverlay.ts";

const overlay = overlayFromEnv(new URL("..", import.meta.url).pathname);
if (overlay) (await import("./modsHooks.ts")).registerModsHooks(overlay);
await import("./start.ts");
