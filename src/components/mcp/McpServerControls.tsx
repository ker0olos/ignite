import { Loader2, Pencil } from "lucide-react";
import type { McpServer } from "../../../shared/hostProtocol";
import { AsyncButton } from "@/components/mcp/AsyncButton";
import { RemoveButton } from "@/components/mcp/RemoveButton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { statusLabel } from "@/lib/mcpServers";
import { cn } from "@/lib/utils";

/** A server row's status (with sign-in when needed), switch, edit and remove. */
export function McpServerControls({
  server,
  onEdit,
  onEnabledChange,
  onSignIn,
  onRemove,
}: {
  server: McpServer;
  onEdit: () => void;
  onEnabledChange: (enabled: boolean) => void;
  onSignIn: () => Promise<void>;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {server.status === "needs-auth" ? (
        <AsyncButton onClick={onSignIn} className="gap-2">
          <span className="size-1.5 rounded-full bg-destructive" />
          Sign in
        </AsyncButton>
      ) : (
        <span className="mr-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {server.status === "checking" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <span
              className={cn(
                "size-1.5 rounded-full bg-muted-foreground/40",
                server.status === "connected" && "bg-success",
                server.status === "idle" && "bg-muted-foreground",
                server.status === "failed" && "bg-destructive",
              )}
            />
          )}
          {statusLabel(server)}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${server.name}`}
        title="Edit"
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <RemoveButton name={server.name} onConfirm={onRemove} />
      <Switch
        className="ml-2"
        aria-label={`Use ${server.name}`}
        checked={server.enabled}
        onCheckedChange={onEnabledChange}
      />
    </div>
  );
}
