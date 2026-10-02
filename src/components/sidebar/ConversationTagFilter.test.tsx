import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationTagFilter } from "./ConversationTagFilter";

describe("ConversationTagFilter", () => {
  it("opens to the tags, toggles one, and clears the filter", async () => {
    const onToggle = vi.fn();
    const onClear = vi.fn();
    render(
      <ConversationTagFilter
        tags={["bug", "design"]}
        selected={["bug"]}
        onToggle={onToggle}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByLabelText("Filter conversations"));
    expect(await screen.findByText("Filter conversations")).toBeTruthy();
    fireEvent.click(screen.getByText("design"));
    expect(onToggle).toHaveBeenCalledWith("design");
  });

  it("hides when no conversation has a tag", () => {
    const { container } = render(
      <ConversationTagFilter
        tags={[]}
        selected={[]}
        onToggle={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
