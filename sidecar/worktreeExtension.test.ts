// @vitest-environment node
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import worktreeGuidance, { guidance } from "./worktreeExtension.ts";

describe("guidance", () => {
  it("tells the agent where it works and how its work reaches the user", () => {
    const text = guidance("/wt/a", "/work", "main");
    expect(text).toContain("worktree at /wt/a");
    expect(text).toContain("repository at /work");
    expect(text).toContain("open a pull request");
    expect(text).toContain("Don't switch to main");
  });

  it("names no branch when the user's folder isn't on one", () => {
    expect(guidance("/wt/a", "/work", null)).not.toContain("Don't switch");
  });
});

describe("the worktree extension", () => {
  it("leaves an agent that works in the folder itself alone", async () => {
    let handler: (event: object, ctx: object) => Promise<unknown> = async () =>
      "unset";
    worktreeGuidance({
      on: (_: string, h: typeof handler) => (handler = h),
    } as unknown as ExtensionAPI);
    expect(
      await handler({ systemPrompt: "base" }, { cwd: "/work" }),
    ).toBeUndefined();
  });
});
