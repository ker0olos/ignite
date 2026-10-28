import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AWAY_DENIED } from "../../../shared/hostProtocol";
import { ToolError } from "./ToolError";

it("says a call was denied while the user was away, not what the agent was told", () => {
  render(<ToolError text={AWAY_DENIED} />);
  expect(screen.getByText("Denied while you were away")).toBeTruthy();
  expect(screen.queryByText(/carry on/)).toBe(null);
});

it("keeps a blocked command's report above it", () => {
  render(<ToolError text={`Sandbox blocked api.x.dev\n\n${AWAY_DENIED}`} />);
  expect(screen.getByText("Sandbox blocked api.x.dev")).toBeTruthy();
  expect(screen.getByText("Denied while you were away")).toBeTruthy();
  expect(screen.queryByText(/carry on/)).toBe(null);
});

it("shows any other error as it is", () => {
  render(<ToolError text="ECONNRESET" />);
  expect(screen.getByText("ECONNRESET")).toBeTruthy();
});
