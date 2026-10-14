import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import { useApplyIconTheme, useIconTheme } from "./useIconTheme";

fakeFs(
  {
    "/me/.vscode/extensions/p.min/package.json": JSON.stringify({
      publisher: "p",
      name: "min",
      contributes: { iconThemes: [{ id: "t", label: "T", path: "t.json" }] },
    }),
    "/me/.vscode/extensions/p.min/t.json": JSON.stringify({
      iconDefinitions: {},
      file: "f",
    }),
  },
  (cmd) => (cmd === "plugin:path|resolve_directory" ? "/me" : null),
);

describe("useIconTheme", () => {
  it("loads the chosen theme, and falls back when it's gone", async () => {
    const { result, rerender } = renderHook(
      ({ id }) => (useApplyIconTheme(id), useIconTheme()),
      { initialProps: { id: "p.min/t" } },
    );
    await waitFor(() => expect(result.current.theme?.file.file).toBe("f"));
    rerender({ id: "p.gone/t" });
    await waitFor(() => expect(result.current.theme).toBeNull());
    rerender({ id: "p.min/t" });
    await waitFor(() => expect(result.current.theme).not.toBeNull());
    rerender({ id: "minimal" });
    await waitFor(() => expect(result.current.theme).toBeNull());
  });

  it("follows light and dark mode", async () => {
    const { result } = renderHook(() => useIconTheme());
    expect(result.current.light).toBe(true);
    act(() => document.documentElement.classList.add("dark"));
    await waitFor(() => expect(result.current.light).toBe(false));
    document.documentElement.classList.remove("dark");
  });
});
