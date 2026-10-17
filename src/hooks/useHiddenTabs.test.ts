import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useHiddenTabs } from "./useHiddenTabs";

it("hides closed conversation tabs until one is reopened", () => {
  const { result } = renderHook(() => useHiddenTabs());
  act(() => result.current.hide("a"));
  act(() => result.current.hide("b"));
  expect(result.current.hidden).toEqual(["a", "b"]);
  act(() => result.current.reopen("a"));
  expect(result.current.hidden).toEqual(["b"]);
});
