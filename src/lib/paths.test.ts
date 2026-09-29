import { describe, expect, it } from "vitest";
import { basename, dirname, sortedByName, tildify } from "./paths";

describe("basename", () => {
  it("returns the last segment", () => {
    expect(basename("/Users/me/Projects/app")).toBe("app");
  });

  it("splits Windows paths", () => {
    expect(basename("C:\\Users\\me\\app")).toBe("app");
  });

  it("returns the input when there is no last segment", () => {
    expect(basename("/")).toBe("/");
  });
});

describe("dirname", () => {
  it("drops the last segment", () => {
    expect(dirname("/Users/me/Projects/app")).toBe("/Users/me/Projects");
  });

  it("drops the last segment of a Windows path", () => {
    expect(dirname("C:\\Users\\me\\app")).toBe("C:\\Users\\me");
  });

  it("returns / for a top-level entry", () => {
    expect(dirname("/Volumes")).toBe("/");
  });
});

describe("tildify", () => {
  const home = "/Users/me";

  it("replaces the home prefix with ~", () => {
    expect(tildify("/Users/me/Projects", home)).toBe("~/Projects");
  });

  it("turns home itself into ~", () => {
    expect(tildify("/Users/me", home)).toBe("~");
  });

  it("leaves a sibling that only shares the prefix alone", () => {
    expect(tildify("/Users/meg/Projects", home)).toBe("/Users/meg/Projects");
  });

  it("shortens Windows paths under home", () => {
    expect(tildify("C:\\Users\\me\\app", "C:\\Users\\me")).toBe("~\\app");
  });

  it("leaves paths outside home alone", () => {
    expect(tildify("/Volumes/disk", home)).toBe("/Volumes/disk");
  });

  it("is a no-op before the home directory is known", () => {
    expect(tildify("/Users/me/Projects", "")).toBe("/Users/me/Projects");
  });
});

describe("sortedByName", () => {
  it("sorts by folder name, ignoring case and counting numbers, then by path", () => {
    expect(
      sortedByName([
        "/work/motr",
        "/work/Ignition",
        "/b/app10",
        "/a/app2",
        "/z/api",
        "/a/api",
      ]),
    ).toEqual([
      "/a/api",
      "/z/api",
      "/a/app2",
      "/b/app10",
      "/work/Ignition",
      "/work/motr",
    ]);
  });
});
