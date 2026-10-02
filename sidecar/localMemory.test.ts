// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { APP_NAME } from "../src/lib/app.ts";
import { localMemoryPrompt, memoryFiles } from "./localMemory.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ignite-memory-"));
  vi.stubEnv("HOME", dir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

it("names stable app-data markdown memory files", () => {
  const files = memoryFiles("/work/My App");
  expect(files.general).toBe(join(dir, `.${APP_NAME}`, "memory.md"));
  expect(files.folder).toMatch(/My_App-[a-f0-9]{12}\.md$/);
});

it("injects general and folder markdown with edit guidance", async () => {
  const files = memoryFiles("/work/app");
  await mkdir(join(dir, `.${APP_NAME}`, "memory"), { recursive: true });
  await writeFile(files.general, "Use conventional commits.\n");
  await writeFile(files.folder, "This folder uses Tauri.\n");

  await expect(localMemoryPrompt("/work/app")).resolves.toContain(
    "Use conventional commits.",
  );
  await expect(localMemoryPrompt("/work/app")).resolves.toContain(
    "This folder uses Tauri.",
  );
  await expect(localMemoryPrompt("/work/app")).resolves.toContain(
    "update the relevant markdown file",
  );
});
