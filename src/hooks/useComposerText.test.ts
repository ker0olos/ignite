import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useProvideComposerText } from "@/hooks/useComposerText";
import { appendToComposer } from "@/lib/composerText";

describe("useProvideComposerText", () => {
  it("adds text after the draft and focuses the composer, caret at the end", () => {
    vi.stubGlobal("requestAnimationFrame", (f: () => void) => f());
    const box = document.createElement("textarea");
    document.body.append(box);
    const input = { current: box };
    const { result, rerender } = renderHook(
      ({ session }) => {
        const [text, setText] = useState("Draft");
        box.value = text;
        useProvideComposerText(session, setText, input);
        return text;
      },
      { initialProps: { session: "s-a" as string | null } },
    );
    act(() => void appendToComposer("s-a", "Comments"));
    expect(result.current).toBe("Draft\n\nComments");
    expect(document.activeElement).toBe(box);
    expect(box.selectionStart).toBe(box.value.length);

    rerender({ session: "s-b" });
    expect(appendToComposer("s-a", "Waits")).toBe(false);
    act(() => void appendToComposer("s-b", "More"));
    expect(result.current).toBe("Draft\n\nComments\n\nMore");
    box.remove();
    vi.unstubAllGlobals();
  });
});
