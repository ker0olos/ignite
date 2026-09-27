/** "… +N lines" expand button shown under a truncated preview. */
export function MoreLines({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-muted-foreground hover:text-foreground"
    >
      … +{count} {count === 1 ? "line" : "lines"}
    </button>
  );
}
