import { useEffect, useRef } from "react";
import type { McpServer } from "../../shared/hostProtocol";
import { serverRowId } from "@/components/settings/sections";

/** Brings an MCP server that was just added (preset, import or form) into view. */
export function useScrollToNewServer(servers: McpServer[] | null) {
  const serverNames = servers?.map((m) => m.name).join("\n") ?? null;
  const knownNames = useRef<string[] | null>(null);
  useEffect(() => {
    if (serverNames === null) return;
    const names = serverNames.split("\n");
    const known = knownNames.current;
    knownNames.current = names;
    const added = known && names.find((n) => !known.includes(n));
    if (!added) return;
    document
      .getElementById(serverRowId(added))
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [serverNames]);
}
