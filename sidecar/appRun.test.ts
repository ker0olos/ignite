// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { runTool } from "./appRun.ts";

afterEach(() => vi.unstubAllEnvs());

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
