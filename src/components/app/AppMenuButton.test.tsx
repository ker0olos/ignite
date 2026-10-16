import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppMenuButton } from "@/components/app/AppMenuButton";

describe("AppMenuButton", () => {
  it("lists entries with shortcuts and runs one when clicked", async () => {
    const action = vi.fn();
    render(
      <AppMenuButton
        entries={[
          { label: "Open Folder", shortcut: "Ctrl+O", action },
          { label: "Settings", shortcut: "Ctrl+,", action: vi.fn() },
          "separator",
          { label: "Open Recent", items: [{ label: "Clear", enabled: false }] },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByText("Ctrl+O")).toBeTruthy();
    expect(screen.getByText("Open Recent")).toBeTruthy();
    expect(screen.queryByText("Settings")).toBeNull();
    fireEvent.click(screen.getByText("Open Folder"));
    expect(action).toHaveBeenCalledOnce();
  });
});
