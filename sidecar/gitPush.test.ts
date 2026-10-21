import { describe, expect, it } from "vitest";
import { thenReason } from "./gitPush.ts";

describe("thenReason", () => {
  it("names the push and pull request that follow a commit", () => {
    const then = {
      push: ["push", "-u", "origin", "fix/x"],
      branch: "fix/x",
      repo: "/r",
    };
    expect(thenReason("Outside the folder", then)).toBe(
      "Outside the folder, then push to origin/fix/x",
    );
    expect(thenReason("Commit", { ...then, pr: ["pr", "create"] })).toBe(
      "Commit, then push to origin/fix/x and open a pull request",
    );
    expect(thenReason("Commit")).toBe("Commit");
  });
});
