import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { SessionState } from "../../../shared/hostProtocol";
import { ModelChoices } from "./ModelChoices";

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

const choices = (routed: boolean) => {
  const props = {
    onRouter: vi.fn(),
    onModel: vi.fn(),
    onChange: vi.fn(),
  };
  render(
    <ModelChoices
      state={state}
      routed={routed}
      modelRouter={{ on: routed, onChange: props.onChange }}
      onRouter={props.onRouter}
      onModel={props.onModel}
      onEffort={vi.fn()}
    />,
  );
  return props;
};

it("reads Router, hiding the effort it picks", () => {
  choices(true);
  expect(screen.getByRole("button", { name: "Router" })).toBeTruthy();
  expect(screen.queryByText("High")).toBeNull();
});

it("makes a picked model the default, turning Router off", async () => {
  const { onModel, onChange } = choices(true);
  fireEvent.click(screen.getByRole("button", { name: "Router" }));
  fireEvent.click(await screen.findByText("Opus 5.5"));
  expect(onModel).toHaveBeenCalledWith(expect.objectContaining(opus));
  expect(onChange).toHaveBeenCalledWith(false);
});

it("shows the model and effort, and Router turns it back on", async () => {
  const { onRouter, onChange } = choices(false);
  expect(screen.getByText("High")).toBeTruthy();
  fireEvent.click(screen.getByText("Opus 5.5"));
  fireEvent.click(await screen.findByText("Router"));
  expect(onRouter).toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledWith(true);
});
