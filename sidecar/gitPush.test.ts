import { describe, expect, it } from "vitest";
import { pushAfter, thenReason } from "./gitPush.ts";

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

  it("names only the pull request after a push", () => {
    const then = { branch: "fix/x", repo: "/r", pr: ["pr", "create"] };
    expect(thenReason("Push", then)).toBe("Push, then open a pull request");
  });
});

describe("pushAfter", () => {
  const pr = { title: "t", body: "b" };

  it("follows nothing when not asked", async () => {
    expect(await pushAfter({ args: ["commit", "-m", "x"] }, "/r")).toBe(
      undefined,
    );
  });

  it("refuses push: true but on a commit, and pr but on a commit or push", async () => {
    await expect(
      pushAfter({ args: ["push", "origin", "x"], push: true }, "/r"),
    ).rejects.toThrow("push with pr");
    await expect(pushAfter({ args: ["fetch"], pr }, "/r")).rejects.toThrow(
      "pr goes only with a commit or push",
    );
  });
});
