import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdateToast } from "./UpdateToast";

describe("UpdateToast", () => {
  it("shows nothing until an update is found", () => {
    const { container } = render(
      <UpdateToast update="checking" warning={null} onRestart={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows the install, then the restart once it's ready", () => {
    const onRestart = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <UpdateToast update="installing" warning={null} onRestart={onRestart} />,
    );
    expect(screen.queryByText("Installing update…")).not.toBeNull();
    expect(screen.queryByText("Restart to update")).toBeNull();

    rerender(
      <UpdateToast update="ready" warning="Unverified" onRestart={onRestart} />,
    );
    expect(screen.queryByText("Unverified")).not.toBeNull();
    fireEvent.click(screen.getByText("Restart to update"));
    expect(onRestart).toHaveBeenCalled();
  });

  it("stays dismissed until the update moves on", () => {
    const { rerender, container } = render(
      <UpdateToast update="installing" warning={null} onRestart={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(container.innerHTML).toBe("");

    rerender(<UpdateToast update="ready" warning={null} onRestart={vi.fn()} />);
    fireEvent.click(screen.getByText("Later"));
    expect(container.innerHTML).toBe("");
  });
});
