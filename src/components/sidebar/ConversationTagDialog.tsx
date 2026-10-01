import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const splitTags = (text: string) =>
  Array.from(
    new Set(
      text
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );

/** Compact editor for a conversation's comma-separated tags. */
export function ConversationTagDialog({
  open,
  title,
  tags,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  title: string;
  tags: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (tags: string[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Edit tags</DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onSave(splitTags(String(data.get("tags") ?? "")));
            onOpenChange(false);
          }}
        >
          <Input
            key={tags.join("\0")}
            name="tags"
            autoFocus
            defaultValue={tags.join(", ")}
            placeholder="bug, design, follow-up"
            aria-label="Conversation tags"
          />
          <DialogFooter>
            <Button type="submit" size="sm">
              Save tags
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
