/** A completed `read` tool call's line count. */
export function ReadToolBody({
  running,
  text,
}: {
  running: boolean;
  text: string;
}) {
  if (running) return null;
  const count = text ? text.split("\n").length : 0;
  return (
    <p>
      Read <span className="font-medium text-foreground">{count}</span>{" "}
      {count === 1 ? "line" : "lines"}
    </p>
  );
}
