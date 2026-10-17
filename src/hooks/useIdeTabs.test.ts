import { renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { childTabId } from "@/lib/childTabs";
import { useIdeTabs } from "./useIdeTabs";

const t1 = childTabId({ kind: "terminal", session: "", terminal: "t1" });
const files = ["/f/a.ts", t1];

it("keeps the file in front while the panel's terminal is active", () => {
  const { result, rerender } = renderHook(
    ({ active }) => useIdeTabs({ files, active }, true),
    { initialProps: { active: "/f/a.ts" as string | null } },
  );
  expect(result.current.front).toBe("/f/a.ts");
  rerender({ active: t1 });
  expect(result.current).toMatchObject({ front: "/f/a.ts", panel: t1 });
  expect(result.current.kept).toBe("/f/a.ts");
  // The conversation in front is kept the same way.
  rerender({ active: null });
  rerender({ active: t1 });
  expect(result.current.front).toBeNull();
});
