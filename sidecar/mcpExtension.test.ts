// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMcpAdapter } from "pi-mcp-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCP_AUTH_URL_EVENT,
  MCP_SIGN_IN_COMMAND,
  MCP_SIGN_OUT_COMMAND,
  writeMcpFile,
} from "./mcpConfig.ts";
import mcp, { asApp, closingConnections } from "./mcpExtension.ts";
import { cmemServer } from "./cmem.ts";
import { APP_TITLE } from "../src/lib/app.ts";

const install = vi.fn();
vi.mock("pi-mcp-adapter", () => ({ createMcpAdapter: vi.fn(() => install) }));
vi.mock("./cmem.ts", () => ({ cmemServer: vi.fn(async () => ({})) }));
const authenticate = vi.fn();
const removeAuth = vi.fn();
vi.mock("../node_modules/pi-mcp-adapter/mcp-auth-flow.ts", () => ({
  authenticate,
  removeAuth,
}));

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "mcp-ext-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", dir);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

type Handler = (args: string, ctx: unknown) => Promise<void>;
const commands = new Map<string, Handler>();
const emit = vi.fn();
const pi = {
  registerCommand: (name: string, options: { handler: Handler }) =>
    commands.set(name, options.handler),
  events: { emit },
} as unknown as ExtensionAPI;

it("installs the adapter with the app's servers only", async () => {
  await writeMcpFile(join(dir, "mcp.json"), {
    mcpServers: { docs: { command: "npx" } },
    imports: ["cursor"],
  });
  await mcp(pi);
  expect(createMcpAdapter).toHaveBeenCalledWith({
    config: { mcpServers: { docs: { command: "npx" } } },
  });
  expect(install).toHaveBeenCalledOnce();
});

it("gives the adapter's tools a reason the tools never see", async () => {
  const registerTool = vi.fn();
  await mcp({ ...pi, registerTool } as ExtensionAPI);
  const adapterPi = install.mock.calls.at(-1)![0] as ExtensionAPI;
  const execute = vi.fn();
  adapterPi.registerTool({
    name: "mcp",
    parameters: { type: "object", properties: {} },
    execute,
  } as never);
  const tool = registerTool.mock.calls[0][0];
  expect(tool.parameters.properties).toHaveProperty("reason");
  await tool.execute("id", { tool: "x", reason: "why" });
  expect(execute).toHaveBeenCalledWith("id", { tool: "x" });
});

it("installs it with no servers before any are added", async () => {
  await mcp(pi);
  expect(createMcpAdapter).toHaveBeenCalledWith({
    config: { mcpServers: {} },
  });
});

it("adds cmem's server, letting a saved one of that name win", async () => {
  vi.mocked(cmemServer).mockResolvedValue({
    cmem: { command: "node", lifecycle: "eager" },
  });
  await mcp(pi);
  expect(createMcpAdapter).toHaveBeenLastCalledWith({
    config: { mcpServers: { cmem: { command: "node", lifecycle: "eager" } } },
  });
  await writeMcpFile(join(dir, "mcp.json"), {
    mcpServers: { cmem: { command: "mine" } },
  });
  await mcp(pi);
  expect(createMcpAdapter).toHaveBeenLastCalledWith({
    config: { mcpServers: { cmem: { command: "mine" } } },
  });
  vi.mocked(cmemServer).mockResolvedValue({});
});

describe("the sign-in command", () => {
  const notify = vi.fn();
  const signIn = async (name: string) => {
    await mcp(pi);
    await commands.get(MCP_SIGN_IN_COMMAND)!(name, {
      signal: undefined,
      ui: { notify },
    });
  };
  beforeEach(async () => {
    notify.mockClear();
    authenticate.mockReset();
    await writeMcpFile(join(dir, "mcp.json"), {
      mcpServers: {
        web: { url: "https://x.dev/mcp", auth: "oauth" },
        local: { command: "npx" },
      },
    });
  });

  it("signs in, handing the page to open to the app", async () => {
    authenticate.mockImplementation(
      async (
        _name: string,
        _url: string,
        _entry: unknown,
        options: { openAuthorizationUrl(url: string): void },
      ) => {
        options.openAuthorizationUrl("https://x.dev/authorize");
        return "authenticated";
      },
    );
    await signIn("web");
    expect(authenticate).toHaveBeenCalledWith(
      "web",
      "https://x.dev/mcp",
      { url: "https://x.dev/mcp", auth: "oauth" },
      expect.anything(),
    );
    expect(emit).toHaveBeenCalledWith(
      MCP_AUTH_URL_EVENT,
      "https://x.dev/authorize",
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", "There is no server named missing."],
    ["local", "local has no URL to sign in to."],
  ])("reports %s", async (name, message) => {
    await signIn(name);
    expect(notify).toHaveBeenCalledWith(
      `Couldn't sign in to ${name}: ${message}`,
      "error",
    );
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("reports a sign-in that didn't finish", async () => {
    authenticate.mockResolvedValue("failed");
    await signIn("web");
    expect(notify).toHaveBeenCalledWith(
      "Couldn't sign in to web: Signing in to web didn't finish.",
      "error",
    );
  });
});

describe("asApp", () => {
  it("names the app while it runs, then puts pi's package dir back", async () => {
    vi.stubEnv("PI_PACKAGE_DIR", "/pi");
    const seen = await asApp(async () => ({
      dir: process.env.PI_PACKAGE_DIR!,
      agentDir: process.env[`${APP_TITLE.toUpperCase()}_CODING_AGENT_DIR`],
    }));
    const manifest = JSON.parse(
      await readFile(join(seen.dir, "package.json"), "utf8"),
    );
    expect(manifest.piConfig).toEqual({ name: APP_TITLE });
    expect(seen.agentDir).toBe(dir);
    expect(process.env.PI_PACKAGE_DIR).toBe("/pi");
  });

  it("clears the package dir again when there was none, even on failure", async () => {
    vi.stubEnv("PI_PACKAGE_DIR", undefined);
    await expect(
      asApp(async () => {
        throw new Error("denied");
      }),
    ).rejects.toThrow("denied");
    expect(process.env.PI_PACKAGE_DIR).toBeUndefined();
  });
});

it("deletes a server's saved sign-in", async () => {
  await mcp(pi);
  await commands.get(MCP_SIGN_OUT_COMMAND)!("web", { signal: undefined });
  expect(removeAuth).toHaveBeenCalledWith("web", { signal: undefined });
});

describe("closingConnections", () => {
  /** A listening server holding a socket that never sends a request, like a browser's preconnect. */
  async function withPreconnect() {
    const server = createServer((_req, res) => res.end());
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    const accepted = new Promise((r) => server.once("connection", r));
    const socket = connect(port, "127.0.0.1");
    socket.on("error", () => {});
    await accepted;
    const closed = new Promise<void>((r) => server.close(() => r()));
    return { server, socket, closed };
  }

  it("lets close() finish despite an unused open socket, then restores it", async () => {
    const original = Server.prototype.close;
    await closingConnections(async () => {
      const { closed } = await withPreconnect();
      await closed;
    });
    expect(Server.prototype.close).toBe(original);
  });

  it("leaves close() waiting on it otherwise", async () => {
    const { closed, socket } = await withPreconnect();
    const first = await Promise.race([
      closed.then(() => "closed"),
      new Promise((r) => setTimeout(() => r("waiting"), 200)),
    ]);
    expect(first).toBe("waiting");
    socket.destroy();
    await closed;
  });
});
