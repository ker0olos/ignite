import { describe, expect, it } from "vitest";
import { reflectionOrigin } from "./reflector";

const at = new Date(2026, 9, 22, 12).getTime();
const base = {
  id: "a",
  text: "x",
  entry: "asking",
  taught: "note",
  at,
} as const;
const from = { conversation: "c", folder: "/f", title: "Sentry triage" };

describe("reflectionOrigin", () => {
  it("names what taught the point, the conversation and how long ago", () => {
    expect(
      reflectionOrigin({ ...base, from }, at + 2 * 3_600_000),
    ).toMatchObject({
      taught: "Note on an answer",
      conversation: "Sentry triage",
      when: "2 hours ago",
      date: new Date(at).toLocaleString(),
    });
  });

  it("names a conversation without a title as untitled", () => {
    expect(
      reflectionOrigin({ ...base, from: { ...from, title: "" } }, at)
        .conversation,
    ).toBe("Untitled conversation");
  });

  it("has no conversation for an edit or an older point", () => {
    const r = reflectionOrigin({ ...base, taught: "edit" }, at + 86_400_000);
    expect(r).toMatchObject({
      taught: "Your edit",
      conversation: null,
      when: "yesterday",
    });
  });
});
