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
  routeNext = false,
  setModel = vi.fn(),
  pickRouter = vi.fn(),
} = {}) =>
  ({
    state: { ...state, routeNext },
    session,
    pickedModel,
    setModel,
    pickRouter,
  }) as unknown as ReturnType<typeof useAgentSession>;

it("shows the model and effort while Router is off", () => {
  render(
    <ComposerModelMenus
      session={fake()}
      modelRouter={{ on: false, onChange: vi.fn() }}
    />,
  );
  expect(screen.getByText("High")).toBeTruthy();
  expect(screen.getByText("Opus 5.5")).toBeTruthy();
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

it("picks a model, which turns Router off as the default", async () => {
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
  expect(onChange).toHaveBeenCalledWith(false);
});

it("shows the picked model, and Router takes the pick back", async () => {
  const pickRouter = vi.fn();
  const onChange = vi.fn();
  render(
    <ComposerModelMenus
      session={fake({ pickedModel: true, pickRouter })}
      modelRouter={{ on: true, onChange }}
    />,
  );
  fireEvent.click(screen.getByText("Opus 5.5"));
  fireEvent.click(await screen.findByText("Router"));
  expect(pickRouter).toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledWith(true);
});

it("offers Router in a conversation under way, whatever the default", async () => {
  const pickRouter = vi.fn();
  const onChange = vi.fn();
  render(
    <ComposerModelMenus
      session={fake({ session: "s1", pickRouter })}
      modelRouter={{ on: true, onChange }}
    />,
  );
  expect(screen.getByText("High")).toBeTruthy();
  fireEvent.click(screen.getByText("Opus 5.5"));
  fireEvent.click(await screen.findByText("Router"));
  expect(pickRouter).toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledWith(true);
});

it("reads Router in a conversation under way once its next message is routed", () => {
  render(
    <ComposerModelMenus
      session={fake({ session: "s1", routeNext: true })}
      modelRouter={{ on: false, onChange: vi.fn() }}
    />,
  );
  expect(screen.getByRole("button", { name: "Router" })).toBeTruthy();
  expect(screen.queryByText("High")).toBeNull();
});
