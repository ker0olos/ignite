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

  mockIPC(
    (cmd, args) => {
      calls.push(cmd);
      const { path = "", options } = (args ?? {}) as PathArgs;
      switch (cmd) {
        case "plugin:fs|exists":
          return path in tree || isDir(path);
        case "plugin:fs|read_dir": {
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
        case "plugin:fs|read_file":
        case "plugin:fs|read_text_file": {
          const content = tree[path];
          if (content == null) throw new Error(`no such file: ${path}`);
          const bytes =
            typeof content === "string"
              ? new TextEncoder().encode(content)
              : content;
          return Array.from(bytes);
        }
        case "plugin:fs|mkdir":
          mkdirs.push({ path, recursive: options?.recursive });
          return null;
        case "plugin:fs|write_text_file":
          // The path travels in request headers, which mocks don't expose.
          writes.push(new TextDecoder().decode(args as Uint8Array));
          return null;
        default:
          if (extra) return extra(cmd, args);
          throw new Error(`unmocked command: ${cmd}`);
      }
    },
    { shouldMockEvents: true },
  );

  return { calls, mkdirs, writes };
}

/** Builds the DirEntry shape the fs plugin returns, for tests that pass entries in. */
export function entry(name: string, isDirectory = false) {
  return { name, isDirectory, isFile: !isDirectory, isSymlink: false };
}
