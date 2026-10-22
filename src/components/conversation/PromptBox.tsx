import { CopyButton } from "@/components/conversation/CopyButton";

/** A label over a boxed text that copies on hover. */
export function PromptBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-2">
      <span className="block text-muted-foreground">{label}</span>
      <div className="group relative rounded-md border bg-muted/40 py-2 pr-10 pl-3">
        <p>{text}</p>
        <div className="absolute top-1 right-1 rounded-md bg-background opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton text={() => text} />
        </div>
      </div>
    </div>
  );
}
