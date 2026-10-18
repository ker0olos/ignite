import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UserMessage } from "../../../shared/agentTypes";
import { MessageEditContext, type MessageEdit } from "./shared";
import { UserMessageRow } from "./UserMessageRow";

const MESSAGE: UserMessage = {
  role: "user",
  content: "Fix it",
  timestamp: 1,
  entryId: "u1",
};

function show(
  editable: boolean,
  edit: Partial<MessageEdit> | null = {},
  message: UserMessage = MESSAGE,
  sticky = false,
) {
  const value = edit && {
    edit: vi.fn(async () => true),
    disabled: false,
    ...edit,
  };
  render(
    <MessageEditContext.Provider value={value}>
      <UserMessageRow message={message} sticky={sticky} editable={editable} />
    </MessageEditContext.Provider>,
  );
  return value;
}

const button = () => screen.queryByRole("button", { name: "Edit message" });

describe("UserMessageRow", () => {
  it("edits the message in place and sends it on Enter", async () => {
    const edit = show(true);
    fireEvent.click(button()!);
    const box = screen.getByRole("textbox", { name: "Edit message" });
    expect((box as HTMLTextAreaElement).value).toBe("Fix it");
    fireEvent.change(box, { target: { value: "Fix it well" } });
    await act(async () => void fireEvent.keyDown(box, { key: "Enter" }));
    expect(edit!.edit).toHaveBeenCalledWith("u1", "Fix it well", []);
    expect(screen.getByText("Fix it")).toBeTruthy();
  });

  it("cancels with its button, and sends with Send", async () => {
    const edit = show(true);
    fireEvent.click(button()!);
    fireEvent.click(screen.getByRole("button", { name: /^Cancel/ }));
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(button()!);
    await act(
      async () =>
        void fireEvent.click(screen.getByRole("button", { name: /^Send/ })),
    );
    expect(edit!.edit).toHaveBeenCalledWith("u1", "Fix it", []);
  });

  it("turns Edit off while the conversation isn't idle", () => {
    show(true, { disabled: true });
    expect((button() as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers no Edit on a message that isn't editable, or outside the shown conversation", () => {
    show(false);
    expect(button()).toBeNull();
  });

  it("offers no Edit without a conversation to rewind", () => {
    show(true, null);
    expect(button()).toBeNull();
  });

  it("offers Edit beside a message of only images, and keeps them while editing", () => {
    const image = {
      type: "image" as const,
      data: "AA==",
      mimeType: "image/png",
    };
    show(true, {}, { ...MESSAGE, content: [image] }, true);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    fireEvent.click(button()!);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(
      (screen.getByRole("button", { name: /^Send/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
