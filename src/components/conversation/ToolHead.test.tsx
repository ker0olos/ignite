import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ToolHead } from "./ToolHead";

it("shows the argument on one line, all of it when clicked, and back", () => {
  const command = "cd server && cat > scripts/_probe.ts <<'EOF'\nimport x\nEOF";
  render(<ToolHead title="Bash" arg={command} folder="/repo" />);
  const arg = screen.getByRole("button");
  const text = () => arg.firstElementChild!.className;
  expect(text()).toContain("line-clamp-1");
  fireEvent.click(arg);
  expect(arg.getAttribute("aria-expanded")).toBe("true");
  expect(text()).toContain("whitespace-pre-wrap");
  fireEvent.click(arg);
  expect(text()).toContain("line-clamp-1");
});

it("is plain text without an argument, and names an MCP call's server", () => {
  render(<ToolHead title="Get issue" server="Sentry" arg="" folder="/repo" />);
  expect(screen.queryByRole("button")).toBe(null);
  expect(screen.getByText("Get issue")).toBeTruthy();
  expect(screen.getByText("Sentry")).toBeTruthy();
});
