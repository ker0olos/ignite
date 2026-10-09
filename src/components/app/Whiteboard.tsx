import { MarkupDialog } from "@/components/app/MarkupDialog";
import { useWhiteboard } from "@/hooks/useWhiteboard";

/** A blank page to draw on, opened with ⌘N while `enabled`. */
export function Whiteboard({ enabled }: { enabled: boolean }) {
  const [page, close] = useWhiteboard(enabled);
  if (!page) return null;
  return (
    <MarkupDialog
      image={page}
      name="Whiteboard"
      open
      onOpenChange={(open) => !open && close()}
    />
  );
}
