import { act, renderHook, waitFor } from "@testing-library/react";
import { useEffect, type KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { useMentions } from "./useMentions";

const SKILLS = [
  { name: "code-review", description: "Review" },
  { name: "commit", description: "Commit" },
];

function key(k: string, shiftKey = false) {
  const preventDefault = vi.fn();
  const event = {
    key: k,
    shiftKey,
    preventDefault,
    nativeEvent: { isComposing: false },
  } as unknown as KeyboardEvent;
  return { event, preventDefault };
}

function setup(text: string, host: HostClient | null = null) {
  const onPick = vi.fn();
  const input = { current: { value: text } as HTMLTextAreaElement };
  const hook = renderHook(
    ({ text, typed = true }: { text: string; typed?: boolean }) => {
      input.current.value = text;
      const mentions = useMentions({
        host,
        folder: "/p",
        text,
        setText: onPick,
        input,
        skills: SKILLS,
        images: 1,
      });
      // As the textarea reports it after typing.
      useEffect(() => {
        if (typed) mentions.setCaret(text.length);
      }, [text, typed, mentions]);
      return { ...mentions, ...mentions.menu };
    },
    { initialProps: { text } as { text: string; typed?: boolean } },
  );
  return { ...hook, onPick };
}

describe("useMentions", () => {
  it("moves with the arrows and picks with enter", () => {
    const { result, onPick } = setup("/co");
    expect(result.current.options).toHaveLength(2);
    act(() => void result.current.onKeyDown(key("ArrowDown").event));
    expect(result.current.selected).toBe(1);
    act(() => void result.current.onKeyDown(key("ArrowDown").event));
    expect(result.current.selected).toBe(0);
    act(() => void result.current.onKeyDown(key("ArrowUp").event));
    const enter = key("Enter");
    act(() => void result.current.onKeyDown(enter.event));
    expect(enter.preventDefault).toHaveBeenCalled();
    // "commit" ranks first, being shorter.
    expect(onPick).toHaveBeenCalledWith("/code-review ");
  });

  it("leaves other keys, ⇧↵ and keys with nothing shown to the composer", () => {
    const { result, rerender } = setup("/co");
    expect(result.current.onKeyDown(key("a").event)).toBe(false);
    expect(result.current.onKeyDown(key("Enter", true).event)).toBe(false);
    rerender({ text: "plain" });
    expect(result.current.onKeyDown(key("Enter").event)).toBe(false);
  });

  it("closes on escape until another mention starts", () => {
    const { result, rerender } = setup("/co");
    act(() => void result.current.onKeyDown(key("Escape").event));
    expect(result.current.options).toEqual([]);
    rerender({ text: "/com" });
    expect(result.current.options).toEqual([]);
    rerender({ text: "/com @" });
    expect(result.current.options.map((o) => o.insert)).toEqual(["@image1"]);
  });

  it("shows nothing for text put back without a caret report", () => {
    const { result, rerender } = setup("/co");
    expect(result.current.options).toHaveLength(2);
    // Taken back from the queue: the text changes, the caret isn't reported.
    rerender({ text: "/code-review", typed: false });
    expect(result.current.options).toEqual([]);
  });

  it("asks the host for the folder's terminals and files on @", async () => {
    const request = vi.fn(async (r: { type: string }) =>
      r.type === "terminal_list"
        ? [{ terminal: "t1", cwd: "/p", running: true }]
        : { conversations: [], files: [{ folder: "/p", path: "src/a.ts" }] },
    );
    const host = { request } as unknown as HostClient;
    const { result } = setup("@", host);
    await waitFor(() =>
      expect(result.current.options.map((o) => o.insert)).toEqual([
        "@image1",
        "@t1",
        "@src/a.ts",
      ]),
    );
    expect(request).toHaveBeenCalledWith({
      type: "command_search",
      text: "",
      folders: ["/p"],
      kinds: ["file"],
      limit: 8,
    });
  });

  it("shows none of the host's answers when it fails", async () => {
    const request = vi.fn(async () => {
      throw new Error("down");
    });
    const host = { request } as unknown as HostClient;
    const { result } = setup("@", host);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(result.current.options.map((o) => o.insert)).toEqual(["@image1"]);
  });
});
