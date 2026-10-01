import { describe, expect, it } from "vitest";
import { backgroundState } from "./background";

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
