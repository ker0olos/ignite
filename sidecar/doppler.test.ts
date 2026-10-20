import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { dopplerEnv, dropDoppler, withDoppler } from "./doppler.ts";

let base: string;
let home: string;
let root: string;
let worktree: string;
const folder = "/work/app";

const writeConfig = (text: string) => {
  mkdirSync(join(home, ".doppler"), { recursive: true });
  writeFileSync(join(home, ".doppler", ".doppler.yaml"), text);
};

const copyOf = (env: Record<string, string>) =>
  parse(readFileSync(join(env.DOPPLER_CONFIG_DIR, ".doppler.yaml"), "utf8"));

beforeEach(() => {
  vi.stubEnv("DOPPLER_CONFIG_DIR", "");
  base = mkdtempSync(join(tmpdir(), "doppler-test-"));
  home = join(base, "home");
  root = join(base, "worktrees");
  worktree = join(root, "app-1234", "s1");
  mkdirSync(worktree, { recursive: true });
  writeFileSync(join(root, "app-1234", ".repo"), folder);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("dopplerEnv", () => {
  it("merges ancestors' settings onto the worktree, the deeper winning", () => {
    writeConfig(
      [
        "scoped:",
        `  ${folder}:`,
        "    enclave.config: app",
        "  /work:",
        "    enclave.project: work",
        "    enclave.config: work",
      ].join("\n"),
    );
    const env = dopplerEnv(worktree, home, root);
    expect(env.DOPPLER_CONFIG_DIR).toContain(join(home, ".ignite", "doppler"));
    expect(copyOf(env).scoped[worktree]).toEqual({
      "enclave.project": "work",
      "enclave.config": "app",
    });
  });

  it("passes nothing when the copy can't be written", () => {
    writeConfig(`scoped:\n  ${folder}:\n    enclave.project: app\n`);
    writeFileSync(join(home, ".ignite"), "a file, not a folder");
    expect(dopplerEnv(worktree, home, root)).toEqual({});
  });

  it("drops the copy", () => {
    writeConfig(`scoped:\n  ${folder}:\n    enclave.project: app\n`);
    const env = dopplerEnv(worktree, home, root);
    dropDoppler(worktree, home);
    expect(() => copyOf(env)).toThrow();
  });

  it("copies the folder's settings onto the worktree, keeping the rest", () => {
    writeConfig(
      [
        "scoped:",
        "  /:",
        "    token: keep",
        `  ${folder}/mobile:`,
        "    enclave.project: mobile",
        "    enclave.config: dev",
        "  /work/other:",
        "    enclave.project: other",
        "tui:",
        "  introVersionSeen: 1",
      ].join("\n"),
    );
    const env = dopplerEnv(join(worktree, "mobile", "src"), home, root);
    const copy = copyOf(env);
    expect(copy.scoped[join(worktree, "mobile")]).toEqual({
      "enclave.project": "mobile",
      "enclave.config": "dev",
    });
    expect(copy.scoped["/"]).toEqual({ token: "keep" });
    expect(copy.scoped[`${folder}/mobile`]).toBeDefined();
    expect(Object.keys(copy.scoped)).toHaveLength(4);
    expect(copy.tui).toEqual({ introVersionSeen: 1 });
  });

  it("reads the config from DOPPLER_CONFIG_DIR when the user set one", () => {
    const own = join(base, "own");
    mkdirSync(own);
    writeFileSync(
      join(own, ".doppler.yaml"),
      `scoped:\n  ${folder}:\n    enclave.project: own\n`,
    );
    vi.stubEnv("DOPPLER_CONFIG_DIR", own);
    const env = dopplerEnv(worktree, home, root);
    expect(copyOf(env).scoped[worktree]).toEqual({ "enclave.project": "own" });
  });

  it("is empty outside a worktree", () => {
    writeConfig(`scoped:\n  ${folder}:\n    enclave.project: app\n`);
    expect(dopplerEnv(folder, home, root)).toEqual({});
  });

  it("is empty without a Doppler config, or one that doesn't parse", () => {
    expect(dopplerEnv(worktree, home, root)).toEqual({});
    writeConfig("scoped: [unclosed");
    expect(dopplerEnv(worktree, home, root)).toEqual({});
    writeConfig("just text");
    expect(dopplerEnv(worktree, home, root)).toEqual({});
  });

  it("is empty when nothing is set for the folder", () => {
    writeConfig(
      "scoped:\n  /:\n    token: t\n  /work/apple:\n    enclave.project: x\n",
    );
    expect(dopplerEnv(worktree, home, root)).toEqual({});
  });
});

describe("withDoppler", () => {
  const context = { command: "doppler run -- x", env: { A: "1" } };

  it("adds Doppler's env for the cwd the given hook leaves", () => {
    writeConfig(`scoped:\n  ${folder}:\n    enclave.project: app\n`);
    const hook = withDoppler(
      (c) => ({ ...c, cwd: worktree, env: { ...c.env, B: "2" } }),
      home,
      root,
    );
    const { env } = hook({ ...context, cwd: folder });
    expect(env).toMatchObject({ A: "1", B: "2" });
    expect(env.DOPPLER_CONFIG_DIR).toContain(join(home, ".ignite"));
  });

  it("leaves the env alone outside a worktree", () => {
    writeConfig(`scoped:\n  ${folder}:\n    enclave.project: app\n`);
    const { env } = withDoppler(
      undefined,
      home,
      root,
    )({ ...context, cwd: folder });
    expect(env).toEqual({ A: "1" });
  });
});
