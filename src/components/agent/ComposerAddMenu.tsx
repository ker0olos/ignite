import { GitFork, Paperclip, PenLine, Plus } from "lucide-react";
import type { ImageContent } from "../../../shared/agentTypes";
import { Whiteboard } from "@/components/app/Whiteboard";
import { Kbd } from "@/components/agent/Kbd";
import { MENU_TRIGGER } from "@/components/agent/styles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWhiteboard } from "@/hooks/useWhiteboard";
import { pickImages } from "@/lib/images";
import { cn } from "@/lib/utils";
import { isWindows } from "@/lib/window";

/** The composer's + menu: a whiteboard (also ⌘N), images to attach, and forking the conversation. */
export function ComposerAddMenu({
  onAttach,
  canFork,
  onFork,
}: {
  onAttach: (images: ImageContent[]) => void;
  /** It has messages and isn't running. */
  canFork: boolean;
  onFork: () => void;
}) {
  const [page, close, open] = useWhiteboard(true);
  const items = [
    {
      label: "Whiteboard",
      icon: PenLine,
      description: "A blank page to draw on",
      shortcut: isWindows() ? "Ctrl+N" : "⌘N",
      onClick: open,
    },
    {
      label: "Files",
      icon: Paperclip,
      description: "Attach images",
      onClick: () => void pickImages().then(onAttach),
    },
    {
      label: "Fork",
      icon: GitFork,
      description: "A copy that reports back here",
      disabled: !canFork,
      onClick: onFork,
    },
  ];
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Add"
          // A finger-sized target on a phone, still flush with the text's edge.
          className={cn(
            MENU_TRIGGER,
            "max-sm:-ml-2.5 max-sm:size-10 max-sm:justify-center",
          )}
        >
          <Plus className="size-3.5 max-sm:size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-72">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              disabled={item.disabled}
              onClick={item.onClick}
              className="items-start"
            >
              <item.icon className="mt-0.5 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px]">{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  {item.description}
                </span>
              </div>
              {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {page && <Whiteboard page={page} onClose={close} />}
    </>
  );
}
