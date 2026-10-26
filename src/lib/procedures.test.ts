import { describe, expect, it } from "vitest";
import { codeParts, procedureOrigin } from "./procedures";

const at = new Date(2026, 9, 22, 12).getTime();
const base = { id: 1, title: "x", steps: [], folder: "/f", at };
const from = { conversation: "c", folder: "/f", title: "Sentry triage" };

describe("procedureOrigin", () => {
  it("names the conversation and how long ago", () => {
    expect(procedureOrigin({ ...base, from }, at + 2 * 3_600_000)).toEqual({
      conversation: "Sentry triage",
      when: "2 hours ago",
      date: new Date(at).toLocaleString(),
    });
  });

  it("names a conversation without a title as untitled", () => {
    expect(
      procedureOrigin({ ...base, from: { ...from, title: "" } }, at)
        .conversation,
    ).toBe("Untitled conversation");
  });

  it("has no conversation when none is known", () => {
    expect(procedureOrigin(base, at).conversation).toBeNull();
  });
});

describe("codeParts", () => {
  it("splits backtick spans out as code", () => {
    expect(codeParts("Run `pnpm test` now")).toEqual([
      { text: "Run ", code: false },
      { text: "pnpm test", code: true },
      { text: " now", code: false },
    ]);
  });

  it("leaves an unclosed backtick literal", () => {
    expect(codeParts("a `b")).toEqual([{ text: "a `b", code: false }]);
  });
});
