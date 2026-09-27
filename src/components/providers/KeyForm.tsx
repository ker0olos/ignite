import { useState } from "react";
import { apiKeyProblem } from "../../../shared/hostProtocol";
import type { Option } from "@/components/providers/ConnectProviders";
import { Button } from "@/components/ui/button";

/** API-key entry for a provider that doesn't offer sign-in here. */
export function KeyForm({
  option,
  onSave,
  onCancel,
}: {
  option: Option;
  onSave: (key: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <form
      className="rounded-lg border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const found = apiKeyProblem(key);
        setProblem(found);
        if (!found) void onSave(key.trim());
      }}
    >
      <label className="text-[13px] font-medium">{option.label}</label>
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
        placeholder={option.keyPlaceholder}
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
