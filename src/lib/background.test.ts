import { describe, expect, it } from "vitest";
import { backgroundState, promptLine } from "./background";

const shown = { command: "npm run dev", output: "", truncated: false };

describe("backgroundState", () => {
  it("says whether it runs, or how it ended", () => {
    expect(backgroundState(null, 42)).toBe("pid 42");
    expect(backgroundState({ ...shown, running: true }, 42)).toBe(
      "Running · pid 42",
    );
    expect(backgroundState({ ...shown, running: false, exitCode: 1 }, 42)).toBe(
      "Exited with code 1",
    );
    expect(backgroundState({ ...shown, running: false }, 42)).toBe("Stopped");
  });
});

describe("promptLine", () => {
  it("colors the prompt and the program, leaving its arguments plain", () => {
    expect(promptLine(" npm run dev")).toBe(
      "\x1b[35m❯\x1b[0m \x1b[32mnpm\x1b[0m run dev",
    );
    expect(promptLine("ls")).toBe("\x1b[35m❯\x1b[0m \x1b[32mls\x1b[0m");
  });
});
