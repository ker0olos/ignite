import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CompactionRow } from "./CompactionRow";

it("shows how much was compacted, and the summary when opened", () => {
  render(
    <CompactionRow
      row={{ kind: "compaction", summary: "Did X.", tokensBefore: 84_000 }}
    />,
  );
  expect(screen.queryByText("Did X.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Compacted 84k tokens" }));
  expect(screen.getByText("Did X.")).toBeTruthy();
});

it("fills a bar as the summary is written while it runs", () => {
  const { rerender } = render(<CompactionRow row={{ kind: "compaction" }} />);
  const bar = screen.getByRole("progressbar");
  expect(bar.getAttribute("aria-valuenow")).toBe("0");
  expect(screen.queryByText(/tokens/)).toBeNull();
  rerender(<CompactionRow row={{ kind: "compaction", written: 2000 }} />);
  expect(bar.getAttribute("aria-valuenow")).toBe("60");
  expect(screen.getByText("2k tokens")).toBeTruthy();
});
