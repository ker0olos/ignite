// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Vite serves these by URL; under Node, web-tree-sitter reads them from disk.
vi.mock("tree-sitter-bash/tree-sitter-bash.wasm?url", () => ({
  default: new URL(
    "../../node_modules/tree-sitter-bash/tree-sitter-bash.wasm",
    import.meta.url,
  ).pathname,
}));
vi.mock("web-tree-sitter/web-tree-sitter.wasm?url", () => ({
  default: new URL(
    "../../node_modules/web-tree-sitter/web-tree-sitter.wasm",
    import.meta.url,
  ).pathname,
}));

const { looksLikeShell } = await import("./shellDetect");

describe("looksLikeShell", () => {
  it("is true for commands, one line or several", async () => {
    expect(
      await looksLikeShell(
        "cd CollideAI-server && doppler run -- npx tsx bench-story.ts gemini-3.7-flash medium",
      ),
    ).toBe(true);
    expect(await looksLikeShell("npm ci\n./scripts/build.sh | tee log")).toBe(
      true,
    );
  });

  it("is false for prose, output and code that isn't shell", async () => {
    expect(await looksLikeShell("Run the tests first")).toBe(false);
    expect(await looksLikeShell("Tests  52 passed (52)")).toBe(false);
    expect(await looksLikeShell("const a = { b: 1 };")).toBe(false);
    expect(await looksLikeShell("FOO=1")).toBe(false);
    expect(await looksLikeShell("  \n")).toBe(false);
  });
});
