import { Child, Command } from "@tauri-apps/plugin-shell";
import type {
  HostMessage,
  HostRequest,
  HostResponses,
} from "../../shared/hostProtocol";

/** A line-based connection to the sidecar; tests pass a fake. */
export type Transport = {
  write(line: string): Promise<void>;
  onLine(cb: (line: string) => void): void;
  /** Called once when the process ends, with a reason for pending requests. */
  onClose(cb: (reason: string) => void): void;
  kill(): Promise<void>;
};

/** A request as the app writes it; the client adds the id. */
type Request =
  Extract<HostRequest, { id: number }> extends infer R
    ? R extends unknown
      ? Omit<R, "id">
      : never
    : never;

export type HostClient = {
  /** Sends a request and resolves with its response data, or rejects with its error. */
  request<R extends Request>(request: R): Promise<HostResponses[R["type"]]>;
  /** Sends a message that has no response (prompt and approval answers). */
  send(message: Exclude<HostRequest, { id: number }>): Promise<void>;
  /** Receives every message that isn't a response. Returns an unsubscribe. */
  subscribe(cb: (message: HostMessage) => void): () => void;
  close(): Promise<void>;
};

/** Matches responses to requests by id and fans out everything else. */
export function createHostClient(transport: Transport): HostClient {
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve(data: unknown): void; reject(error: Error): void }
  >();
  const listeners = new Set<(message: HostMessage) => void>();
  let closed: string | null = null;

  transport.onLine((line) => {
    let message: HostMessage;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.type !== "response") {
      listeners.forEach((cb) => cb(message));
      return;
    }
    const waiting = pending.get(message.id);
    if (!waiting) return;
    pending.delete(message.id);
    if (message.ok) waiting.resolve(message.data);
    else waiting.reject(new Error(message.error));
  });

  transport.onClose((reason) => {
    closed = reason;
    pending.forEach(({ reject }) => reject(new Error(reason)));
    pending.clear();
  });

  const write = (message: HostRequest) =>
    transport.write(JSON.stringify(message) + "\n");

  return {
    request(request) {
      if (closed) return Promise.reject(new Error(closed));
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (data: unknown) => void,
          reject,
        });
        write({ ...request, id } as HostRequest).catch((error) => {
          pending.delete(id);
          reject(error);
        });
      });
    },
    send: (message) => write(message),
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    close: () => transport.kill(),
  };
}

/**
 * Starts `node sidecar/main.ts` through the shell plugin. The capability only
 * allows this exact command (see src-tauri/tests/config.rs).
 */
export async function spawnSidecar(): Promise<Transport> {
  // ponytail: relies on `node` being on PATH, true when started with `npm run tauri dev`
  const command = Command.create("pi-host", [__PI_HOST_PATH__]);
  const lineListeners: ((line: string) => void)[] = [];
  let onClose: (reason: string) => void = () => {};

  // The shell plugin already splits stdout into lines; split again in case a
  // payload holds more than one, and drop line endings.
  command.stdout.on("data", (chunk: string) => {
    for (const line of chunk.split("\n")) {
      const trimmed = line.replace(/\r$/, "");
      if (trimmed) lineListeners.forEach((cb) => cb(trimmed));
    }
  });
  command.stderr.on("data", (line: string) => console.warn("[pi-host]", line));
  command.on("close", ({ code }: { code: number | null }) =>
    onClose(`The agent host stopped (exit code ${code}).`),
  );
  command.on("error", (error: string) =>
    onClose(`The agent host failed: ${error}`),
  );

  await killLeftovers();
  const child = await command.spawn();
  setLivePids([...livePids(), child.pid]);
  return {
    write: (line) => child.write(line),
    onLine: (cb) => void lineListeners.push(cb),
    onClose: (cb) => void (onClose = cb),
    kill: () => {
      setLivePids(livePids().filter((pid) => pid !== child.pid));
      return child.kill();
    },
  };
}

// sessionStorage survives a reload of this window, unlike module state.
const PIDS_KEY = "pi-host-pids";

function livePids(): number[] {
  try {
    return JSON.parse(sessionStorage.getItem(PIDS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function setLivePids(pids: number[]) {
  try {
    sessionStorage.setItem(PIDS_KEY, JSON.stringify(pids));
  } catch {
    // Without storage, leftovers live until the app quits.
  }
}

let leftovers: Promise<void> | null = null;

/**
 * Kills sidecars an earlier load of this window left running: a reload (⌘R or
 * Vite's) skips React's cleanup. The shell plugin only kills its own children.
 */
function killLeftovers() {
  leftovers ??= Promise.allSettled(
    livePids().map((pid) => new Child(pid).kill()),
  ).then(() => setLivePids([]));
  return leftovers;
}

/** Starts the sidecar and returns a client for it. */
export async function openPiHost(): Promise<HostClient> {
  return createHostClient(await spawnSidecar());
}
