// @vitest-environment node
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import worktreeGuidance, {
  GIT_GUIDANCE,
  groupGuidance,
  guidance,
} from "./worktreeExtension.ts";

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

describe("groupGuidance", () => {
  it("tells the agent its copy holds a worktree of each repository, delivered one by one", () => {
    const text = groupGuidance("/wt/a", "/projects", ["server", "web"]);
    expect(text).toContain("your own copy of the user's folder at /wt/a");
    expect(text).toContain("(server, web)");
    expect(text).toContain("-C <repo>");
    expect(text).toContain("in each repository you changed");
    expect(text).toContain("aren't kept");
  });
});

describe("the worktree extension", () => {
  type Handler = (event: object, ctx: object) => Promise<unknown>;
  const load = () => {
    const handlers = new Map<string, Handler>();
    worktreeGuidance({
      on: (name: string, h: Handler) => handlers.set(name, h),
    } as unknown as ExtensionAPI);
    return handlers;
  };

  it("tells an agent in the user's own folder how to use git there", async () => {
    const result = (await load().get("before_agent_start")!(
      { systemPrompt: "base" },
      { cwd: "/work" },
    )) as { systemPrompt: string };
    expect(result.systemPrompt).toMatch(/^base\n\n/);
    expect(result.systemPrompt).toContain(GIT_GUIDANCE);
    expect(result.systemPrompt).toContain("the user's checkouts");
    expect(result.systemPrompt).not.toContain("your own git worktree");
  });
});
