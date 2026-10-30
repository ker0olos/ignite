// pi-claude-bridge ships TypeScript source that doesn't pass this project's
// strict settings, so tsconfig.sidecar.json maps the import here. Mirrors its
// default export and __test's setQuery and getSharedSession in node_modules/pi-claude-bridge/src/index.ts.
import type { query } from "@anthropic-ai/claude-agent-sdk";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI): void;
export const __test:
  | {
      setQuery(fn: typeof query | null): void;
      getSharedSession?(piSessionId: string): { sessionId: string } | null;
    }
  | undefined;
