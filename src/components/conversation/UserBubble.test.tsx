import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { withComments } from "../../../shared/sentComments";
import { UserBubble } from "./UserBubble";

const message = (content: string) => ({
  role: "user" as const,
  content,
  timestamp: 0,
});

it("shows a message's diff comments as cards, not their text", () => {
  const sent = withComments("Look at these", [
    {
      path: "src/a.ts",
      lines: [{ kind: "del", num: 4, text: "old();" }],
      text: "Why remove it?",
    },
  ]);
  render(<UserBubble message={message(sent)} />);
  expect(screen.getByText("Look at these")).toBeTruthy();
  expect(screen.getByText("Why remove it?")).toBeTruthy();
  expect(screen.queryByText(/diff_comments/)).toBeNull();
  expect(screen.queryByText("old();")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /src\/a\.ts:4/ }));
  expect(screen.getByText("old();")).toBeTruthy();
});
