import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useStartedConversation } from "./useStartedConversation";

it("records the conversation a folder's first message started, never with no folder", () => {
  const { result, rerender } = renderHook(
    ({ folder }) => useStartedConversation(folder),
    { initialProps: { folder: "/work" as string | null } },
  );
  expect(result.current.started).toBeNull();
  act(() => result.current.onBegin("s1", "/wt/s1"));
  expect(result.current.started).toEqual({
    folder: "/work",
    session: "s1",
    workdir: "/wt/s1",
  });
  rerender({ folder: null });
  act(() => result.current.onBegin("s2", "/wt/s2"));
  expect(result.current.started?.session).toBe("s1");
});
