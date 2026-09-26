import { exists, readTextFile, type DirEntry } from "@tauri-apps/plugin-fs";
import ignore, { type Ignore } from "ignore";

// ponytail: cached for the session, so .gitignore edits show after an app reload;
// global excludes (core.excludesFile, .git/info/exclude) are not read
const rulesCache = new Map<string, Promise<Ignore | null>>();
const rootCache = new Map<string, Promise<string | null>>();

function rulesIn(dir: string) {
  let rules = rulesCache.get(dir);
  if (!rules) {
    rules = readTextFile(`${dir}/.gitignore`).then(
      (text) => ignore().add(text),
      () => null,
    );
    rulesCache.set(dir, rules);
  }
  return rules;
}

function repoRoot(dir: string): Promise<string | null> {
  let root = rootCache.get(dir);
  if (!root) {
    root = exists(`${dir}/.git`).then((found) => {
      if (found) return dir;
      const parent = dir.slice(0, dir.lastIndexOf("/"));
      return parent ? repoRoot(parent) : null;
    });
    rootCache.set(dir, root);
  }
  return root;
}

/** Drops entries of `dir` that Git would ignore, honouring nested .gitignore files. */
export async function withoutGitIgnored(dir: string, entries: DirEntry[]) {
  const root = await repoRoot(dir);
  if (!root) return entries;

  // Every directory from the repo root down to `dir` can hold a .gitignore.
  const chain = [root];
  const parts = dir
    .slice(root.length + 1)
    .split("/")
    .filter(Boolean);
  for (const part of parts) chain.push(`${chain[chain.length - 1]}/${part}`);
  const rules = await Promise.all(chain.map(rulesIn));

  return entries.filter((entry) => {
    const path = `${dir}/${entry.name}${entry.isDirectory ? "/" : ""}`;
    let ignored = false;
    chain.forEach((base, i) => {
      const result = rules[i]?.test(path.slice(base.length + 1));
      if (result?.ignored) ignored = true;
      else if (result?.unignored) ignored = false;
    });
    return !ignored;
  });
}
