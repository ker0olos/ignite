import { Moon } from "lucide-react";
import { AWAY_DENIED } from "../../../shared/hostProtocol";
import { OutputPreview } from "@/components/conversation/OutputPreview";

/** A failed call's outcome: a denial while the user was away said plainly (after a blocked command's report), any other error as it is. */
export function ToolError({ text }: { text: string }) {
  if (!text.endsWith(AWAY_DENIED)) {
    return <OutputPreview text={text || "Failed."} error />;
  }
  const report = text.slice(0, -AWAY_DENIED.length).trim();
  return (
    <>
      {report && <OutputPreview text={report} />}
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <Moon aria-hidden className="size-3.5 shrink-0" />
        Denied while you were away
      </p>
    </>
  );
}
