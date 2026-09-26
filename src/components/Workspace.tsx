import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { basename, dirname, tildify } from "@/lib/paths";

/** Header, conversation area and task composer for an open folder. */
export function Workspace({ folder, home }: { folder: string; home: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header
        data-tauri-drag-region
        className="flex h-13 shrink-0 items-center gap-2 border-b px-4"
      >
        <span data-tauri-drag-region className="text-[13px] font-semibold">
          {basename(folder)}
        </span>
        <span
          data-tauri-drag-region
          className="truncate text-[13px] text-muted-foreground"
        >
          {tildify(dirname(folder), home)}
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        What should we build in {basename(folder)}?
      </main>
      {/* Not wired to an agent yet. */}
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
    </div>
  );
}
