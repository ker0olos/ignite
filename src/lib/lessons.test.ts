import { describe, expect, it } from "vitest";
import { lessonScope } from "./lessons";

describe("lessonScope", () => {
  it("names every folder, the open one, or a folder by name", () => {
    expect(lessonScope(undefined)).toBe("Every folder");
    expect(lessonScope("")).toBe("This folder");
    expect(lessonScope("/p/tempo")).toBe("tempo");
  });
});
