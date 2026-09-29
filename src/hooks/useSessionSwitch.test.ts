import { describe, expect, it } from "vitest";
import { nextShown } from "./useSessionSwitch";

describe("nextShown", () => {
  it("shows the right-hand neighbour, else the left, else nothing", () => {
    expect(nextShown(["a", "b", "c"], "b")).toBe("c");
    expect(nextShown(["a", "b", "c"], "c")).toBe("b");
    expect(nextShown(["a", "b", "c"], "a")).toBe("b");
    expect(nextShown(["a", "b"], "gone")).toBe("b");
    expect(nextShown(["a"], "a")).toBeNull();
  });
});
