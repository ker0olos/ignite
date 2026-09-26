import { describe, expect, it } from "vitest";
import { stillListed, withRecent } from "./recent";

describe("withRecent", () => {
  it("puts a new folder first", () => {
    expect(withRecent(["/a", "/b"], "/c")).toEqual(["/c", "/a", "/b"]);
  });

  it("moves an existing folder to the front without duplicating it", () => {
    expect(withRecent(["/a", "/b", "/c"], "/b")).toEqual(["/b", "/a", "/c"]);
  });

  it("works on an empty list", () => {
    expect(withRecent([], "/a")).toEqual(["/a"]);
  });
});

describe("stillListed", () => {
  it("keeps a folder that is still in the list", () => {
    expect(stillListed("/a", ["/a", "/b"])).toBe("/a");
  });

  it("drops a folder that was removed from the list", () => {
    expect(stillListed("/a", ["/b"])).toBeNull();
  });

  it("stays null when nothing is open", () => {
    expect(stillListed(null, ["/a"])).toBeNull();
  });
});
