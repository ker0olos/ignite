import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { APP_NAME, APP_TITLE } from "../src/lib/app.ts";

const MAX_MEMORY_CHARS = 12000;

const dataDir = () => join(homedir(), `.${APP_NAME}`);
const cleanName = (cwd: string) =>
  basename(cwd).replaceAll(/[^a-zA-Z0-9._-]/g, "_");
const folderKey = (cwd: string) =>
  createHash("sha256").update(cwd).digest("hex").slice(0, 12);

/** The user-editable markdown memory files consulted when cmem has no context. */
export function memoryFiles(cwd: string, dir = dataDir()) {
  return {
    general: join(dir, "memory.md"),
    folder: join(dir, "memory", `${cleanName(cwd)}-${folderKey(cwd)}.md`),
  };
}

async function readMemoryFile(path: string, title: string): Promise<string> {
  try {
    const text = (await readFile(path, "utf8")).trim();
    return text ? `## ${title}\n\n${text}` : "";
  } catch {
    return "";
  }
}

/** Ensures the app-data memory folder exists so agents can update its files. */
export async function ensureMemoryFiles(
  cwd: string,
): Promise<ReturnType<typeof memoryFiles>> {
  const files = memoryFiles(cwd);
  await mkdir(join(dataDir(), "memory"), { recursive: true }).catch(
    () => undefined,
  );
  return files;
}

/** Markdown context and instructions for the built-in fallback memory. */
export async function localMemoryPrompt(cwd: string): Promise<string> {
  const files = await ensureMemoryFiles(cwd);
  const [general, folder] = await Promise.all([
    readMemoryFile(files.general, `General ${APP_TITLE} memory`),
    readMemoryFile(files.folder, `Folder memory (${cwd})`),
  ]);
  const context = [general, folder].filter(Boolean).join("\n\n");
  const clipped =
    context.length > MAX_MEMORY_CHARS
      ? `${context.slice(0, MAX_MEMORY_CHARS)}\n\n[Memory truncated]`
      : context;
  return [
    `# ${APP_TITLE} built-in memory`,
    "cmem did not provide context, so use these markdown memory files instead.",
    "Always consider them before answering or changing code.",
    `General memory for all ${APP_TITLE} work: ${files.general}`,
    `This folder's memory: ${files.folder}`,
    "When you learn durable preferences, decisions, conventions or project facts,",
    "update the relevant markdown file. Keep entries concise, dated when useful,",
    "and avoid secrets.",
    clipped,
  ]
    .filter(Boolean)
    .join("\n\n");
}
