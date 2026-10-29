import { describe, expect, it } from "vitest";
import {
  conversationTitle,
  listedAfter,
  moved,
  orderedRows,
  replyNote,
  rowsOf,
  visibleRows,
  withFirstMessage,
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

  it("remembers which conversation a fork came from", () => {
    const listed: Listed = { "/a": [{ session: "2", title: "Bench" }] };
    const fork = { ...agent("/a", "2", ""), forkOf: "1" };
    expect(withRunning(listed, [fork])["/a"]).toEqual([
      { session: "2", title: "Bench", forkOf: "1" },
    ]);
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

describe("moved", () => {
  const listed: Listed = {
    "/a": ["1", "2", "3"].map((session) => ({ session, title: "" })),
  };
  const order = (l: Listed) => l["/a"].map((r) => r.session);

  it("moves a conversation before or after another", () => {
    expect(order(moved(listed, "/a", "3", "1", false))).toEqual([
      "3",
      "1",
      "2",
    ]);
    expect(order(moved(listed, "/a", "1", "2", true))).toEqual(["2", "1", "3"]);
  });

  it("leaves the list when either isn't in the folder, or it's dropped on itself", () => {
    expect(moved(listed, "/a", "9", "1", false)).toBe(listed);
    expect(moved(listed, "/a", "1", "9", false)).toBe(listed);
    expect(moved(listed, "/b", "1", "2", false)).toBe(listed);
    expect(moved(listed, "/a", "1", "1", false)).toBe(listed);
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

  it("lists a fork under its original, not on its own", () => {
    const withFork: Listed = {
      "/a": [
        { session: "1", title: "Plan" },
        { session: "2", title: "Bench", forkOf: "1" },
      ],
    };
    const rows = rowsOf(withFork, [agent("/a", "2", "Bench")], "/a");
    expect(rows.map((r) => r.session)).toEqual(["1"]);
    expect(rows[0].forks).toEqual([agent("/a", "2", "Bench")]);
    const orphan: Listed = { "/a": [withFork["/a"][1]] };
    expect(rowsOf(orphan, [], "/a").map((r) => r.session)).toEqual(["2"]);
  });

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

describe("visibleRows", () => {
  const rows = [agent("/a", "1"), agent("/a", "2"), agent("/a", "3")];

  it("keeps every row unless collapsed", () => {
    expect(visibleRows(rows, null, false, 1)).toBe(rows);
  });

  it("collapsed, keeps the first `max` and the shown one", () => {
    expect(visibleRows(rows, "3", true, 1).map((r) => r.session)).toEqual([
      "1",
      "3",
    ]);
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

describe("listedAfter", () => {
  it("flips the side when the rows show newest first", () => {
    expect(listedAfter(true, "oldest_first")).toBe(true);
    expect(listedAfter(true, "newest_first")).toBe(false);
    expect(listedAfter(false, "newest_first")).toBe(true);
  });
});

describe("replyNote", () => {
  const reply = (tools: number, edits: number) =>
    ({ role: "assistant", text: "", tools, edits }) as const;
  it("counts tools and edited files, leaving out none", () => {
    expect(replyNote(reply(4, 2))).toBe("Ran 4 tools · edited 2 files");
    expect(replyNote(reply(1, 0))).toBe("Ran 1 tool");
    expect(replyNote(reply(0, 1))).toBe("edited 1 file");
    expect(replyNote(reply(0, 0))).toBe("");
  });
});

describe("withFirstMessage", () => {
  const starting = {
    folder: "/a",
    id: "new",
    message: { role: "user" as const, content: "hi\nthere", timestamp: 1 },
  };

  it("names the starting conversation's row and shows it working until the sidecar does", () => {
    const rows = [agent("/a", "old", "", false), agent("/a", "new", "", false)];
    expect(withFirstMessage(rows, starting)).toEqual([
      rows[0],
      { ...rows[1], title: "hi", running: true },
    ]);
    const named = [agent("/a", "new", "hi", false)];
    expect(withFirstMessage(named, starting)).toEqual(named);
    expect(withFirstMessage(rows, null)).toBe(rows);
    // Once pi has it, the sidecar says whether it runs.
    expect(withFirstMessage(rows, { ...starting, handed: true })[1]).toEqual({
      ...rows[1],
      title: "hi",
    });
  });
});

describe("conversationTitle", () => {
  it("is the title, or New conversation before the first message", () => {
    expect(conversationTitle({ title: "Fix bug" })).toBe("Fix bug");
    expect(conversationTitle({ title: "" })).toBe("New conversation");
  });
});
