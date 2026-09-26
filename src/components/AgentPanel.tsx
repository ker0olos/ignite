import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { basename } from "@/lib/paths";

/** Conversation area and task composer. Not wired to an agent yet. */
export function AgentPanel({ folder }: { folder: string }) {
  return (
    <>
      {/* The empty area doubles as the title bar, so it drags the window. */}
      <main
        data-tauri-drag-region
        className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
      >
        What should we build in {basename(folder)}?
      </main>
      <form className="p-4" onSubmit={(e) => e.preventDefault()}>
        <div className="relative">
          <Textarea
            placeholder="Describe a task…"
            className="min-h-20 resize-none pr-12"
          />
          <Button
            type="submit"
            size="icon-sm"
            className="absolute right-2 bottom-2"
            disabled
          >
            <ArrowUp />
          </Button>
        </div>
      </form>
    </>
  );
}
