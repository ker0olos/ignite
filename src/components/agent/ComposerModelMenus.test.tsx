import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { SessionState } from "../../../shared/hostProtocol";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { ComposerModelMenus } from "./ComposerModelMenus";

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

/** A conversation about to start by default; `session` names one under way. */
const fake = ({
  session = null as string | null,
  pickedModel = false,
  setModel = vi.fn(),
  unpickModel = vi.fn(),
} = {}) =>
  ({
    state,
    session,
    pickedModel,
    setModel,
    unpickModel,
  }) as unknown as ReturnType<typeof useAgentSession>;

it("shows the model and effort, and no Router item without a handler", () => {
  render(<ComposerModelMenus session={fake()} modelRouter={undefined} />);
  expect(screen.getByText("High")).toBeTruthy();
  fireEvent.click(screen.getByText("Opus 5.5"));
  expect(screen.queryByText("Router")).toBeNull();
});

it("reads Router for a new conversation, hiding the effort it picks", () => {
  render(
    <ComposerModelMenus
      session={fake()}
      modelRouter={{ on: true, onChange: vi.fn() }}
    />,
  );
  expect(screen.getByRole("button", { name: "Router" })).toBeTruthy();
  expect(screen.queryByText("High")).toBeNull();
});

it("shows effort again once the user picks the model", () => {
  render(
    <ComposerModelMenus
      session={fake({ pickedModel: true })}
      modelRouter={{ on: true, onChange: vi.fn() }}
    />,
  );
  expect(screen.getByText("High")).toBeTruthy();
});

it("picks a model for this conversation only, leaving the setting on", async () => {
  const setModel = vi.fn();
  const onChange = vi.fn();
  render(
    <ComposerModelMenus
      session={fake({ setModel })}
      modelRouter={{ on: true, onChange }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Router" }));
  fireEvent.click(await screen.findByText("Opus 5.5"));
  expect(setModel).toHaveBeenCalledWith(expect.objectContaining(opus));
  expect(onChange).not.toHaveBeenCalled();
});

it("shows the picked model, and Router takes the pick back", async () => {
  const unpickModel = vi.fn();
  const onChange = vi.fn();
  render(
    <ComposerModelMenus
      session={fake({ pickedModel: true, unpickModel })}
      modelRouter={{ on: true, onChange }}
    />,
  );
  fireEvent.click(screen.getByText("Opus 5.5"));
  fireEvent.click(await screen.findByText("Router"));
  expect(unpickModel).toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledWith(true);
});

it("shows what a conversation under way runs on, with no Router item", () => {
  render(
    <ComposerModelMenus
      session={fake({ session: "s1" })}
      modelRouter={{ on: true, onChange: vi.fn() }}
    />,
  );
  fireEvent.click(screen.getByText("Opus 5.5"));
  expect(screen.queryByText("Router")).toBeNull();
});
