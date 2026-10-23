// @vitest-environment node
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import type { ApprovalGate } from "../src/lib/approvalPolicy.ts";
import worktreeGuidance, {
  gitGuidance,
  groupGuidance,
  guidance,
} from "./worktreeExtension.ts";

const mode = vi.hoisted(() => ({ current: "auto" as ApprovalGate }));
vi.mock("./approvalSettings.ts", () => ({
  approvalMode: async () => mode.current,
}));

describe("guidance", () => {
  it("tells the agent where it works and how its work reaches the user", () => {
    const text = guidance("/wt/a", "/work", "main");
    expect(text).toContain("worktree at /wt/a");
    expect(text).toContain("repository at /work");
    expect(text).toContain("open a pull request");
    expect(text).toContain("Don't switch to main");
    expect(text).toContain("same paths under /wt/a");
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
    expect(text).toContain("never in /projects");
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

  const worktreeSection = async () => {
    const sections: Record<string, string> = {};
    await load().get("before_agent_start")!(
      { systemPromptOptions: { sections } },
      { cwd: "/work" },
    );
    return sections.worktree;
  };

  it("tells an agent in the user's own folder how to use git there", async () => {
    mode.current = "auto";
    const section = await worktreeSection();
    expect(section).toContain(gitGuidance(true));
    expect(section).toContain("the user's checkouts");
    expect(section).not.toContain("your own git worktree");
  });

  it("has the agent ask before delivering under full access, where no review asks", async () => {
    mode.current = "full";
    const section = await worktreeSection();
    expect(section).toContain(gitGuidance(false));
    expect(section).toContain("ask with the ask_user tool first");
    mode.current = "manual";
    expect(await worktreeSection()).toContain("review is that asking");
  });
});
