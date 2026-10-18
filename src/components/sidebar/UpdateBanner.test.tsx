import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdateBanner } from "./UpdateBanner";

describe("UpdateBanner", () => {
  it("shows nothing until an update is found", () => {
    const { container } = render(
      <UpdateBanner update="checking" warning={null} onRestart={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows the install, then the restart once it's ready", () => {
    const onRestart = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <UpdateBanner update="installing" warning={null} onRestart={onRestart} />,
    );
    expect(screen.queryByText("Installing update…")).not.toBeNull();
    expect(screen.queryByText("Restart")).toBeNull();

    rerender(
      <UpdateBanner
        update="ready"
        warning="Unverified"
        onRestart={onRestart}
      />,
    );
    expect(screen.queryByText("Unverified")).not.toBeNull();
    fireEvent.click(screen.getByText("Restart"));
    expect(onRestart).toHaveBeenCalled();
  });

  it("stays dismissed until the update moves on", () => {
    const { rerender, container } = render(
      <UpdateBanner update="installing" warning={null} onRestart={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(container.innerHTML).toBe("");

    rerender(
      <UpdateBanner update="ready" warning={null} onRestart={vi.fn()} />,
    );
    expect(screen.queryByText("Update ready")).not.toBeNull();
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(container.innerHTML).toBe("");
  });
});
