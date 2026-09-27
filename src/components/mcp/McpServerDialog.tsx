import { useState, type FormEvent } from "react";
import type { McpServer, McpServerConfig } from "../../../shared/hostProtocol";
import { Field } from "@/components/mcp/Field";
import { McpServerFields } from "@/components/mcp/McpServerFields";
import { INPUT } from "@/components/mcp/styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMPTY_FORM, readForm, toForm, type McpForm } from "@/lib/mcpServers";

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
          <McpServerFields form={form} field={field} setForm={setForm} />
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
