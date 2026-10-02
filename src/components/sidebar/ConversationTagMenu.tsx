import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TagEditor } from "@/components/sidebar/TagEditor";
import { cn } from "@/lib/utils";

/** A conversation row's tag button, opening its tags in a centered dialog like the command center. */
export function ConversationTagMenu({
  title,
  tags,
  allTags,
  buttonClassName,
  onSave,
}: {
  title: string;
  tags: string[];
  allTags: string[];
  buttonClassName?: string;
  onSave: (tags: string[]) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Tags for ${title}`}
            title="Tags"
            className={cn("shrink-0", buttonClassName)}
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <Tag className="size-3.5 text-muted-foreground" />
      </DialogTrigger>
      {/* Focus returning to the row's button would leave it showing, ringed. */}
      <DialogContent
        showCloseButton={false}
        finalFocus={false}
        className="top-[12%] w-[min(560px,94vw)] max-w-none translate-y-0 gap-0 overflow-hidden p-0 max-sm:top-[4%] sm:max-w-none"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogTitle className="sr-only">Tags for {title}</DialogTitle>
        <TagEditor tags={tags} allTags={allTags} onChange={onSave} />
      </DialogContent>
    </Dialog>
  );
}
