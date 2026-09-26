import { describe, expect, it } from "vitest";
import { apiKeyProblem } from "./hostProtocol.ts";

describe("apiKeyProblem", () => {
  it("accepts a normal key, with surrounding whitespace", () => {
    expect(apiKeyProblem("  sk-ant-api03-abc_DEF-123 ")).toBeNull();
  });

  it("asks for a key when empty", () => {
    expect(apiKeyProblem("   ")).toBe("Enter an API key.");
  });

  it.each(["!security find-generic-password", "$OPENAI_API_KEY", "sk-${X}"])(
    "refuses %s, which pi would run or expand",
    (key) => {
      expect(apiKeyProblem(key)).toBe("That doesn't look like an API key.");
    },
  );

  it("refuses spaces inside a key", () => {
    expect(apiKeyProblem("sk abc")).toBe("API keys can't contain spaces.");
  });
});
