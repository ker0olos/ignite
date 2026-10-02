import { describe, expect, it } from "vitest";
import type { GitRepoStatus } from "../../shared/git";
import { prState, shortName, unfinished } from "@/lib/gitStatus";

const repo = (over: Partial<GitRepoStatus>): GitRepoStatus => ({
  repo: "/r",
  name: "r",
  changed: 0,
  unpushed: 0,
  ...over,
});
const pr = (state: "OPEN" | "MERGED" | "CLOSED", isDraft = false) => ({
  number: 1,
  url: "u",
  state,
  isDraft,
});

describe("unfinished", () => {
  it("keeps repositories with changes, unpushed commits or an open pull request", () => {
    const done = [
      repo({ name: "clean" }),
      repo({ pr: pr("MERGED") }),
      repo({ pr: pr("CLOSED") }),
    ];
    const kept = [
      repo({ changed: 2 }),
      repo({ unpushed: 1 }),
      repo({ pr: pr("OPEN", true) }),
      repo({ unpushed: 1, pr: pr("MERGED") }),
    ];
    expect(unfinished([...done, ...kept])).toEqual(kept);
  });
});

describe("shortName", () => {
  it.each([
    ["lead-led/motr-expo", "motr-expo"],
    ["group/sub/app", "app"],
    ["local", "local"],
  ])("shortens %s", (name, short) => {
    expect(shortName(name)).toBe(short);
  });
});

describe("prState", () => {
  it.each([
    [pr("OPEN"), "open"],
    [pr("OPEN", true), "draft"],
    [pr("MERGED"), "merged"],
    [pr("CLOSED"), "closed"],
  ])("words %j", (p, word) => {
    expect(prState(p)).toBe(word);
  });
});
