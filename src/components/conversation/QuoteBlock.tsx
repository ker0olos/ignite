import { createContext, useContext, type ReactNode } from "react";
import { CopyButton } from "@/components/conversation/CopyButton";

const InQuote = createContext(false);

/** An assistant blockquote: a draft for the user to paste elsewhere, copied as written. Nested ones get no button of their own. */
export function QuoteBlock({
  source,
  children,
}: {
  source: string;
  children: ReactNode;
}) {
  const nested = useContext(InQuote);
  const quote = (
    <blockquote className="border-l-2 py-0.5 pr-9 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  );
  if (nested) return quote;

  return (
    <InQuote.Provider value={true}>
      <div className="group relative mb-2 last:mb-0">
        {quote}
        <div className="absolute top-0 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton text={() => source} />
        </div>
      </div>
    </InQuote.Provider>
  );
}
