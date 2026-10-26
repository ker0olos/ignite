import { useState } from "react";
import { codeParts } from "@/lib/procedures";

const SHOWN = 2;

/** A procedure's hint: its steps numbered, the first two until more are asked for; all of them while `open`. */
export function ProcedureSteps({
  steps,
  open = false,
}: {
  steps: string[];
  open?: boolean;
}) {
  const [all, setAll] = useState(false);
  if (steps.length === 0) return null;
  const hidden = steps.length - SHOWN;
  // A link in place of one step would take its room without saving any.
  const collapsible = !open && hidden > 1;
  const link =
    "mt-1.5 text-xs underline decoration-muted-foreground/50 underline-offset-3 hover:decoration-foreground";
  return (
    <div className="mt-2">
      <ol className="flex flex-col gap-1">
        {(all || !collapsible ? steps : steps.slice(0, SHOWN)).map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-4 shrink-0 text-right text-[13px] leading-relaxed tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <span className="min-w-0 text-[13px] leading-relaxed text-foreground/85">
              {codeParts(s).map((p, j) =>
                p.code ? (
                  <code
                    key={j}
                    className="rounded bg-muted px-1 font-mono text-[12px]"
                  >
                    {p.text}
                  </code>
                ) : (
                  p.text
                ),
              )}
            </span>
          </li>
        ))}
      </ol>
      {collapsible && (
        <button type="button" className={link} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show ${hidden} more steps`}
        </button>
      )}
    </div>
  );
}
