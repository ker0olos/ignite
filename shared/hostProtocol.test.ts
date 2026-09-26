import { describe, expect, it } from "vitest";
import {
  apiKeyProblem,
  mcpServerProblem,
  type McpServerConfig,
} from "./hostProtocol.ts";

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

describe("mcpServerProblem", () => {
  const stdio = (command: string): McpServerConfig => ({
    type: "stdio",
    command,
    args: [],
    env: {},
  });
  const http = (url: string): McpServerConfig => ({
    type: "http",
    url,
    headers: {},
  });

  it("accepts a named command or web URL", () => {
    expect(mcpServerProblem("docs", stdio("npx"), [])).toBeNull();
    expect(mcpServerProblem("a_b-2", http("https://x.dev/mcp"), [])).toBeNull();
    expect(
      mcpServerProblem("local", http("http://localhost:3000"), []),
    ).toBeNull();
  });

  it.each([
    ["", stdio("npx"), "Enter a name."],
    [
      "my docs",
      stdio("npx"),
      "Use only letters, numbers, - and _ in the name.",
    ],
    ["docs", stdio("npx"), "There is already a server named docs."],
    ["x", stdio("  "), "Enter a command."],
    ["x", http("not a url"), "Enter an http:// or https:// URL."],
    ["x", http("file:///etc/passwd"), "Enter an http:// or https:// URL."],
  ])("refuses %j", (name, config, problem) => {
    expect(mcpServerProblem(name, config, ["docs"])).toBe(problem);
  });
});
