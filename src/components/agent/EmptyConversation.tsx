import { basename } from "@/lib/paths";

/** The empty area doubles as the title bar, so it drags the window. */
export function EmptyConversation({ folder }: { folder: string }) {
  return (
    <div
      data-tauri-drag-region
      className="always-bounce flex h-full items-center justify-center text-sm text-muted-foreground"
    >
      What should we build in {basename(folder)}?
    </div>
  );
}
