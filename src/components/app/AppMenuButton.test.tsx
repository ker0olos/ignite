import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppMenuButton } from "@/components/app/AppMenuButton";

describe("AppMenuButton", () => {
  it("lists entries with shortcuts and runs one when clicked", async () => {
    const action = vi.fn();
    render(
      <AppMenuButton
        entries={[
          { label: "Settings", shortcut: "Ctrl+,", action },
          "separator",
          { label: "Open Recent", items: [{ label: "Clear", enabled: false }] },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByText("Ctrl+,")).toBeTruthy();
    expect(screen.getByText("Open Recent")).toBeTruthy();
    fireEvent.click(screen.getByText("Settings"));
    expect(action).toHaveBeenCalledOnce();
  });
});
