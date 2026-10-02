import { describe, expect, it } from "vitest";
import {
  completed,
  firstPick,
  parseQuery,
  pickOf,
  type CommandResultsFound,
} from "./commandQuery";

const FOLDERS = ["/p/motr", "/p/ignition", "/p/motr-web"];

describe("parseQuery", () => {
  it("searches plain text in every folder and kind", () => {
    expect(parseQuery("sentry errors", FOLDERS)).toEqual({
      text: "sentry errors",
      folder: null,
      kinds: null,
      typing: null,
    });
  });

  it("filters by folder name, exactly or by the first it starts", () => {
    expect(parseQuery("@motr sentry ", FOLDERS)).toMatchObject({
      text: "sentry",
      folder: "/p/motr",
    });
    expect(parseQuery("@IGN x", FOLDERS).folder).toBe("/p/ignition");
    expect(parseQuery("@nope x", FOLDERS).folder).toBeNull();
  });

  it("filters by kind, one or several", () => {
    expect(parseQuery("@files app", FOLDERS).kinds).toEqual(["file"]);
    expect(parseQuery("@convos @folders", FOLDERS).kinds).toEqual([
      "conversation",
      "folder",
    ]);
  });

  it("reads a kind filter as a kind, not a folder of that name", () => {
    expect(parseQuery("@files x", ["/p/files"])).toMatchObject({
      kinds: ["file"],
      folder: null,
    });
  });

  it("tells the @ token being typed, without searching for it", () => {
    expect(parseQuery("sentry @mo", FOLDERS)).toMatchObject({
      text: "sentry",
      typing: { partial: "mo" },
    });
    expect(parseQuery("@", FOLDERS)).toMatchObject({ text: "" });
  });

  it("keeps the last valid @ when several name a folder", () => {
    expect(parseQuery("@motr @ignition x", FOLDERS).folder).toBe("/p/ignition");
    expect(parseQuery("@motr @nope x", FOLDERS).folder).toBe("/p/motr");
    expect(parseQuery("@nope @motr x", FOLDERS).folder).toBe("/p/motr");
  });

  it("treats a lone @ as a typing token, not a folder filter", () => {
    expect(parseQuery("@", FOLDERS)).toMatchObject({
      folder: null,
      typing: { partial: "" },
    });
  });
});

describe("pickOf", () => {
  const found: CommandResultsFound = {
    suggestions: [{ token: "@motr" }],
    conversations: [{ folder: "/p/motr", id: "c1" }],
    files: [{ folder: "/p/motr", path: "a.ts" }],
    folders: ["/p/motr"],
  };

  it("resolves each kind letter to what it names", () => {
    expect(pickOf("s0", found)).toEqual({
      kind: "suggestion",
      token: "@motr",
    });
    expect(pickOf("c0", found)).toEqual({
      kind: "conversation",
      folder: "/p/motr",
      id: "c1",
    });
    expect(pickOf("f0", found)).toEqual({
      kind: "file",
      folder: "/p/motr",
      path: "a.ts",
    });
    expect(pickOf("d0", found)).toEqual({ kind: "folder", folder: "/p/motr" });
  });

  it("returns null for an index past the list", () => {
    expect(pickOf("s1", found)).toBeNull();
    expect(pickOf("c5", found)).toBeNull();
  });

  it("returns null for an unknown kind letter", () => {
    expect(pickOf("z0", found)).toBeNull();
  });
});

describe("firstPick", () => {
  const empty: CommandResultsFound = {
    suggestions: [],
    conversations: [],
    files: [],
    folders: [],
  };

  it("picks a suggestion first, then a conversation, a file, then a folder", () => {
    expect(firstPick({ ...empty, suggestions: [{ token: "@motr" }] })).toEqual({
      kind: "suggestion",
      token: "@motr",
    });
    expect(
      firstPick({
        ...empty,
        conversations: [{ folder: "/p/motr", id: "c1" }],
      }),
    ).toEqual({ kind: "conversation", folder: "/p/motr", id: "c1" });
    expect(
      firstPick({ ...empty, files: [{ folder: "/p/motr", path: "a.ts" }] }),
    ).toEqual({ kind: "file", folder: "/p/motr", path: "a.ts" });
    expect(firstPick({ ...empty, folders: ["/p/motr"] })).toEqual({
      kind: "folder",
      folder: "/p/motr",
    });
  });

  it("is null when nothing was found", () => {
    expect(firstPick(empty)).toBeNull();
  });
});

describe("completed", () => {
  it("replaces the token being typed and leaves room for the next", () => {
    expect(completed("sentry @mo", "@motr")).toBe("sentry @motr ");
    expect(completed("", "@files")).toBe("@files ");
  });
});
