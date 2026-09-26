import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, it, vi } from "vitest";
import type { HostMessage } from "../../shared/hostProtocol";
import {
  createHostClient,
  openPiHost,
  spawnSidecar,
  type Transport,
} from "./piHost";

/** An in-memory transport: records written lines and lets tests reply. */
function fakeTransport() {
  const written: unknown[] = [];
  let lineCb: (line: string) => void = () => {};
  let closeCb: (reason: string) => void = () => {};
  const transport: Transport = {
    write: vi.fn(async (line: string) => void written.push(JSON.parse(line))),
    onLine: (cb) => void (lineCb = cb),
    onClose: (cb) => void (closeCb = cb),
    kill: vi.fn(async () => {}),
  };
  return {
    transport,
    written,
    reply: (message: HostMessage | string) =>
      lineCb(typeof message === "string" ? message : JSON.stringify(message)),
    close: (reason: string) => closeCb(reason),
  };
}

describe("createHostClient", () => {
  it("sends requests with increasing ids", async () => {
    const t = fakeTransport();
    const client = createHostClient(t.transport);
    void client.request({ type: "status" });
    void client.request({ type: "logout", provider: "openai" });
    await Promise.resolve();
    expect(t.written).toEqual([
      { type: "status", id: 1 },
      { type: "logout", provider: "openai", id: 2 },
    ]);
  });

  it("resolves a request with its response's data", async () => {
    const t = fakeTransport();
    const client = createHostClient(t.transport);
    const status = client.request({ type: "status" });
    t.reply({ type: "response", id: 1, ok: true, data: [] });
    await expect(status).resolves.toEqual([]);
  });

  it("rejects a request with its response's error", async () => {
    const t = fakeTransport();
    const client = createHostClient(t.transport);
    const login = client.request({
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    t.reply({ type: "response", id: 1, ok: false, error: "Nope" });
    await expect(login).rejects.toThrow("Nope");
  });

  it("matches responses by id, whatever order they arrive in", async () => {
    const t = fakeTransport();
    const client = createHostClient(t.transport);
    const first = client.request({ type: "status" });
    const second = client.request({ type: "cancel_login" });
    t.reply({ type: "response", id: 2, ok: true });
    t.reply({ type: "response", id: 1, ok: true, data: ["first"] });
    await expect(second).resolves.toBeUndefined();
    await expect(first).resolves.toEqual(["first"]);
  });

  it("passes other messages to subscribers until they unsubscribe", () => {
    const t = fakeTransport();
    const client = createHostClient(t.transport);
    const seen: HostMessage[] = [];
    const unsubscribe = client.subscribe((m) => seen.push(m));
    t.reply({ type: "ready" });
    unsubscribe();
    t.reply({ type: "ready" });
    expect(seen).toEqual([{ type: "ready" }]);
  });

  it("ignores lines that aren't JSON and responses nobody asked for", () => {
    const t = fakeTransport();
    const client = createHostClient(t.transport);
    const seen: HostMessage[] = [];
    client.subscribe((m) => seen.push(m));
    t.reply("garbage");
    t.reply({ type: "response", id: 42, ok: true });
    expect(seen).toEqual([]);
  });

  it("rejects pending and later requests once the host stops", async () => {
    const t = fakeTransport();
    const client = createHostClient(t.transport);
    const pending = client.request({ type: "status" });
    t.close("The agent host stopped (exit code 1).");
    await expect(pending).rejects.toThrow("exit code 1");
    await expect(client.request({ type: "status" })).rejects.toThrow(
      "exit code 1",
    );
  });

  it("rejects a request whose write fails", async () => {
    const t = fakeTransport();
    vi.mocked(t.transport.write).mockRejectedValueOnce(
      new Error("broken pipe"),
    );
    const client = createHostClient(t.transport);
    await expect(client.request({ type: "status" })).rejects.toThrow(
      "broken pipe",
    );
  });

  it("sends prompt answers as plain messages", async () => {
    const t = fakeTransport();
    const client = createHostClient(t.transport);
    await client.send({ type: "prompt_answer", promptId: 3, value: "code" });
    expect(t.written).toEqual([
      { type: "prompt_answer", promptId: 3, value: "code" },
    ]);
  });

  it("kills the process on close", async () => {
    const t = fakeTransport();
    await createHostClient(t.transport).close();
    expect(t.transport.kill).toHaveBeenCalled();
  });
});

describe("spawnSidecar", () => {
  type Channel = {
    onmessage: (e: { event: string; payload: unknown }) => void;
  };

  /** Fakes the shell plugin; returns the spawn args and every IPC call. */
  function fakeShell() {
    const calls: { cmd: string; args: Record<string, unknown> }[] = [];
    let channel: Channel | undefined;
    mockIPC((cmd, args) => {
      calls.push({ cmd, args: args as Record<string, unknown> });
      if (cmd === "plugin:shell|spawn") {
        channel = (args as { onEvent: Channel }).onEvent;
        return 4242;
      }
      return null;
    });
    return {
      calls,
      emit: (event: string, payload: unknown) =>
        channel!.onmessage({ event, payload }),
    };
  }

  it("starts only the allowed command with the sidecar script", async () => {
    const shell = fakeShell();
    await spawnSidecar();
    expect(shell.calls[0]).toMatchObject({
      cmd: "plugin:shell|spawn",
      args: { program: "pi-host", args: ["/repo/sidecar/main.ts"] },
    });
  });

  it("delivers stdout line by line, splitting payloads and dropping CRs", async () => {
    const shell = fakeShell();
    const transport = await spawnSidecar();
    const lines: string[] = [];
    transport.onLine((l) => lines.push(l));
    shell.emit("Stdout", '{"a":1}\r\n{"b":2}\n');
    shell.emit("Stdout", "\n");
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("logs stderr as warnings", async () => {
    const shell = fakeShell();
    await spawnSidecar();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    shell.emit("Stderr", "something odd");
    expect(warn).toHaveBeenCalledWith("[pi-host]", "something odd");
  });

  it("reports when the process exits or fails", async () => {
    const shell = fakeShell();
    const transport = await spawnSidecar();
    const reasons: string[] = [];
    transport.onClose((r) => reasons.push(r));
    shell.emit("Terminated", { code: 1, signal: null });
    shell.emit("Error", "spawn node ENOENT");
    expect(reasons).toEqual([
      "The agent host stopped (exit code 1).",
      "The agent host failed: spawn node ENOENT",
    ]);
  });

  it("gives a client that talks to the spawned process", async () => {
    const shell = fakeShell();
    const client = await openPiHost();
    const status = client.request({ type: "status" });
    await vi.waitFor(() =>
      expect(shell.calls.map((c) => c.cmd)).toContain(
        "plugin:shell|stdin_write",
      ),
    );
    expect(shell.calls.at(-1)?.args).toMatchObject({
      buffer: '{"type":"status","id":1}\n',
    });
    shell.emit("Stdout", '{"type":"response","id":1,"ok":true,"data":[]}');
    await expect(status).resolves.toEqual([]);
  });

  it("writes to stdin and kills the right process", async () => {
    const shell = fakeShell();
    const transport = await spawnSidecar();
    await transport.write("hello\n");
    await transport.kill();
    expect(shell.calls.slice(1)).toEqual([
      {
        cmd: "plugin:shell|stdin_write",
        args: { pid: 4242, buffer: "hello\n" },
      },
      { cmd: "plugin:shell|kill", args: { cmd: "killChild", pid: 4242 } },
    ]);
  });
});
