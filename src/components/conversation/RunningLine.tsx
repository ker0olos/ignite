const DELAYS = ["0ms", "150ms", "300ms"];

/** Shown under a tool call that runs with nothing to show yet. */
export function RunningLine() {
  return (
    <p className="flex items-center gap-1.5">
      <span className="inline-flex gap-[3px]" aria-hidden="true">
        {DELAYS.map((delay) => (
          <i
            key={delay}
            className="size-1 animate-dot rounded-full bg-current motion-reduce:animate-none motion-reduce:opacity-60"
            style={{ animationDelay: delay }}
          />
        ))}
      </span>
      Running…
    </p>
  );
}
