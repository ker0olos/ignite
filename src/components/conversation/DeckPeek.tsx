/** The edges of up to two cards behind the one shown, for a deck of questions or waiting calls. */
export function DeckPeek({ behind }: { behind: number }) {
  return (
    <>
      {behind > 0 && (
        <div
          aria-hidden
          className="mx-2 h-1.5 rounded-b-lg border border-t-0 bg-card"
        />
      )}
      {behind > 1 && (
        <div
          aria-hidden
          className="mx-4 h-1.5 rounded-b-lg border border-t-0 bg-card/60"
        />
      )}
    </>
  );
}
