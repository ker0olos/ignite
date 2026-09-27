import { mockIPC } from "@tauri-apps/api/mocks";

/** A file (string or bytes) or an explicitly empty directory (null). */
export type FakeTree = Record<string, string | Uint8Array | null>;

type PathArgs = { path?: string; options?: { recursive?: boolean } };

/**
 * Installs a fake backend for the fs plugin commands the app uses, backed by
 * a flat map of paths. Directories are implied by their children.
 *
 * Returns what the app did, for assertions: every command received, every
 * directory created, and the text of every file written.
 */
function readDirEntries(
  tree: FakeTree,
  isDir: (path: string) => boolean,
  path: string,
) {
  if (!isDir(path)) throw new Error(`not a directory: ${path}`);
  const names = new Set(
    Object.keys(tree)
      .filter((p) => p.startsWith(path + "/"))
      .map((p) => p.slice(path.length + 1).split("/")[0]),
  );
  return [...names].map((name) => ({
    name,
    isDirectory: isDir(`${path}/${name}`),
    isFile: !isDir(`${path}/${name}`),
    isSymlink: false,
  }));
}

function readFileBytes(tree: FakeTree, path: string) {
  const content = tree[path];
  if (content == null) throw new Error(`no such file: ${path}`);
  const bytes =
    typeof content === "string" ? new TextEncoder().encode(content) : content;
  return Array.from(bytes);
}

type FsCallArgs = {
  path: string;
  options?: { recursive?: boolean };
  args: unknown;
};

export function fakeFs(
  tree: FakeTree,
  extra?: (cmd: string, args: unknown) => unknown,
) {
  const calls: string[] = [];
  const mkdirs: { path: string; recursive?: boolean }[] = [];
  const writes: string[] = [];
  const isDir = (path: string) =>
    tree[path] === null ||
    Object.keys(tree).some((p) => p.startsWith(path + "/"));

  const handlers: Record<string, (call: FsCallArgs) => unknown> = {
    "plugin:fs|exists": ({ path }) => path in tree || isDir(path),
    "plugin:fs|read_dir": ({ path }) => readDirEntries(tree, isDir, path),
    "plugin:fs|read_file": ({ path }) => readFileBytes(tree, path),
    "plugin:fs|read_text_file": ({ path }) => readFileBytes(tree, path),
    "plugin:fs|mkdir": ({ path, options }) => {
      mkdirs.push({ path, recursive: options?.recursive });
      return null;
    },
    "plugin:fs|write_text_file": ({ args }) => {
      // The path travels in request headers, which mocks don't expose.
      writes.push(new TextDecoder().decode(args as Uint8Array));
      return null;
    },
  };

  mockIPC(
    (cmd, args) => {
      calls.push(cmd);
      const { path = "", options } = (args ?? {}) as PathArgs;
      const handler = handlers[cmd];
      if (handler) return handler({ path, options, args });
      if (extra) return extra(cmd, args);
      throw new Error(`unmocked command: ${cmd}`);
    },
    { shouldMockEvents: true },
  );

  return { calls, mkdirs, writes };
}

/** Builds the DirEntry shape the fs plugin returns, for tests that pass entries in. */
export function entry(name: string, isDirectory = false) {
  return { name, isDirectory, isFile: !isDirectory, isSymlink: false };
}
