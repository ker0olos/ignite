import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ImageContent } from "../../shared/agentTypes";
import { readComments, withComments } from "../../shared/sentComments";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useComposerSend } from "@/hooks/useComposerSend";
import { addDiffComment, diffComments } from "@/lib/diffComments";

const line = { kind: "add" as const, num: 2, text: "two" };
const comment = (session: string) =>
  addDiffComment(session, {
    diff: { repo: "/repo", range: "HEAD", status: "M" },
    path: "a.ts",
    from: 1,
    to: 1,
    lines: [line],
    text: "Rename it",
  });

function setup(id: string, typed: string, asking = false) {
  const send = vi.fn();
  const session = {
    session: id,
    state: {},
    none: false,
    transcript: { routing: false },
    waitingOnFork: false,
    send,
    stop: vi.fn(async () => []),
  } as unknown as ReturnType<typeof useAgentSession>;
  const hook = renderHook(() => {
    const [text, setText] = useState(typed);
    const [images, setImages] = useState<ImageContent[]>([]);
    return {
      text,
      ...useComposerSend({
        session,
        asking,
        skills: [],
        draft: { text, setText, images, setImages },
        record: vi.fn(),
        input: { current: null },
      }),
    };
  });
  return { send, hook };
}

describe("useComposerSend", () => {
  it("sends the comments with the text, then forgets them", () => {
    comment("q-send");
    const { send, hook } = setup("q-send", "Look");
    expect(hook.result.current.comments).toHaveLength(1);
    act(() => hook.result.current.send());
    const sent = readComments(send.mock.calls[0][0]);
    expect(sent.text).toBe("Look");
    expect(sent.comments.map((c) => c.text)).toEqual(["Rename it"]);
    expect(diffComments("q-send")).toEqual([]);
    expect(hook.result.current.text).toBe("");
  });

  it("sends comments with no text", () => {
    comment("q-only");
    const { send, hook } = setup("q-only", "");
    expect(hook.result.current.sendable).toBe(true);
    act(() => hook.result.current.send());
    expect(readComments(send.mock.calls[0][0]).comments).toHaveLength(1);
  });

  it("keeps them for the next message after /compact or while a question shows", () => {
    comment("q-compact");
    const compact = setup("q-compact", "/compact");
    act(() => compact.hook.result.current.send());
    expect(compact.send.mock.calls[0][0]).toBe("/compact");
    expect(diffComments("q-compact")).toHaveLength(1);

    const asking = setup("q-compact", "", true);
    expect(asking.hook.result.current.comments).toEqual([]);
    expect(asking.hook.result.current.sendable).toBe(false);
  });

  it("puts a queued message's text and comments back in the composer", () => {
    const { hook } = setup("q-back", "Mine");
    const queued = withComments("Earlier", [
      { path: "a.ts", lines: [line], text: "Again" },
    ]);
    act(() => hook.result.current.restore([{ text: queued }]));
    expect(hook.result.current.text).toBe("Earlier\n\nMine");
    expect(hook.result.current.comments.map((c) => c.text)).toEqual(["Again"]);
  });
});
