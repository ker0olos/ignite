import { describe, expect, it } from "vitest";
import type { McpServer } from "../../shared/hostProtocol";
import {
  EMPTY_FORM,
  describeServer,
  readForm,
  statusLabel,
  toForm,
  toolSummary,
} from "./mcpServers";

const local: McpServer = {
  name: "files",
  enabled: true,
  config: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@mcp/files", "/tmp/a b"],
    env: { ROOT: "/tmp", TOKEN: "${FILES_TOKEN}" },
  },
  tools: ["read"],
};
const remote: McpServer = {
  name: "docs",
  enabled: true,
  config: {
    type: "http",
    url: "https://mcp.example.com/mcp",
    headers: { Authorization: "Bearer abc" },
  },
  tools: [],
};

describe("toForm and readForm", () => {
  it("round-trip a local server", () => {
    const form = toForm(local);
    expect(form).toEqual({
      ...EMPTY_FORM,
      type: "stdio" as const,
      name: "files",
      command: "npx",
      args: "-y\n@mcp/files\n/tmp/a b",
      env: "ROOT=/tmp\nTOKEN=${FILES_TOKEN}",
    });
    expect(readForm(form, [])).toEqual({ name: "files", config: local.config });
  });

  it("round-trip a remote server", () => {
    const form = toForm(remote);
    expect(form).toEqual({
      ...EMPTY_FORM,
      name: "docs",
      type: "http",
      url: "https://mcp.example.com/mcp",
      headers: "Authorization: Bearer abc",
    });
    expect(readForm(form, [])).toEqual({ name: "docs", config: remote.config });
  });

  it("trims what was typed and skips blank lines", () => {
    expect(
      readForm(
        {
          ...EMPTY_FORM,
          type: "stdio" as const,
          name: " files ",
          command: " node ",
          args: " server.js \n\n --stdio",
          env: " A = 1=2 \n\n",
        },
        [],
      ),
    ).toEqual({
      name: "files",
      config: {
        type: "stdio",
        command: "node",
        args: ["server.js", "--stdio"],
        env: { A: "1=2" },
      },
    });
  });

  it("ignores the other transport's fields", () => {
    expect(
      readForm(
        {
          ...EMPTY_FORM,
          type: "stdio" as const,
          name: "x",
          command: "node",
          url: "?",
        },
        [],
      ),
    ).toMatchObject({ config: { type: "stdio" } });
  });

  it.each([
    [{ env: "NOEQUALS" }, "Write each variable as NAME=value."],
    [{ env: "=value" }, "Write each variable as NAME=value."],
    [
      { type: "http", url: "https://x.dev", headers: "Bearer" },
      "Write each header as Name: value.",
    ],
    [{ command: "" }, "Enter a command."],
    [{ name: "files" }, "There is already a server named files."],
  ] as const)("reports %j", (fields, problem) => {
    const form = {
      ...EMPTY_FORM,
      type: "stdio" as const,
      name: "x",
      command: "node",
      ...fields,
    };
    expect(readForm(form, ["files"])).toEqual({ problem });
  });
});

describe("statusLabel", () => {
  it.each([
    ["connected", "Connected"],
    ["idle", "Ready"],
    ["failed", "Couldn't connect"],
    ["needs-auth", "Needs sign-in"],
    ["disabled", "Off"],
  ] as const)("names %s", (status, label) => {
    expect(statusLabel({ ...local, status })).toBe(label);
  });

  it("says a server isn't running while no folder is open", () => {
    expect(statusLabel(local)).toBe("Not running");
    expect(statusLabel({ ...local, enabled: false })).toBe("Off");
  });
});

describe("describeServer", () => {
  it("shows the command line or the URL", () => {
    expect(describeServer(local)).toBe("npx -y @mcp/files /tmp/a b");
    expect(describeServer(remote)).toBe("https://mcp.example.com/mcp");
  });
});

describe("toolSummary", () => {
  it("counts the tools", () => {
    expect(toolSummary([])).toBe("No tools yet");
    expect(toolSummary(["read"])).toBe("1 tool");
    expect(toolSummary(["a", "b", "c", "d"])).toBe("4 tools");
  });
});
