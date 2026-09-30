import { MARKUP_FONT, TEXT_SCALE, type Mark } from "@/lib/markup";

/** Types a text mark in place over the image (shown at `scale`, from `offset`); leaving the field (or Enter) keeps it. */
export function MarkupTextInput({
  mark,
  scale,
  offset,
  onType,
  onDone,
}: {
  mark: Mark;
  scale: number;
  offset: { x: number; y: number };
  onType: (text: string) => void;
  onDone: () => void;
}) {
  const lines = mark.text.split("\n");
  return (
    <textarea
      autoFocus
      aria-label="Text"
      value={mark.text}
      onChange={(e) => onType(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        const enter =
          e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing;
        if (!enter && e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.blur();
      }}
      rows={lines.length}
      spellCheck={false}
      style={{
        left: offset.x + mark.x * scale,
        top: offset.y + mark.y * scale,
        width: `${Math.max(4, ...lines.map((l) => l.length + 1))}ch`,
        fontSize: mark.size * TEXT_SCALE * scale,
        fontFamily: MARKUP_FONT,
        color: mark.color,
      }}
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 leading-[1.2] font-bold outline-1 outline-ring outline-dashed"
    />
  );
}
