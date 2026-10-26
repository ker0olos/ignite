import { describe, expect, it } from "vitest";
import type { ToolCall } from "../../shared/agentTypes";
import { serverName, tileClass, tileTone, toolIcon } from "./toolIcon";

const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({
  type: "toolCall",
  id: "1",
  name,
  arguments: args,
});

describe("tileTone", () => {
  it("puts near-black brands on the page's colour, light ones on the card, the rest on their own", () => {
    expect(tileTone("181717")).toBe("inverse");
    expect(tileTone("000000")).toBe("inverse");
    expect(tileTone("3FCF8E")).toBe("card");
    expect(tileTone("5E6AD2")).toBe("brand");
    expect(tileTone("362D59")).toBe("brand");
  });
});

describe("toolIcon", () => {
  it("gives an MCP server its brand mark", () => {
    const icon = toolIcon(call("mcp__github", { tool: "get_issue" }));
    expect(icon).toMatchObject({
      kind: "brand",
      tone: "inverse",
      hex: "#181717",
    });
    const linear = toolIcon(call("mcp", { server: "Linear", tool: "x" }));
    expect(linear).toMatchObject({ kind: "brand", tone: "brand" });
  });

  it("matches a server by part of its name, and gives Lucide marks their colour", () => {
    expect(toolIcon(call("mcp__my-github-mcp", { tool: "x" })).kind).toBe(
      "brand",
    );
    expect(toolIcon(call("mcp__context7", { tool: "x" }))).toMatchObject({
      kind: "lucide",
      color: "#00E9A3",
    });
  });

  it("uses a plug for unknown servers and MCP housekeeping", () => {
    const plug = toolIcon(call("mcp__nothing", { tool: "x" }));
    expect(plug).toMatchObject({ kind: "lucide" });
    expect((plug as { color?: string }).color).toBeUndefined();
    expect(toolIcon(call("mcp", {}))).toEqual(plug);
  });

  it("gives gh the GitHub mark and built-in tools Lucide glyphs", () => {
    expect(toolIcon(call("gh"))).toMatchObject({
      kind: "brand",
      hex: "#181717",
    });
    expect(toolIcon(call("bash"))).toMatchObject({
      kind: "lucide",
      plain: true,
    });
    expect(toolIcon(call("grep"))).toEqual(toolIcon(call("find")));
    expect(toolIcon(call("chrome_eval"))).not.toEqual(
      toolIcon(call("memory_get")),
    );
    expect(toolIcon(call("something_else"))).not.toHaveProperty("plain");
    expect(toolIcon(call("mcp__nothing", { tool: "x" }))).not.toHaveProperty(
      "plain",
    );
  });
});

describe("serverName", () => {
  it("is the brand's title when known, else the server's name", () => {
    expect(serverName("github")).toBe("GitHub");
    expect(serverName("context7")).toBe("context7");
    expect(serverName("acme")).toBe("acme");
  });
});

describe("tileClass", () => {
  it("fills a tile by its icon", () => {
    expect(tileClass(toolIcon(call("bash")))).toBe("bg-muted");
    expect(tileClass(toolIcon(call("gh")))).toBe("bg-primary");
  });
});
