import { useState } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const splitTags = (text: string) =>
  Array.from(
    new Set(
      text
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );

/** A chat row's actions menu, with tag editing. */
export function ConversationTagMenu({
  title,
  tags,
  buttonClassName,
  onSave,
}: {
  title: string;
  tags: string[];
  buttonClassName?: string;
  onSave: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Chat options for ${title}`}
            className={cn("shrink-0", buttonClassName)}
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <Ellipsis className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <form
          className="grid min-w-0 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onSave(splitTags(String(data.get("tags") ?? "")));
            setOpen(false);
          }}
        >
          <div className="grid min-w-0 gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Tags
            </label>
            <Input
              key={tags.join("\0")}
              name="tags"
              autoFocus
              defaultValue={tags.join(", ")}
              placeholder="bug, design, follow-up"
              aria-label="Conversation tags"
              className="w-full min-w-0 text-[13px]"
            />
          </div>
          <Button type="submit" size="sm" className="w-full">
            Save tags
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
