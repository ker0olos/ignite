import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  define: { __PI_HOST_PATH__: JSON.stringify("/repo/sidecar/main.ts") },
  test: {
    // Tauri's IPC mocks (@tauri-apps/api/mocks) need a window object.
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
    // `npm run coverage` shows which branches no test reaches. It is a tool
    // for finding untested paths, not a gate, so there are no thresholds.
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "sidecar/**", "shared/**"],
      // main.ts and the test MCP server run in child processes (main.test.ts),
      // which v8 can't see.
      exclude: [
        "src/lib/utils.ts",
        "sidecar/main.ts",
        "sidecar/testMcpServer.ts",
      ],
    },
  },
});
