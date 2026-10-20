import { useState } from "react";
import { apiKeyProblem } from "../../../shared/validation";
import { Button } from "@/components/ui/button";

/** Entry for an Anthropic API key to fall back to. */
export function FallbackKeyForm({
  onSave,
  onCancel,
}: {
  onSave: (key: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    const found = apiKeyProblem(key);
    setProblem(found);
    if (found) return;
    try {
      await onSave(key.trim());
    } catch (e) {
      setProblem((e as Error).message);
    }
  };

  return (
    <form
      className="rounded-lg border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="text-[13px] font-medium">Add a fallback API key</label>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Stored only on this Mac. You can remove it anytime.
      </p>
      <input
        type="password"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setProblem(null);
        }}
        placeholder="sk-ant-…"
        aria-label="API key"
        spellCheck={false}
        autoFocus
        className="mt-3 h-8 w-full rounded-md border bg-background px-2.5 font-mono text-[13px] select-text"
      />
      {problem && <p className="mt-1.5 text-xs text-destructive">{problem}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Save key
        </Button>
      </div>
    </form>
  );
}
