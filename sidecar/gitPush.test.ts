import { describe, expect, it } from "vitest";
import { thenReason } from "./gitPush.ts";

describe("thenReason", () => {
  it("names the push that follows a commit", () => {
    expect(
      thenReason("Outside the folder", ["push", "-u", "origin", "fix/x"]),
    ).toBe("Outside the folder, then push to origin/fix/x");
    expect(thenReason("Commit")).toBe("Commit");
  });
});
