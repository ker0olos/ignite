import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { readFiles } from "../../shared/attachedFiles";
import { ASK_TOOL } from "../../shared/questions";
import { useQuestionDeck } from "@/hooks/useQuestionDeck";

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

it("tells each change to the answers so far, without their images", () => {
  const onDraft = vi.fn();
  const call = {
    type: "toolCall" as const,
    id: "ask-draft",
    name: ASK_TOOL,
    arguments: {
      questions: [{ question: "Which?", options: [{ label: "A" }] }],
    },
  };
  const { result } = renderHook(() => useQuestionDeck(call, vi.fn(), onDraft));
  act(() => result.current!.toggle("A"));
  act(() =>
    result.current!.setImages([
      { type: "image", data: "x", mimeType: "image/png" },
    ]),
  );
  expect(onDraft).toHaveBeenLastCalledWith("ask-draft", [
    { question: "Which?", choices: ["A"] },
  ]);
});
