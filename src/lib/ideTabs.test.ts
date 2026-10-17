import { describe, expect, it } from "vitest";
import { childTabId } from "./childTabs";
import { ideTabs, nextFront } from "./ideTabs";

const t1 = childTabId({ kind: "terminal", session: "", terminal: "t1" });
const t2 = childTabId({ kind: "terminal", session: "", terminal: "t2" });
const files = ["/f/a.ts", t1, "/f/b.ts", t2];
const none = { kept: null, picked: null };

describe("ideTabs", () => {
  it("moves terminals to the panel, the active one shown there", () => {
    const tabs = ideTabs(files, t1, none);
    expect(tabs.strip).toEqual(["/f/a.ts", "/f/b.ts"]);
    expect(tabs.terminals).toEqual([t1, t2]);
    expect(tabs.panel).toBe(t1);
  });

  it("keeps the file in front while the panel's terminal is active", () => {
    expect(ideTabs(files, t1, { kept: "/f/b.ts", picked: null }).front).toBe(
      "/f/b.ts",
    );
    // The conversation stays in front the same way.
    expect(ideTabs(files, t1, { kept: null, picked: null }).front).toBeNull();
  });

  it("keeps the picked terminal while a file is in front, else the newest", () => {
    expect(ideTabs(files, "/f/b.ts", { kept: null, picked: t1 })).toMatchObject(
      {
        front: "/f/b.ts",
        panel: t1,
      },
    );
    expect(ideTabs(files, null, { kept: null, picked: "gone" }).panel).toBe(t2);
    expect(ideTabs(["/f/a.ts"], null, none).panel).toBeNull();
  });
});

describe("nextFront", () => {
  const strip = {
    conversations: ["a", "b"],
    files: ["/f/x.ts", "/f/y.ts"],
    shown: "a",
  };

  it("changes nothing when the closed tab wasn't in front", () => {
    expect(nextFront({ ...strip, front: "/f/x.ts" }, "b")).toBeNull();
  });

  it("gives a file's place to the next file, else the conversation behind it", () => {
    expect(nextFront({ ...strip, front: "/f/x.ts" }, "/f/x.ts")).toEqual({
      file: "/f/y.ts",
    });
    const one = { ...strip, files: ["/f/x.ts"], front: "/f/x.ts" };
    expect(nextFront(one, "/f/x.ts")).toEqual({ conversation: "a" });
    // The conversation behind has no tab: the nearest one, else a new one.
    expect(nextFront({ ...one, shown: "gone" }, "/f/x.ts")).toEqual({
      conversation: "b",
    });
    expect(
      nextFront({ ...one, conversations: [], shown: null }, "/f/x.ts"),
    ).toEqual({ conversation: null });
  });

  it("gives a conversation's place to the next conversation, else a file, else a new one", () => {
    expect(nextFront({ ...strip, front: "a" }, "a")).toEqual({
      conversation: "b",
    });
    const alone = { ...strip, conversations: ["a"], front: "a" };
    expect(nextFront(alone, "a")).toEqual({ file: "/f/x.ts" });
    expect(nextFront({ ...alone, files: [] }, "a")).toEqual({
      conversation: null,
    });
  });
});
