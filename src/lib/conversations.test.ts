import { describe, expect, it } from "vitest";
import {
  detailsLine,
  orderedRows,
  rowsOf,
  withRunning,
  without,
  allTags,
  type Listed,
} from "./conversations";

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

  const listed: Listed = {
    "/a": [
      { session: "1", title: "Fix" },
      { session: "2", title: "Plan" },
      { session: "3", title: "Conversation" },
    ],
  };
  const tags = { "1": ["bug"], "2": ["design", "later"], "9": ["closed"] };

  it("attaches tags and filters conversations to any selected tag", () => {
    expect(rowsOf(listed, [], "/a", tags)[0].tags).toEqual(["bug"]);
    expect(
      rowsOf(listed, [], "/a", tags, ["bug", "later"]).map((r) => r.session),
    ).toEqual(["1", "2"]);
  });
});

describe("allTags", () => {
  it("lists unique tags of listed conversations only", () => {
    const listed: Listed = {
      "/a": [{ session: "1", title: "" }],
      "/b": [{ session: "2", title: "" }],
    };
    expect(
      allTags(listed, {
        "1": ["ui", "bug"],
        "2": ["bug"],
        "9": ["closed"],
      }),
    ).toEqual(["bug", "ui"]);
  });
});

describe("orderedRows", () => {
  const rows = [agent("/a", "1"), agent("/a", "2")];

  it("keeps oldest first as the default order", () => {
    expect(orderedRows(rows, "oldest_first")).toBe(rows);
  });

  it("reverses rows for newest first without mutating the original", () => {
    expect(orderedRows(rows, "newest_first").map((r) => r.session)).toEqual([
      "2",
      "1",
    ]);
    expect(rows.map((r) => r.session)).toEqual(["1", "2"]);
  });
});

describe("detailsLine", () => {
  const saved = {
    id: "a",
    title: "t",
    modified: 1,
    messageCount: 4,
    open: false,
  };
  it("lists what's known, leaving out what isn't", () => {
    expect(
      detailsLine(saved, {
        model: "gpt-5",
        files: [],
        toolCalls: 3,
        cost: 0.25,
        branch: "feat/x",
      }),
    ).toBe("gpt-5 · 4 messages · 3 tool calls · $0.25 · feat/x");
    expect(detailsLine(saved, { files: [], toolCalls: 0 })).toBe("4 messages");
  });
});
