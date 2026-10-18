import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ImageContent } from "../../shared/agentTypes";
import {
  readFiles,
  withFiles,
  type SentFile,
} from "../../shared/attachedFiles";
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

function setup(id: string, typed: string, attached: SentFile[] = []) {
  const send = vi.fn();
  const session = {
    session: id,
    state: {},
    ready: true,
    none: false,
    transcript: { routing: false },
    waitingOnFork: false,
    send,
    stop: vi.fn(async () => []),
  } as unknown as ReturnType<typeof useAgentSession>;
  const hook = renderHook(() => {
    const [text, setText] = useState(typed);
    const [images, setImages] = useState<ImageContent[]>([]);
    const [files, setFiles] = useState(attached);
    return {
      text,
      ...useComposerSend({
        session,
        skills: [],
        draft: { text, setText, images, setImages, files, setFiles },
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

  it("keeps them for the next message after /compact", () => {
    comment("q-compact");
    const compact = setup("q-compact", "/compact");
    act(() => compact.hook.result.current.send());
    expect(compact.send.mock.calls[0][0]).toBe("/compact");
    expect(diffComments("q-compact")).toHaveLength(1);
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

  it("sends dropped files with the text and comments, then forgets them", () => {
    comment("q-files");
    const notes = { path: "/d/notes.txt", text: "hi" };
    const { send, hook } = setup("q-files", "Look", [notes]);
    expect(hook.result.current.files).toEqual([notes]);
    act(() => hook.result.current.send());
    const sent = readComments(send.mock.calls[0][0]);
    expect(sent.comments).toHaveLength(1);
    expect(readFiles(sent.text)).toEqual({ text: "Look", files: [notes] });
    expect(hook.result.current.files).toEqual([]);
  });

  it("sends files with no text, and removes one", () => {
    const pdf = { path: "/d/a.pdf" };
    const only = setup("q-only-files", "", [pdf]);
    expect(only.hook.result.current.sendable).toBe(true);
    act(() => only.hook.result.current.removeFile(0));
    expect(only.hook.result.current.files).toEqual([]);
  });

  it("puts a queued message's files back", () => {
    const { hook } = setup("q-back-files", "");
    act(() =>
      hook.result.current.restore([
        { text: withFiles("Earlier", [{ path: "/d/a.pdf" }]) },
      ]),
    );
    expect(hook.result.current.text).toBe("Earlier");
    expect(hook.result.current.files).toEqual([{ path: "/d/a.pdf" }]);
  });
});
