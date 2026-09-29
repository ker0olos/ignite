// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSearch } from "./search.ts";

const convo = (id: string, title: string) => ({
  id,
  title,
  modified: 1,
  messageCount: 2,
  text: "",
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
