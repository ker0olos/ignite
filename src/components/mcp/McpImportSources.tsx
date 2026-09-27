import type { McpCatalog } from "../../../shared/hostProtocol";
import { Added } from "@/components/mcp/Added";
import { AppIcon } from "@/components/mcp/AppIcon";
import { AsyncButton } from "@/components/mcp/AsyncButton";

/** Other apps' MCP servers found on this Mac, grouped by source. */
export function McpImportSources({
  sources,
  onImport,
}: {
  sources: McpCatalog["sources"];
  onImport: (sourceId: string, names: string[]) => Promise<void>;
}) {
  return (
    <div className="grid gap-3">
      {sources.map((source) => {
        const missing = source.servers
          .filter((s) => !s.added)
          .map((s) => s.name);
        return (
          <div key={source.id} className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2">
              <span className="flex items-center gap-2 text-[13px]">
                <AppIcon app={source.app} />
                {source.app}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {source.scope === "user" ? "Global" : "This project only"}
                  {" · "}
                  {source.servers.length === 1
                    ? "1 server"
                    : `${source.servers.length} servers`}
                </span>
              </span>
              {missing.length > 0 && (
                <AsyncButton onClick={() => onImport(source.id, missing)}>
                  {`Import ${missing.length}`}
                </AsyncButton>
              )}
            </div>
            <div className="ml-5 divide-y border-l">
              {source.servers.map((server) => (
                <div
                  key={server.name}
                  className="flex items-center justify-between gap-3 py-2 pr-3 pl-4"
                >
                  <div className="min-w-0">
                    <p className="text-[13px]">{server.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {server.target}
                    </p>
                  </div>
                  {server.added ? (
                    <Added />
                  ) : (
                    <AsyncButton
                      onClick={() => onImport(source.id, [server.name])}
                    >
                      Import
                    </AsyncButton>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
