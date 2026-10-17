// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { runTool, stepper } from "./appRun.ts";

// isTTY is set only in a terminal, so it's defined here rather than spied on.
const setTTY = (value: boolean) =>
  Object.defineProperty(process.stdout, "isTTY", { value, configurable: true });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete (process.stdout as { isTTY?: boolean }).isTTY;
});

const node = (code: string) => [process.execPath, ["-e", code]] as const;

it("resolves once the tool exits 0", async () => {
  const [cmd, args] = node("console.log('done')");
  await expect(runTool(cmd, [...args], { cwd: "." })).resolves.toBeUndefined();
});

it("fails with the tool's exit code and the end of its output", async () => {
  const [cmd, args] = node("console.error('no lockfile'); process.exit(3)");
  await expect(runTool(cmd, [...args], { cwd: "." })).rejects.toThrow(
    /failed \(exit 3\)\nno lockfile/,
  );
});

it("fails as spawn does for a missing tool, so callers can tell", async () => {
  await expect(
    runTool("no-such-tool-here", [], { cwd: "." }),
  ).rejects.toMatchObject({ code: "ENOENT" });
});

it("passes the environment it's given", async () => {
  const [cmd, args] = node("process.exit(process.env.X === 'y' ? 0 : 1)");
  await expect(
    runTool(cmd, [...args], { cwd: ".", env: { X: "y" } }),
  ).resolves.toBeUndefined();
});

it("copies the tool's output to IGNITE_TOOL_LOG's file, after its command", async () => {
  const dir = mkdtempSync(join(tmpdir(), "app-run-"));
  const log = join(dir, "setup.log");
  vi.stubEnv("IGNITE_TOOL_LOG", log);
  const [cmd, args] = node("console.log('out'); console.error('err')");
  await runTool(cmd, [...args], { cwd: "." });
  const text = readFileSync(log, "utf8");
  expect(text.startsWith(`$ ${cmd} -e `)).toBe(true);
  expect(text).toContain("out");
  expect(text).toContain("err");
  rmSync(dir, { recursive: true });
});

const PNPM = `console.log('Lockfile is up to date');
console.log('Progress: resolved 702, reused 0, downloaded 207, added 0');
console.log('Progress: resolved 702, reused 0, downloaded 700, added 708, done')`;

it("redraws pnpm's progress on one line in a terminal, and clears it", async () => {
  setTTY(true);
  const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const [cmd, args] = node(PNPM);
  await runTool(cmd, [...args], { cwd: "." });
  const shown = write.mock.calls.map(([text]) => String(text));
  expect(shown.at(-2)).toBe(
    "\r\x1b[K  resolved 702, reused 0, downloaded 700, added 708, done",
  );
  expect(shown.at(-1)).toBe("\r\x1b[K");
  expect(shown.join("")).not.toContain("Lockfile");
});

it("shows no progress outside a terminal (the sidecar's stdout) or with IGNITE_VERBOSE", async () => {
  setTTY(false);
  const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const [cmd, args] = node(PNPM);
  await runTool(cmd, [...args], { cwd: "." });
  expect(write).not.toHaveBeenCalled();
  setTTY(true);
  vi.stubEnv("IGNITE_VERBOSE", "1");
  await runTool(cmd, [...args], { cwd: "." });
  const shown = write.mock.calls.map(([text]) => String(text)).join("");
  expect(shown).toContain("Lockfile");
  expect(shown).not.toContain("\x1b[K");
});

it("prints each step, and logs it after the time taken", () => {
  const dir = mkdtempSync(join(tmpdir(), "app-run-"));
  const log = join(dir, "logs", "setup.log");
  let now = 0;
  const lines: string[] = [];
  const print = vi
    .spyOn(console, "log")
    .mockImplementation((l) => lines.push(l));
  const step = stepper(log, () => now);
  step("Installing packages…");
  now = 75_000;
  step("Building the frontend…");
  print.mockRestore();
  expect(lines).toEqual(["Installing packages…", "Building the frontend…"]);
  expect(readFileSync(log, "utf8")).toBe(
    "0:00  Installing packages…\n1:15  Building the frontend…\n",
  );
  rmSync(dir, { recursive: true });
});
