// @vitest-environment node
import { expect, it } from "vitest";
import { headlessTerminal } from "./ptyShell.ts";

it("counts an emoji two columns wide, as the app's terminals do", async () => {
  const screen = headlessTerminal({ cols: 20, rows: 2 });
  await new Promise<void>((done) => screen.write("🚀x", done));
  expect(screen.buffer.active.cursorX).toBe(3);
  screen.dispose();
});
