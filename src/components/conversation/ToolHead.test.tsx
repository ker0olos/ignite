import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ToolHead } from "./ToolHead";

it("shows the whole argument when clicked, and truncates it again", () => {
  const command = "cd server && cat > scripts/_probe.ts <<'EOF'\nimport x\nEOF";
  render(<ToolHead run={undefined} title="Bash" arg={command} />);
  const head = screen.getByRole("button", { name: /Bash/ });
  expect(head.className).toContain("truncate");
  fireEvent.click(head);
  expect(head.getAttribute("aria-expanded")).toBe("true");
  expect(head.className).toContain("whitespace-pre-wrap");
  fireEvent.click(head);
  expect(head.className).toContain("truncate");
});

it("is plain text without an argument", () => {
  render(<ToolHead run={undefined} title="Questions" arg="" />);
  expect(screen.queryByRole("button")).toBe(null);
});
