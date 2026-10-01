import { GitCommitHorizontal } from "lucide-react";

/** A commit's message: its subject as the headline, the rest below. */
export function GitCommitHeader({
  message,
  push,
}: {
  message?: string;
  push?: string;
}) {
  const [subject, ...rest] = (message ?? "").trim().split("\n");
  const body = rest.join("\n").trim();
  return (
    <div className="space-y-1 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <GitCommitHorizontal className="size-3.5" />
        {push ? `Commit and push to origin/${push}` : "Commit"}
      </p>
      <p className="text-[14px] font-medium text-foreground">
        {subject || "No message"}
      </p>
      {body && (
        <p className="text-[13px] whitespace-pre-wrap text-muted-foreground">
          {body}
        </p>
      )}
    </div>
  );
}
