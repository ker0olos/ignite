/** Separates alternatives: a provider takes a subscription or a key, not both. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
