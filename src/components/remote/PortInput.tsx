import { useState } from "react";

/** Port field that saves on Enter or blur; anything but 1024–65535 goes back. */
export function PortInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setDraft(String(value));
  }

  const commit = () => {
    const port = Number(draft);
    if (Number.isInteger(port) && port >= 1024 && port <= 65535) {
      if (port !== value) onCommit(port);
    } else setDraft(String(value));
  };

  return (
    <input
      aria-label="Port"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="h-7 w-20 rounded-md border bg-background px-2 font-mono text-[12px]"
    />
  );
}
