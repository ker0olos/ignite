import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppMenuButton } from "@/components/app/AppMenuButton";

const entries = (action = vi.fn()) => [
  {
    label: "File",
    items: [
      { label: "Open Folder", shortcut: "Ctrl+O", action },
      { label: "Settings", shortcut: "Ctrl+,", action: vi.fn() },
      "separator" as const,
      { label: "Open Recent", items: [{ label: "Clear", enabled: false }] },
    ],
  },
  { label: "View", items: [{ label: "Reload", action: vi.fn() }] },
];

describe("AppMenuButton", () => {
  it("unfolds into the menu bar with its first menu open", async () => {
    render(<AppMenuButton entries={entries()} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("menuitem", { name: "File" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "View" })).toBeTruthy();
    expect(await screen.findByText("Ctrl+O")).toBeTruthy();
    expect(screen.getByText("Open Recent")).toBeTruthy();
    // Settings has its own button beside the menu.
    expect(screen.queryByText("Settings")).toBeNull();
  });

  it("runs an item, then folds back into the button", async () => {
    vi.useFakeTimers();
    const action = vi.fn();
    render(<AppMenuButton entries={entries(action)} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByText("Open Folder"));
    expect(action).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.getByRole("button", { name: "Menu" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "File" })).toBeNull();
    vi.useRealTimers();
  });
});
