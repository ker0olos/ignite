import { describe, expect, it } from "vitest";
import { rowsOf, withRunning, without, type Listed } from "./conversations";

const agent = (cwd: string, session: string, title = "", running = true) => ({
  cwd,
  session,
  title,
  running,
  waiting: false,
});

describe("withRunning", () => {
  it("lists a conversation the user started, after the folder's others", () => {
    const listed: Listed = { "/a": [{ session: "1", title: "First" }] };
    expect(withRunning(listed, [agent("/a", "2"), agent("/b", "3")])).toEqual({
      "/a": [
        { session: "1", title: "First" },
        { session: "2", title: "" },
      ],
      "/b": [{ session: "3", title: "" }],
    });
  });

  it("takes a running conversation's new title, keeping a known one over none", () => {
    const listed: Listed = { "/a": [{ session: "1", title: "Old" }] };
    expect(withRunning(listed, [agent("/a", "1", "New")])["/a"]).toEqual([
      { session: "1", title: "New" },
    ]);
    expect(withRunning(listed, [agent("/a", "1", "")])).toBe(listed);
  });

  it("returns the same list when nothing changed", () => {
    const listed: Listed = { "/a": [{ session: "1", title: "T" }] };
    expect(withRunning(listed, [agent("/a", "1", "T")])).toBe(listed);
  });
});

describe("without", () => {
  it("removes a conversation, and the folder once it has none", () => {
    const listed: Listed = {
      "/a": [
        { session: "1", title: "" },
        { session: "2", title: "" },
      ],
      "/b": [{ session: "3", title: "" }],
    };
    expect(without(listed, "/a", "1")).toEqual({
      "/a": [{ session: "2", title: "" }],
      "/b": [{ session: "3", title: "" }],
    });
    expect(without(listed, "/b", "3")).toEqual({ "/a": listed["/a"] });
  });
});

describe("rowsOf", () => {
  it("shows running conversations as they are, and the rest idle", () => {
    const listed: Listed = {
      "/a": [
        { session: "1", title: "Saved title" },
        { session: "2", title: "Asleep" },
      ],
    };
    expect(rowsOf(listed, [agent("/a", "1")], "/a")).toEqual([
      agent("/a", "1", "Saved title"),
      agent("/a", "2", "Asleep", false),
    ]);
    expect(rowsOf(listed, [], "/none")).toEqual([]);
  });
});
