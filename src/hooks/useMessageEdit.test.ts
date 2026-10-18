import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import type { UserMessage } from "../../shared/agentTypes";
import { withFiles } from "../../shared/attachedFiles";
import { withComments } from "../../shared/sentComments";
import type { MessageEdit } from "@/components/conversation/shared";
import { useMessageEdit } from "./useMessageEdit";

const image = { type: "image" as const, data: "AA==", mimeType: "image/png" };
const MESSAGE: UserMessage = {
  role: "user",
  content: [{ type: "text", text: "Fix it" }, image],
  timestamp: 1,
  entryId: "u1",
};

const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
  ({
    key: k,
    shiftKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: vi.fn(),
    ...extra,
  }) as unknown as KeyboardEvent<HTMLTextAreaElement>;

function setup(
  edit: Partial<MessageEdit> | null = {},
  message: UserMessage = MESSAGE,
) {
  const full = edit && {
    edit: vi.fn(async () => true),
    disabled: false,
    ...edit,
  };
  const hook = renderHook(() => useMessageEdit(message, full));
  return { ...hook, edit: full };
}

describe("useMessageEdit", () => {
  it("starts with the message's text and sends the edit, its images kept, on Enter", async () => {
    const { result, edit } = setup();
    expect(result.current.editing).toBe(false);
    act(() => result.current.start());
    expect(result.current.text).toBe("Fix it");
    act(() => result.current.setText("Fix it properly"));
    const enter = key("Enter");
    await act(async () => result.current.onKeyDown(enter));
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(edit!.edit).toHaveBeenCalledWith("u1", "Fix it properly", [image]);
    expect(result.current.editing).toBe(false);
  });

  it("keeps editing when the edit is refused", async () => {
    const { result } = setup({ edit: vi.fn(async () => false) });
    act(() => result.current.start());
    await act(() => result.current.submit());
    expect(result.current.editing).toBe(true);
    expect(result.current.sending).toBe(false);
  });

  it("cancels on Escape, and leaves Shift+Enter, typing and composing alone", async () => {
    const { result, edit } = setup();
    act(() => result.current.start());
    for (const k of [
      key("Enter", { shiftKey: true }),
      key("Enter", { nativeEvent: { isComposing: true } } as never),
      key("a"),
    ]) {
      await act(async () => result.current.onKeyDown(k));
      expect(k.preventDefault).not.toHaveBeenCalled();
    }
    expect(edit!.edit).not.toHaveBeenCalled();
    act(() => result.current.onKeyDown(key("Escape")));
    expect(result.current.editing).toBe(false);
    act(() => result.current.start());
    act(() => result.current.cancel());
    expect(result.current.editing).toBe(false);
  });

  it("sends nothing empty, while disabled, unnamed or not editing", async () => {
    const text: UserMessage = { ...MESSAGE, content: "Hi" };
    const empty = setup({}, text);
    await act(() => empty.result.current.submit());
    act(() => empty.result.current.start());
    act(() => empty.result.current.setText("  "));
    await act(() => empty.result.current.submit());
    expect(empty.edit!.edit).not.toHaveBeenCalled();

    const disabled = setup({ disabled: true });
    act(() => disabled.result.current.start());
    await act(() => disabled.result.current.submit());
    expect(disabled.edit!.edit).not.toHaveBeenCalled();

    const unnamed = setup({}, { ...MESSAGE, entryId: undefined });
    act(() => unnamed.result.current.start());
    await act(() => unnamed.result.current.submit());
    expect(unnamed.edit!.edit).not.toHaveBeenCalled();

    const none = setup(null);
    act(() => none.result.current.start());
    await act(() => none.result.current.submit());
    expect(none.result.current.editing).toBe(true);
  });

  it("keeps a message's files and diff comments with its edited text", async () => {
    const files = [{ path: "src/app.ts" }];
    const comments = [
      {
        path: "src/app.ts",
        lines: [{ kind: "add" as const, num: 3, text: "x" }],
        text: "why?",
      },
    ];
    const sent = (text: string) =>
      withComments(withFiles(text, files), comments);
    const { result, edit } = setup({}, { ...MESSAGE, content: sent("Fix it") });
    act(() => result.current.start());
    expect(result.current.text).toBe("Fix it");
    act(() => result.current.setText("Fix it well"));
    await act(() => result.current.submit());
    expect(edit!.edit).toHaveBeenCalledWith("u1", sent("Fix it well"), []);
  });

  it("sends an edit with only images", async () => {
    const { result, edit } = setup();
    act(() => result.current.start());
    act(() => result.current.setText(""));
    await act(() => result.current.submit());
    expect(edit!.edit).toHaveBeenCalledWith("u1", "", [image]);
  });
});
