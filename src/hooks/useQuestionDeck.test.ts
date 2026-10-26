import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { readFiles } from "../../shared/attachedFiles";
import { ASK_TOOL } from "../../shared/questions";
import { useQuestionDeck } from "@/hooks/useQuestionDeck";
import { flushDecks, loadDeck } from "@/lib/questionDrafts";
import type { ToolRun } from "@/lib/transcript";

it("keeps a question's dropped files with its answer, sent in its note", () => {
  const onApprove = vi.fn();
  const call = {
    type: "toolCall" as const,
    id: "ask-files",
    name: ASK_TOOL,
    arguments: {
      questions: [{ question: "Which?", options: [{ label: "A" }] }],
    },
  };
  const { result } = renderHook(() => useQuestionDeck(call, onApprove));
  act(() => result.current!.setFiles([{ path: "/d/a.pdf" }]));
  act(() =>
    result.current!.setFiles((f) => [...f, { path: "/d/b.txt", text: "hi" }]),
  );
  expect(result.current!.draft.files).toHaveLength(2);
  act(() => result.current!.next());
  const [answer] = onApprove.mock.calls[0][2];
  expect(readFiles(answer.note).files).toEqual([
    { path: "/d/a.pdf" },
    { path: "/d/b.txt", text: "hi" },
  ]);
});

const draftCall = {
  type: "toolCall" as const,
  id: "ask-draft",
  name: ASK_TOOL,
  arguments: {
    questions: [{ question: "Which?", options: [{ label: "A" }] }],
  },
};

it("tells the answers so far once changes pause, without their images", () => {
  vi.useFakeTimers();
  try {
    const onDraft = vi.fn();
    const { result } = renderHook(() =>
      useQuestionDeck(draftCall, vi.fn(), onDraft),
    );
    act(() => result.current!.toggle("A"));
    act(() =>
      result.current!.setImages([
        { type: "image", data: "x", mimeType: "image/png" },
      ]),
    );
    expect(onDraft).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(onDraft).toHaveBeenCalledOnce();
    expect(onDraft).toHaveBeenCalledWith("ask-draft", [
      { question: "Which?", choices: ["A"] },
    ]);
  } finally {
    vi.useRealTimers();
  }
});

it("forgets the saved draft of a call that ended unanswered", () => {
  const { result, rerender } = renderHook(
    ({ tools }: { tools: Record<string, ToolRun> }) =>
      useQuestionDeck(draftCall, vi.fn(), undefined, tools),
    { initialProps: { tools: { "ask-draft": { status: "running" } } } },
  );
  act(() => result.current!.toggle("A"));
  flushDecks();
  expect(loadDeck("ask-draft")).toBeDefined();
  rerender({ tools: { "ask-draft": { status: "done" } } });
  flushDecks();
  expect(loadDeck("ask-draft")).toBeUndefined();
});
