import type { Dispatch, SetStateAction } from "react";
import { Field } from "@/components/mcp/Field";
import { PairsField } from "@/components/mcp/PairsField";
import { INPUT, TEXTAREA } from "@/components/mcp/styles";
import { Textarea } from "@/components/ui/textarea";
import type { McpForm } from "@/lib/mcpServers";
import { cn } from "@/lib/utils";

/** The form fields specific to a stdio command or a remote URL server. */
export function McpServerFields({
  form,
  field,
  setForm,
}: {
  form: McpForm;
  field: (
    key: "command" | "args" | "url",
  ) => (e: { target: { value: string } }) => void;
  setForm: Dispatch<SetStateAction<McpForm>>;
}) {
  if (form.type === "stdio") {
    return (
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
    );
  }

  return (
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
  );
}
