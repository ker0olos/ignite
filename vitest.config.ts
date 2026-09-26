import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  test: {
    // Tauri's IPC mocks (@tauri-apps/api/mocks) need a window object.
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
    // `npm run coverage` shows which branches no test reaches. It is a tool
    // for finding untested paths, not a gate, so there are no thresholds.
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**"],
      exclude: ["src/lib/utils.ts"],
    },
  },
});
