import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RemoteDevices } from "./RemoteDevices";

it("shows nothing with no devices, else how many, opening settings when clicked", () => {
  const onClick = vi.fn();
  const { container, rerender } = render(
    <RemoteDevices count={0} onClick={onClick} />,
  );
  expect(container.innerHTML).toBe("");

  rerender(<RemoteDevices count={1} onClick={onClick} />);
  fireEvent.click(screen.getByText("1 device connected"));
  expect(onClick).toHaveBeenCalled();

  rerender(<RemoteDevices count={3} onClick={onClick} />);
  expect(screen.getByText("3 devices connected")).toBeTruthy();
});
