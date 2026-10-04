import { describe, expect, it } from "vitest";
import type { AgentMessage } from "./agentTypes.ts";
import { firstTitle, titleOf } from "./conversations.ts";

describe("firstTitle", () => {
  it("names a conversation after the first line of its first message", () => {
    expect(
      firstTitle([
        { role: "assistant", content: [] } as unknown as AgentMessage,
        { role: "user", content: "  Fix login\nsecond line", timestamp: 1 },
        { role: "user", content: "later", timestamp: 2 },
      ]),
    ).toBe("Fix login");
    expect(
      firstTitle([
        {
          role: "user",
          content: [
            { type: "image", data: "", mimeType: "image/png" },
            { type: "text", text: "What's this?" },
          ],
          timestamp: 1,
        },
      ]),
    ).toBe("What's this?");
    expect(
      firstTitle([{ role: "user", content: "x".repeat(200), timestamp: 1 }]),
    ).toHaveLength(80);
  });

  it("leaves a conversation with no message untitled", () => {
    expect(firstTitle([])).toBe("");
    expect(titleOf(undefined)).toBe("");
  });
});
