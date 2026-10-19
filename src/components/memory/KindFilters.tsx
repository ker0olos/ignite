import { KindPill } from "@/components/memory/KindPill";
import { kindFilters } from "@/lib/memory";

/** The type filters above the memories: All, then each type the folder has. */
export function KindFilters({
  counts,
  kind,
  onChange,
}: {
  counts: Record<string, number>;
  kind: string | null;
  onChange: (kind: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {kindFilters(counts).map((f) => (
        <KindPill
          key={f.kind ?? "all"}
          {...f}
          pressed={f.kind === kind}
          onPress={() => onChange(f.kind)}
        />
      ))}
    </div>
  );
}
