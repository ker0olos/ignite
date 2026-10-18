import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useComposerDraft } from "@/hooks/useComposerDraft";
import type { QuestionDeck } from "@/hooks/useQuestionDeck";
import { currentImageTarget } from "@/lib/imageTarget";

const input = { current: null };

it("keeps dropped files with the message, or with the question showing", () => {
  const own = renderHook(() => useComposerDraft(null, input));
  act(() => currentImageTarget()!.addFile!({ path: "/d/a.pdf" }));
  expect(own.result.current.files).toEqual([{ path: "/d/a.pdf" }]);
  own.unmount();

  const setFiles = vi.fn();
  const deck = {
    draft: { picked: [], text: "", images: [], files: [{ path: "/d/q.txt" }] },
    setText: vi.fn(),
    setImages: vi.fn(),
    setFiles,
  } as unknown as QuestionDeck;
  const asking = renderHook(() => useComposerDraft(deck, input));
  expect(asking.result.current.files).toEqual([{ path: "/d/q.txt" }]);
  act(() => currentImageTarget()!.addFile!({ path: "/d/b.pdf" }));
  const add = setFiles.mock.calls[0][0] as (f: unknown[]) => unknown[];
  expect(add([])).toEqual([{ path: "/d/b.pdf" }]);
  asking.unmount();
});
