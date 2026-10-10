import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  define: {
    __PI_HOST_PATH__: JSON.stringify("/repo/sidecar/main.ts"),
    __DEMO_FOLDER__: "null",
    __HEALTH_FILE__: "null",
  },
  test: {
    // Tauri's IPC mocks (@tauri-apps/api/mocks) need a window object.
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    // demo/ is a sample project the app opens, with tests of its own.
    exclude: [...configDefaults.exclude, "demo/**"],
    // demo.test.ts reads demo/tempo's stylesheet as text; artifacts compile Tailwind's.
    css: { include: [/demo\/tempo/, /tailwindcss\/index\.css/] },
    restoreMocks: true,
    // Sidecar tests spawn git, shells and PTYs, which a full parallel run slows well past 5s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // `npm run coverage` shows which branches no test reaches. It is a tool
    // for finding untested paths, not a gate, so there are no thresholds.
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "sidecar/**", "shared/**"],
      // These run in child processes (main.test.ts), which v8 can't see.
      exclude: [
        "src/lib/utils.ts",
        "sidecar/main.ts",
        "sidecar/start.ts",
        "sidecar/modsHooks.ts",
        "sidecar/testMcpServer.ts",
      ],
    },
  },
});
