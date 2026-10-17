// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASSETS, awaitingCI, downloadBinary, githubRepo } from "./appBinary.ts";

let dir: string;
let repo: string;

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

async function commit(text: string) {
  await writeFile(join(repo, "src-tauri", "Cargo.toml"), text);
  git("add", ".");
  git("-c", "user.name=T", "-c", "user.email=t@t", "commit", "-qm", text);
  return git("rev-parse", "HEAD");
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "app-binary-"));
  repo = join(dir, "repo");
  await mkdir(join(repo, "src-tauri"), { recursive: true });
  git("init", "-q");
  await commit("first");
  git("remote", "add", "origin", "git@github.com:me/app.git");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const answer = (status: number, body = "binary") =>
  vi.fn(
    async () => new Response(status === 200 ? body : "", { status }),
  ) as unknown as typeof fetch;
const into = () => join(dir, "download");

describe("ASSETS", () => {
  it("names what binary.yml's matrix publishes", async () => {
    const workflow = await readFile(
      join(import.meta.dirname, "..", ".github/workflows/binary.yml"),
      "utf8",
    );
    const published = [...workflow.matchAll(/asset: (\S+)/g)].map((m) => m[1]);
    expect(published.sort()).toEqual(Object.values(ASSETS).sort());
  });
});

describe("githubRepo", () => {
  it.each([
    ["git@github.com:me/app.git", "me/app"],
    ["https://github.com/me/app", "me/app"],
    ["https://token@github.com/me/app.git", "me/app"],
    ["https://github.com.example.org/me/app", null],
    ["https://gitlab.com/github.com/app", null],
    ["/local/path", null],
  ])("%s → %s", (url, name) => {
    expect(githubRepo(url)).toBe(name);
  });
});

describe("downloadBinary", () => {
  it("fetches the release for the src-tauri tree and keeps it once verified", async () => {
    const get = answer(200);
    const verify = vi.fn(async () => null);
    const got = await downloadBinary(repo, into(), { get, verify }, "ignite-x");
    const tree = git("rev-parse", "HEAD:src-tauri");
    expect(get).toHaveBeenCalledWith(
      `https://github.com/me/app/releases/download/bin-${tree}/ignite-x`,
      expect.anything(),
    );
    expect(got).toEqual({ file: join(into(), "ignite-x") });
    expect(verify).toHaveBeenCalledWith(join(into(), "ignite-x"), "me/app");
    expect(await readFile(join(into(), "ignite-x"), "utf8")).toBe("binary");
  });

  it("checks it against the repository's current name when it was renamed", async () => {
    const get = vi.fn(async (url: string) =>
      url.startsWith("https://api.github.com/")
        ? Response.json({ full_name: "me/renamed" })
        : new Response("binary"),
    ) as unknown as typeof fetch;
    const verify = vi.fn(async () => null);
    await downloadBinary(repo, into(), { get, verify }, "ignite-x");
    expect(get).toHaveBeenCalledWith(
      "https://api.github.com/repos/me/app",
      expect.anything(),
    );
    expect(verify).toHaveBeenCalledWith(join(into(), "ignite-x"), "me/renamed");
  });

  it("keeps a binary it couldn't check, with a warning", async () => {
    const verify = vi.fn(async () => "GitHub couldn't be reached (offline)");
    const got = await downloadBinary(
      repo,
      into(),
      { get: answer(200), verify },
      "ignite-x",
    );
    expect(got).toEqual({
      file: join(into(), "ignite-x"),
      warning:
        "Using CI's binary unverified: GitHub couldn't be reached (offline).",
    });
  });

  it("throws away a binary that fails verification, saying why", async () => {
    const verify = vi.fn(async () => {
      throw new Error("no attestations");
    });
    const got = await downloadBinary(
      repo,
      into(),
      { get: answer(200), verify },
      "ignite-x",
    );
    expect(got).toEqual({
      why: "its attestation didn't verify: no attestations",
    });
    expect(existsSync(join(into(), "ignite-x"))).toBe(false);
  });

  it("says why there's none: not published, refused, or unreachable", async () => {
    const tree = git("rev-parse", "HEAD:src-tauri").slice(0, 7);
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed", {
        cause: { code: "ECONNRESET" },
      });
    }) as unknown as typeof fetch;
    const cases: [typeof fetch, string][] = [
      [answer(404), `CI hasn't published one for src-tauri ${tree}`],
      [answer(403), "GitHub answered 403 for it"],
      [offline, "couldn't download it from GitHub (ECONNRESET)"],
    ];
    for (const [get, why] of cases) {
      expect(await downloadBinary(repo, into(), { get }, "x")).toEqual({ why });
    }
  });

  it("has none for a machine CI doesn't build for, or a clone not on GitHub", async () => {
    const get = answer(200);
    expect(await downloadBinary(repo, into(), { get }, null)).toEqual({
      why: "CI builds no binary for this machine",
    });
    git("remote", "set-url", "origin", "https://gitlab.com/me/app.git");
    expect(await downloadBinary(repo, into(), { get }, "x")).toEqual({
      why: "this clone's origin isn't on GitHub",
    });
    expect(get).not.toHaveBeenCalled();
  });
});

describe("awaitingCI", () => {
  const HOUR = 60 * 60_000;

  it("waits for a recent Rust change CI hasn't published yet", async () => {
    const running = git("rev-parse", "HEAD");
    git("worktree", "add", "-q", "--detach", join(dir, "running"), running);
    const sha = await commit("second");
    const now = Date.now();
    expect(
      await awaitingCI(repo, join(dir, "running"), sha, answer(404), now, "x"),
    ).toBe(true);
    expect(
      await awaitingCI(repo, join(dir, "running"), sha, answer(200), now, "x"),
    ).toBe(false);
    expect(
      await awaitingCI(
        repo,
        join(dir, "running"),
        sha,
        answer(404),
        now + 2 * HOUR,
        "x",
      ),
    ).toBe(false);
  });

  it("doesn't wait when the Rust side didn't change, or there's no CI to wait for", async () => {
    const sha = git("rev-parse", "HEAD");
    const get = answer(404);
    expect(await awaitingCI(repo, repo, sha, get, Date.now(), "x")).toBe(false);
    expect(await awaitingCI(repo, repo, sha, get, Date.now(), null)).toBe(
      false,
    );
    git("remote", "set-url", "origin", "/local/origin");
    const next = await commit("second");
    expect(await awaitingCI(repo, repo, next, get, Date.now(), "x")).toBe(
      false,
    );
  });
});
