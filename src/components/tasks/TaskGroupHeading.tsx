/** A Tasks view group's tracked header with its count. */
export function TaskGroupHeading({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <h2 className="mb-1 flex gap-2 border-b px-2.5 pt-6 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {label}
      <span className="font-normal">{count}</span>
    </h2>
  );
}
