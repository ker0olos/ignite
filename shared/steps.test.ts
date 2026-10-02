// @vitest-environment node
import { describe, expect, it } from "vitest";
import { stepOf } from "./steps.ts";

describe("stepOf", () => {
  it.each([
    [
      "bash",
      { command: "cd /w/app && grep -rn x src\nmore" },
      "Running grep -rn x src",
    ],
    ["read", { path: "/w/app/root.tsx" }, "Reading app/root.tsx"],
    ["edit", { path: "src/a.ts" }, "Editing src/a.ts"],
    ["write", { path: "/w/b.css" }, "Writing b.css"],
    ["read", { path: "/w" }, "Reading /w"],
    ["read", { path: "/other/x.ts" }, "Reading /other/x.ts"],
    ["grep", { pattern: "x" }, "Searching the code"],
    ["mcp", {}, "Using mcp"],
    [
      "git",
      { args: ["push", "-u", "origin", "x"] },
      "Running git push -u origin x",
    ],
    ["gh", { args: ["pr", "create"] }, "Running gh pr create"],
    ["git", { args: "status" }, "Using git"],
    ["bash", {}, "Using bash"],
    ["read", {}, "Using read"],
  ])("%s → %s", (tool, input, step) => {
    expect(stepOf(tool, input, "/w")).toBe(step);
  });

  it("clips long steps", () => {
    const step = stepOf("bash", { command: "x".repeat(200) }, "/w")!;
    expect(step).toHaveLength(60);
    expect(step.endsWith("…")).toBe(true);
  });

  it("skips the task's own tools", () => {
    expect(stepOf("task_update", {}, "/w")).toBeNull();
    expect(stepOf("ask_user", {}, "/w")).toBeNull();
  });
});
