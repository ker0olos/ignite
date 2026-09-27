import { Plus, X } from "lucide-react";
import { INPUT } from "@/components/mcp/styles";
import { Button } from "@/components/ui/button";
import type { Pair } from "@/lib/mcpServers";
import { cn } from "@/lib/utils";

/** Name/value rows (environment variables, headers) with add and remove. */
export function PairsField({
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
