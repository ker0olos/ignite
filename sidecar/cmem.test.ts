// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cmemServer,
  excluded,
  findWorker,
  memoryEnabled,
  memoryStatus,
  recentObservations,
} from "./cmem.ts";
import { APP_NAME } from "../src/lib/app.ts";

let dir: string;
const fetchMock = vi.fn();
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "claude-mem-"));
  vi.stubEnv("CLAUDE_MEM_DATA_DIR", dir);
  vi.stubEnv("HOME", dir);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => healthy());
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

const workerPath = () => join(dir, "scripts", "worker-service.cjs");
const healthy = () => Response.json({ status: "ok", workerPath: workerPath() });

const installed = (settings: object = {}) =>
  writeFile(join(dir, "settings.json"), JSON.stringify(settings));
const running = async (settings: object = {}) => {
  await installed(settings);
  await writeFile(join(dir, "worker.pid"), JSON.stringify({ port: 37701 }));
};

const observation = {
  id: 7,
  type: "bugfix",
  title: "Fixed the thing",
  subtitle: "It was off by one",
  created_at_epoch: 1000,
  platform_source: "claude",
  narrative: "long",
};

describe("excluded", () => {
  it("matches globs against the path or folder name, with ~ as home", () => {
    expect(excluded("/h/work/secret", "~/work/*", "/h")).toBe(true);
    expect(excluded("/h/work/secret", " other , secr?t", "/h")).toBe(true);
    expect(excluded("/h/work/app", "~/private/**,secret", "/h")).toBe(false);
    expect(excluded("/h/work/app", "", "/h")).toBe(false);
    expect(excluded("/h/work/app", undefined, "/h")).toBe(false);
  });
});

describe("findWorker", () => {
  it("finds the running worker", async () => {
    await running();
    expect(await findWorker("/work/app")).toEqual({
      state: "running",
      url: "http://127.0.0.1:37701",
      workerPath: workerPath(),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:37701/api/health",
      expect.anything(),
    );
  });

  it("tells a missing install from a stopped worker", async () => {
    expect(await findWorker("/work/app")).toEqual({ state: "not-installed" });
    await installed();
    expect(await findWorker("/work/app")).toEqual({ state: "stopped" });
    await running();
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await findWorker("/work/app")).toEqual({ state: "stopped" });
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    expect(await findWorker("/work/app")).toEqual({ state: "stopped" });
  });

  it("does without the worker's path when an older worker leaves it out", async () => {
    await running();
    fetchMock.mockResolvedValueOnce(Response.json({ status: "ok" }));
    expect(await findWorker("/work/app")).toEqual({
      state: "running",
      url: "http://127.0.0.1:37701",
    });
  });

  it("honours cmem's excluded folders", async () => {
    await running({ CLAUDE_MEM_EXCLUDED_PROJECTS: "app" });
    expect(await findWorker("/work/app")).toEqual({ state: "excluded" });
    expect((await findWorker(undefined)).state).toBe("running");
  });
});

describe("memoryEnabled", () => {
  const file = () => join(dir, `.${APP_NAME}`, "settings.toml");
  const save = async (toml: string) => {
    await mkdir(join(dir, `.${APP_NAME}`), { recursive: true });
    await writeFile(file(), toml);
  };

  it("is on unless the settings turn it off", async () => {
    expect(await memoryEnabled()).toBe(true);
    await save("[memory]\ncmem = true\n");
    expect(await memoryEnabled()).toBe(true);
    await save("= broken");
    expect(await memoryEnabled()).toBe(true);
    await save("[memory]\ncmem = false\n");
    expect(await memoryEnabled()).toBe(false);
  });
});

describe("recentObservations", () => {
  it("lists the project's latest observations", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        items: [
          observation,
          { ...observation, id: 8, title: null, subtitle: null },
        ],
      }),
    );
    expect(await recentObservations("http://w", "my app", 2)).toEqual([
      {
        id: 7,
        type: "bugfix",
        title: "Fixed the thing",
        subtitle: "It was off by one",
        createdAt: 1000,
        platform: "claude",
      },
      {
        id: 8,
        type: "bugfix",
        title: "Untitled",
        createdAt: 1000,
        platform: "claude",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://w/api/observations?project=my%20app&limit=2",
      expect.anything(),
    );
  });

  it("is empty when the worker can't answer", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    expect(await recentObservations("http://w", "app")).toEqual([]);
  });
});

describe("memoryStatus", () => {
  it("has the viewer and the folder's memories while running", async () => {
    await running();
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/api/observations")
        ? Response.json({ items: [observation] })
        : healthy(),
    );
    const status = await memoryStatus("/work/app");
    expect(status.state).toBe("running");
    expect(status.viewerUrl).toBe("http://127.0.0.1:37701");
    expect(status.observations.map((o) => o.id)).toEqual([7]);
    expect((await memoryStatus()).observations).toEqual([]);
  });

  it("has only the state otherwise", async () => {
    expect(await memoryStatus("/work/app")).toEqual({
      state: "not-installed",
      observations: [],
    });
  });
});

describe("cmemServer", () => {
  const script = () => join(dir, "scripts", "mcp-server.cjs");
  const withScript = async () => {
    await mkdir(join(dir, "scripts"), { recursive: true });
    await writeFile(script(), "");
  };

  it("runs cmem's server from beside the worker, connected at start", async () => {
    await running();
    await withScript();
    expect(await cmemServer()).toEqual({
      cmem: {
        command: process.execPath,
        args: [script()],
        lifecycle: "eager",
        directTools: ["search", "timeline", "get_observations"],
      },
    });
  });

  it("is empty when cmem is off, stopped or has no server script", async () => {
    await running();
    expect(await cmemServer()).toEqual({});
    await withScript();
    fetchMock.mockResolvedValueOnce(Response.json({ status: "ok" }));
    expect(await cmemServer()).toEqual({});
    await mkdir(join(dir, `.${APP_NAME}`));
    await writeFile(
      join(dir, `.${APP_NAME}`, "settings.toml"),
      "[memory]\ncmem = false\n",
    );
    expect(await cmemServer()).toEqual({});
  });
});
