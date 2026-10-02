import { useRef, useState, type KeyboardEvent } from "react";
import { Kbd } from "@/components/agent/Kbd";
import { TagChip } from "@/components/sidebar/TagChip";
import { addTags, removeTag, suggestionsFor } from "@/lib/conversationTags";

/** A conversation's tags as chips, with an input to add more and suggestions from other conversations. */
export function TagEditor({
  tags,
  allTags,
  onChange,
}: {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const suggestions = suggestionsFor(allTags, tags, text);

  const commit = (value: string) => {
    if (value.trim()) onChange(addTags(tags, value));
    setText("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(text);
    } else if (event.key === "Backspace" && !text && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="grid min-w-0">
      <div
        onClick={() => input.current?.focus()}
        className="flex min-h-14 cursor-text flex-wrap items-center gap-1.5 border-b px-5 py-2.5"
      >
        {tags.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            size="md"
            onRemove={() => onChange(removeTag(tags, tag))}
          />
        ))}
        <input
          ref={input}
          autoFocus
          value={text}
          onChange={(event) => {
            const value = event.target.value;
            if (value.includes(",")) commit(value);
            else setText(value);
          }}
          onKeyDown={onKeyDown}
          placeholder={tags.length ? "" : "Add a tag"}
          aria-label="Add a tag"
          className="h-8 min-w-24 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="grid gap-2 border-b px-5 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            Suggestions
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                size="md"
                onPick={() => onChange(addTags(tags, tag))}
              />
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-4 px-4 py-2 text-xs text-muted-foreground max-sm:hidden">
        <span>
          <Kbd>↵</Kbd> to add
        </span>
        <span>
          <Kbd>⌫</Kbd> to remove the last
        </span>
        <span>
          <Kbd>esc</Kbd> to close
        </span>
      </div>
    </div>
  );
}
