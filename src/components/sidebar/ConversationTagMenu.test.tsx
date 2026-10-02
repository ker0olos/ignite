import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationTagMenu } from "./ConversationTagMenu";

async function open(tags: string[], allTags: string[]) {
  const onSave = vi.fn();
  render(
    <ConversationTagMenu
      title="Fix"
      tags={tags}
      allTags={allTags}
      onSave={onSave}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Tags for Fix" }));
  const input = await screen.findByLabelText("Add a tag");
  const type = (value: string) =>
    fireEvent.change(input, { target: { value } });
  return { onSave, input, type };
}

describe("ConversationTagMenu", () => {
  it("adds a typed tag on Enter", async () => {
    const { onSave, input, type } = await open(["bug"], []);
    type("design");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith(["bug", "design"]);
  });

  it("adds tags at a comma, and removes the last on Backspace", async () => {
    const { onSave, input, type } = await open(["bug"], []);
    type("a, b");
    expect(onSave).toHaveBeenLastCalledWith(["a", "b", "bug"]);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onSave).toHaveBeenLastCalledWith([]);
  });

  it("removes a tag with its ×", async () => {
    const { onSave } = await open(["bug", "ui"], []);
    fireEvent.click(screen.getByRole("button", { name: "Remove bug" }));
    expect(onSave).toHaveBeenCalledWith(["ui"]);
  });

  it("adds a suggestion, offering only unused ones that match the text", async () => {
    const { onSave, type } = await open(["bug"], ["bug", "design", "later"]);
    expect(screen.getByText("Suggestions")).toBeTruthy();
    type("des");
    expect(screen.queryByRole("button", { name: "later" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "design" }));
    expect(onSave).toHaveBeenCalledWith(["bug", "design"]);
  });

  it("hides suggestions when there are none", async () => {
    await open(["bug"], ["bug"]);
    expect(screen.queryByText("Suggestions")).toBeNull();
  });
});
