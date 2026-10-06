/** A call waiting behind another for the user: its prompt opens once the ones before it are answered. */
export function WaitingTurn({
  place,
  count,
}: {
  place: number;
  count: number;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      Waiting · {place + 1}/{count}
    </p>
  );
}
