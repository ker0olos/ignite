import { LinkedText } from "@/components/conversation/LinkedText";
import { cn } from "@/lib/utils";

/** One JSON value of a record, in mono: numbers and booleans coloured, null dimmed, objects compact. */
export function OutputValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="font-mono text-muted-foreground/60">null</span>;
  }
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    return (
      <span
        title={json}
        className="inline-block max-w-80 truncate align-bottom font-mono"
      >
        {json}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "font-mono",
        typeof value === "number" && "text-warning",
        typeof value === "boolean" && "text-code",
      )}
    >
      <LinkedText text={String(value)} />
    </span>
  );
}
