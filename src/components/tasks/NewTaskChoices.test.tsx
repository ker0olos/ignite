import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { SessionState } from "../../../shared/hostProtocol";
import { NewTaskChoices } from "./NewTaskChoices";

const opus = {
  provider: "anthropic",
  id: "claude-opus-5-5",
  name: "Claude Opus 5.5",
};
const state = {
  models: [opus],
  model: opus,
  thinkingLevel: "high",
  thinkingLevels: ["off", "high"],
} as unknown as SessionState;

const choices = (routed: boolean, onRouter = vi.fn()) =>
  render(
    <NewTaskChoices
      state={state}
      routed={routed}
      onRouter={onRouter}
      onModel={vi.fn()}
      onEffort={vi.fn()}
    />,
  );

it("reads Router by default, hiding the effort it picks", () => {
  choices(true);
  expect(screen.getByRole("button", { name: "Router" })).toBeTruthy();
  expect(screen.queryByText("High")).toBeNull();
});

it("shows the picked model and effort, and Router takes the pick back", async () => {
  const onRouter = vi.fn();
  choices(false, onRouter);
  expect(screen.getByText("High")).toBeTruthy();
  fireEvent.click(screen.getByText("Opus 5.5"));
  fireEvent.click(await screen.findByText("Router"));
  expect(onRouter).toHaveBeenCalled();
});
