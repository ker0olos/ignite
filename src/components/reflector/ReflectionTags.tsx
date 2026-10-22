import { ENTRY_POINTS, type Reflection } from "../../../shared/reflector";

/** A point's tag: the entry point it's read at. */
export function ReflectionTags({ reflection }: { reflection: Reflection }) {
  const { label, where } = ENTRY_POINTS[reflection.entry];
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-2">
      <span className="rounded-md border px-1.5 text-[11px] leading-[18px] text-foreground/85">
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground">{where}</span>
    </span>
  );
}
