import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type {
  McpCatalog,
  McpServer,
  McpServerConfig,
} from "../../shared/hostProtocol";
import { AppIcon, PresetTile } from "@/components/McpIcons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_FORM,
  readForm,
  statusLabel,
  toForm,
  type McpForm,
  type Pair,
} from "@/lib/mcpServers";
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

function RemoveButton({
  name,
  onConfirm,
}: {
  name: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${name}`}
            title="Remove"
          />
        }
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Remove {name}?</DialogTitle>
          <DialogDescription>
            The agent can no longer use its tools. You can add it again anytime.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" />}
            onClick={onConfirm}
          >
            Remove
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Preset servers offered for one-click adding. */
export function McpQuickAdd({
  presets,
  onAdd,
}: {
  presets: McpCatalog["presets"];
  onAdd: (id: string) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {presets.map((preset) => (
        <div
          key={preset.id}
          className="flex items-center gap-3 rounded-md border p-2.5"
        >
          <PresetTile id={preset.id} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{preset.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {preset.summary}
            </p>
            {preset.signIn && !preset.added && (
              <p className="text-xs text-muted-foreground">Needs sign-in</p>
            )}
          </div>
          {preset.added ? (
            <Added />
          ) : (
            <AsyncButton onClick={() => onAdd(preset.id)}>Add</AsyncButton>
          )}
        </div>
      ))}
    </div>
  );
}

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

function Added() {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <Check className="size-3.5" /> Added
    </span>
  );
}

/** An outline button that disables itself until its own request settles. */
function AsyncButton({
  onClick,
  className,
  children,
}: {
  onClick: () => Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("shrink-0", className)}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await onClick();
        setPending(false);
      }}
    >
      {children}
    </Button>
  );
}

const TYPES = [
  { value: "http", label: "Remote URL" },
  { value: "stdio", label: "Local command" },
] satisfies { value: McpServerConfig["type"]; label: string }[];

/**
 * Adds a server, or edits `server`. Stays open with the problem shown until
 * the sidecar has saved it.
 */
export function McpServerDialog({
  open,
  onOpenChange,
  server,
  taken,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: McpServer | null;
  /** The other servers' names. */
  taken: string[];
  onSave: (
    name: string,
    config: McpServerConfig,
    previousName?: string,
  ) => Promise<string | null>;
}) {
  const [form, setForm] = useState<McpForm>(EMPTY_FORM);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Fill the form each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(server ? toForm(server) : EMPTY_FORM);
      setProblem(null);
    }
  }

  const field =
    (key: "name" | "command" | "args" | "url") =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const read = readForm(form, taken);
    if ("problem" in read) return setProblem(read.problem);
    setSaving(true);
    const failed = await onSave(read.name, read.config, server?.name);
    setSaving(false);
    setProblem(failed);
    if (!failed) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4 text-[13px]">
          <DialogHeader>
            <DialogTitle>
              {server ? `Edit ${server.name}` : "Add an MCP server"}
            </DialogTitle>
            <DialogDescription>
              Values can read environment variables with {"${NAME}"}.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name">
            <input
              value={form.name}
              onChange={field("name")}
              placeholder="github"
              spellCheck={false}
              autoComplete="off"
              className={INPUT}
            />
          </Field>
          <Field label="Type">
            <Select
              items={TYPES}
              value={form.type}
              onValueChange={(type) => type && setForm((f) => ({ ...f, type }))}
            >
              <SelectTrigger size="sm" className="w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {TYPES.map((t) => (
                  <SelectItem
                    key={t.value}
                    value={t.value}
                    className="text-[13px]"
                  >
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {form.type === "stdio" ? (
            <>
              <Field label="Command">
                <input
                  value={form.command}
                  onChange={field("command")}
                  placeholder="npx"
                  spellCheck={false}
                  autoComplete="off"
                  className={cn(INPUT, "font-mono text-[12px]")}
                />
              </Field>
              <Field label="Arguments" hint="One per line.">
                <Textarea
                  value={form.args}
                  onChange={field("args")}
                  placeholder={"-y\n@modelcontextprotocol/server-github"}
                  spellCheck={false}
                  className={TEXTAREA}
                />
              </Field>
              <PairsField
                label="Environment"
                add="Add variable"
                keyPlaceholder="GITHUB_TOKEN"
                valuePlaceholder="${GITHUB_TOKEN}"
                pairs={form.env}
                onChange={(env) => setForm((f) => ({ ...f, env }))}
              />
            </>
          ) : (
            <>
              <Field label="URL">
                <input
                  value={form.url}
                  onChange={field("url")}
                  placeholder="https://mcp.example.com/mcp"
                  spellCheck={false}
                  autoComplete="off"
                  className={cn(INPUT, "font-mono text-[12px]")}
                />
              </Field>
              <PairsField
                label="Headers"
                add="Add header"
                keyPlaceholder="Authorization"
                valuePlaceholder="Bearer ${API_TOKEN}"
                pairs={form.headers}
                onChange={(headers) => setForm((f) => ({ ...f, headers }))}
              />
            </>
          )}
          {problem && <p className="text-destructive">{problem}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {server ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const INPUT = "h-7 w-full rounded-md border bg-background px-2 text-[13px]";
const TEXTAREA = "min-h-14 font-mono text-[12px] md:text-[12px]";

/** Name/value rows (environment variables, headers) with add and remove. */
function PairsField({
  label,
  add,
  keyPlaceholder,
  valuePlaceholder,
  pairs,
  onChange,
}: {
  label: string;
  add: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  pairs: readonly Pair[];
  onChange: (pairs: Pair[]) => void;
}) {
  const set = (i: number, change: Partial<Pair>) =>
    onChange(pairs.map((p, j) => (j === i ? { ...p, ...change } : p)));
  return (
    <div className="grid gap-1.5">
      <span>{label}</span>
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            aria-label={`${label} name`}
            value={pair.key}
            onChange={(e) => set(i, { key: e.target.value })}
            placeholder={keyPlaceholder}
            spellCheck={false}
            autoComplete="off"
            className={cn(INPUT, "w-2/5 font-mono text-[12px]")}
          />
          <input
            aria-label={`${label} value`}
            value={pair.value}
            onChange={(e) => set(i, { value: e.target.value })}
            placeholder={valuePlaceholder}
            spellCheck={false}
            autoComplete="off"
            className={cn(INPUT, "min-w-0 flex-1 font-mono text-[12px]")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${pair.key || "row"}`}
            onClick={() => onChange(pairs.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => onChange([...pairs, { key: "", value: "" }])}
      >
        <Plus />
        {add}
      </Button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-baseline justify-between">
        {label}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
