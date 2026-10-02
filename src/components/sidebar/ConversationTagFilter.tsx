import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Filters the sidebar's conversation list by one or more tags. */
export function ConversationTagFilter({
  tags,
  selected,
  onToggle,
  onClear,
}: {
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  if (!tags.length && !selected.length) return null;
  const active = selected.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="xs" aria-label="Filter conversations" />
        }
      >
        <Filter className="size-3" />
        {active
          ? `${selected.length} tag${selected.length === 1 ? "" : "s"}`
          : "Tags"}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Filter conversations</DropdownMenuLabel>
          {tags.map((tag) => (
            <DropdownMenuCheckboxItem
              key={tag}
              checked={selected.includes(tag)}
              onClick={() => onToggle(tag)}
            >
              <span className="truncate">{tag}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClear}>
              <X className="size-3" />
              Clear filter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
