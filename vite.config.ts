import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
// @ts-expect-error type error without @types/node package
import { fileURLToPath } from "node:url";
import { overlayFromEnv } from "./shared/modsOverlay.ts";
import { modsVitePlugin } from "./shared/modsVitePlugin.ts";
const host = process.env.TAURI_DEV_HOST;
const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const root = path(".");
const overlay = overlayFromEnv(root);

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [overlay && modsVitePlugin(overlay), react(), tailwindcss()],
  resolve: {
    alias: { "@": path("./src") },
  },
  // ponytail: the app runs from source, so the sidecar is started from this
  // checkout; a built app would bundle it and resolve it from resources instead
  define: {
    // Forward slashes on Windows too, so one capability validator fits both.
    __PI_HOST_PATH__: JSON.stringify(
      path("./sidecar/main.ts").replaceAll("\\", "/"),
    ),
    // `npm run demo` opens the sample project with a fixed conversation.
    __DEMO_FOLDER__: JSON.stringify(
      process.env.IGNITE_DEMO ? path("./demo/tempo") : null,
    ),
    __HEALTH_FILE__: JSON.stringify(process.env.IGNITE_HEALTH_FILE || null),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    // Shows the app's warnings and errors, including the sidecar's log, in the
    // terminal; Vite only does this by default when an AI agent runs it.
    forwardConsole: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    fs: {
      allow: [searchForWorkspaceRoot(root), ...(overlay ? [overlay.mods] : [])],
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
