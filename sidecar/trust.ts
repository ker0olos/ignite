import {
  hasTrustRequiringProjectResources,
  ProjectTrustStore,
} from "@earendil-works/pi-coding-agent";
import type { ProjectTrust } from "../shared/hostProtocol.ts";

/** Folders' trust decisions; tests pass a fake. */
export type TrustStore = {
  get(cwd: string): ProjectTrust;
  set(cwd: string, trusted: boolean): void;
};

/**
 * pi's own trust store (`trust.json` in the agent dir). A folder without
 * project resources has nothing to trust, so it's never asked about.
 */
export function createTrustStore(agentDir: string): TrustStore {
  const store = new ProjectTrustStore(agentDir);
  return {
    get(cwd) {
      const decision = store.get(cwd);
      if (decision !== null) return decision ? "trusted" : "untrusted";
      return hasTrustRequiringProjectResources(cwd) ? "ask" : "untrusted";
    },
    set: (cwd, trusted) => store.set(cwd, trusted),
  };
}
