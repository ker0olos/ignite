import { describe, expect, it } from "vitest";
import { remoteName } from "./gitPlace.ts";

describe("remoteName", () => {
  it.each([
    ["git@github.com:me/app.git", "me/app"],
    ["https://github.com/me/app.git", "me/app"],
    ["https://github.com/me/app/", "me/app"],
    ["ssh://git@github.com:22/me/app.git", "me/app"],
    ["https://gitlab.com/group/sub/app", "group/sub/app"],
    ["https://me:ghp_secret@github.com/me/app.git", "me/app"],
    ["/Users/me/remote.git", null],
    ["../remote.git", null],
    ["", null],
  ])("reads %s", (url, name) => {
    expect(remoteName(url)).toBe(name);
  });
});
