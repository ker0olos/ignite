import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOpenFile } from "./useOpenFile";

type Props = {
  current: string | null;
  session?: string | null;
  root?: string | null;
};

function setup(initialProps: Props) {
  const openTab = vi.fn();
  const select = vi.fn();
  const hook = renderHook(
    ({ current, session = null, root = current }: Props) =>
      useOpenFile(current, { session, root }, openTab, select),
    { initialProps },
  );
  return { openTab, select, ...hook };
}

describe("useOpenFile", () => {
  it("opens a file of the current folder at once", () => {
    const { result, openTab, select } = setup({ current: "/work" });
    act(() => result.current("/work", "/work/src/a.ts"));
    expect(openTab).toHaveBeenCalledWith("/work/src/a.ts");
    expect(select).not.toHaveBeenCalled();
  });

  it("selects another folder first, then opens the file once it's shown", () => {
    const { result, rerender, openTab, select } = setup({ current: "/work" });
    act(() => result.current("/other", "/other/src/b.ts"));
    expect(select).toHaveBeenCalledWith("/other");
    expect(openTab).not.toHaveBeenCalled();

    rerender({ current: "/other" });
    expect(openTab).toHaveBeenCalledWith("/other/src/b.ts");
    expect(openTab).toHaveBeenCalledTimes(1);
  });

  it("clears the pending file after opening it, so returning to the folder doesn't reopen it", () => {
    const { result, rerender, openTab } = setup({ current: "/work" });
    act(() => result.current("/other", "/other/src/b.ts"));
    rerender({ current: "/other" });
    expect(openTab).toHaveBeenCalledTimes(1);
    rerender({ current: "/third" });
    rerender({ current: "/other" });
    expect(openTab).toHaveBeenCalledTimes(1);
  });

  it("waits for a folder to become current before opening the pending file", () => {
    const { result, rerender, openTab, select } = setup({ current: null });
    act(() => result.current("/other", "/other/src/b.ts"));
    expect(select).toHaveBeenCalledWith("/other");
    rerender({ current: null });
    expect(openTab).not.toHaveBeenCalled();
    rerender({ current: "/other" });
    expect(openTab).toHaveBeenCalledWith("/other/src/b.ts");
  });

  it("waits for the named conversation to show before opening", () => {
    const { result, rerender, openTab, select } = setup({
      current: "/work",
      session: "a",
    });
    act(() => result.current("/work", "child:b", "b"));
    expect(openTab).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    rerender({ current: "/work", session: null });
    expect(openTab).not.toHaveBeenCalled();
    rerender({ current: "/work", session: "b" });
    expect(openTab).toHaveBeenCalledWith("child:b");
  });

  it("drops a conversation's tab once another conversation shows instead", () => {
    const { result, rerender, openTab } = setup({
      current: "/work",
      session: "a",
    });
    act(() => result.current("/work", "child:b", "b"));
    rerender({ current: "/work", session: "c" });
    rerender({ current: "/work", session: "b" });
    expect(openTab).not.toHaveBeenCalled();
  });

  it("makes the tab from the shown conversation's root", async () => {
    const { result, rerender, openTab } = setup({ current: "/work" });
    act(() => result.current("/other", (root) => `${root}/b.ts`));
    rerender({ current: "/other", root: "/wt/x" });
    await waitFor(() => expect(openTab).toHaveBeenCalledWith("/wt/x/b.ts"));
  });
});
