import {
  hasTrustRequiringProjectResources,
  ProjectTrustStore,
} from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ProjectTrust } from "../shared/hostProtocol.ts";

/** Folders' trust decisions; tests pass a fake. `dir` is where a conversation works (its worktree), whose `.pi/` loads. */
export type TrustStore = {
  get(folder: string, dir?: string): ProjectTrust;
  set(folder: string, trusted: boolean, dirs?: string[]): void;
};

const KEPT = 20;

/** A fingerprint of `dir`'s `.pi/`: every entry's path, and each file's contents or link's target. */
function setupPrint(dir: string): string {
  const hash = createHash("sha256");
  const walk = (rel: string) => {
    const full = join(dir, ".pi", rel);
    const stat = lstatSync(full, { throwIfNoEntry: false });
    if (!stat) return;
    hash.update(`${rel}\0`);
    if (stat.isSymbolicLink()) hash.update(`-> ${readlinkSync(full)}\0`);
    else if (stat.isDirectory())
      for (const name of readdirSync(full).sort()) walk(join(rel, name));
    else hash.update(`${stat.size}\0`).update(readFileSync(full));
  };
  walk("");
  return hash.digest("hex").slice(0, 16);
}

/**
 * pi's own trust store (`trust.json` in the agent dir). A folder without
 * project resources has nothing to trust, so it's never asked about. Trust
 * covers `.pi/` as the user trusted it (`trusted-setup.json`): its extensions
 * run in the app, outside the sandbox, and the agent can write its worktree's,
 * so a changed one asks again however it was changed.
 */
export function createTrustStore(agentDir: string): TrustStore {
  const store = new ProjectTrustStore(agentDir);
  const file = join(agentDir, "trusted-setup.json");
  const read = (): Record<string, string[]> => {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  };
  const approve = (folder: string, dirs: string[]) => {
    const all = read();
    const prints = [...dirs.map(setupPrint), ...(all[folder] ?? [])];
    all[folder] = [...new Set(prints)].slice(0, KEPT);
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(file, JSON.stringify(all, null, 2), { mode: 0o600 });
    return all[folder];
  };
  return {
    get(folder, dir = folder) {
      const decision = store.get(folder);
      if (!hasTrustRequiringProjectResources(dir))
        return decision ? "trusted" : "untrusted";
      if (decision === null) return "ask";
      if (!decision) return "untrusted";
      // Trusted before this check existed: what it trusted is the folder's own.
      const prints = read()[folder] ?? approve(folder, [folder]);
      return prints.includes(setupPrint(dir)) ? "trusted" : "ask";
    },
    set(folder, trusted, dirs = [folder]) {
      store.set(folder, trusted);
      if (trusted) approve(folder, dirs);
    },
  };
}
