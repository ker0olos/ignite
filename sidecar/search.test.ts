// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSearch, rankConversations, rankFiles } from "./search.ts";

const convo = (id: string, title: string, text = "", modified = 1) => ({
  id,
  title,
  modified,
  messageCount: 2,
  text,
});

describe("rankConversations", () => {
  it("ranks title matches above matches in the text, which get a snippet", () => {
    const hits = rankConversations(
      [
        [
          "/a",
          [
            convo(
              "1",
              "dark mode",
              "we talked about sentry errors for a while",
            ),
            convo("2", "check the sentry errors"),
            convo("3", "unrelated"),
          ],
        ],
      ],
      "sentry",
      10,
    );
    expect(hits.map((h) => h.id)).toEqual(["2", "1"]);
    expect(hits[0].snippet).toBeUndefined();
    expect(hits[1]).toMatchObject({ folder: "/a" });
    expect(hits[1].snippet).toContain("sentry errors");
    expect(hits[1]).not.toHaveProperty("text");
  });

  it("lists the newest across folders without a query, up to the limit", () => {
    const hits = rankConversations(
      [
        ["/a", [convo("old", "x", "", 1)]],
        ["/b", [convo("new", "y", "", 3), convo("mid", "z", "", 2)]],
      ],
      "",
      2,
    );
    expect(hits.map((h) => [h.folder, h.id])).toEqual([
      ["/b", "new"],
      ["/b", "mid"],
    ]);
  });
});

describe("rankFiles", () => {
  it("finds files by path across folders, and none without a query", () => {
    const lists: [string, string[]][] = [
      ["/a", ["src/app.ts", "README.md", "apps/config.json"]],
      ["/b", ["apps/web/app.tsx"]],
    ];
    // The file's own name counts first.
    expect(rankFiles(lists, "app", 10)).toEqual([
      { folder: "/a", path: "src/app.ts" },
      { folder: "/b", path: "apps/web/app.tsx" },
      { folder: "/a", path: "apps/config.json" },
    ]);
    expect(rankFiles(lists, "", 10)).toEqual([]);
  });
});

describe("createSearch", () => {
  it("keeps each folder's lists a while, and only reads what's asked for", async () => {
    const sessions = { list: vi.fn(async () => [convo("1", "sentry")]) };
    const files = vi.fn(async () => ["sentry.ts"]);
    const search = createSearch(sessions, files);
    const ask = { text: "sentry", folders: ["/a"], limit: 5 };
    await search({ ...ask, kinds: ["conversation"] });
    expect(files).not.toHaveBeenCalled();
    const out = await search({ ...ask, kinds: ["conversation", "file"] });
    expect(out.files).toEqual([{ folder: "/a", path: "sentry.ts" }]);
    expect(sessions.list).toHaveBeenCalledOnce();
  });

  it("leaves out a folder it can't read", async () => {
    const search = createSearch(
      { list: async () => Promise.reject(new Error("gone")) },
      async () => [],
    );
    expect(
      await search({
        text: "",
        folders: ["/gone"],
        kinds: ["conversation"],
        limit: 5,
      }),
    ).toEqual({ conversations: [], files: [] });
  });
});
