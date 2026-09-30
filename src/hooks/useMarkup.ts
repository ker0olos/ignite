import { useRef, useState } from "react";
import {
  commit,
  extendMark,
  isEmpty,
  MARKUP_COLORS,
  NO_MARKS,
  redo,
  startMark,
  strokeWidth,
  undo,
  type Mark,
  type MarkupKeyAction,
  type MarkupSize,
  type MarkupTool,
} from "@/lib/markup";

type Point = { x: number; y: number };

/**
 * The marks drawn on an image, with undo and redo; the tool, ink and size to
 * draw with; and the text mark being typed, if any.
 */
export function useMarkup(image: { width: number; height: number }) {
  const [history, setHistory] = useState(NO_MARKS);
  const [draft, setDraft] = useState<Mark | null>(null);
  const [editing, setEditing] = useState<Mark | null>(null);
  const [tool, setTool] = useState<MarkupTool>("pen");
  const [color, setColor] = useState(MARKUP_COLORS[0]);
  const [size, setSize] = useState<MarkupSize>("s");
  const nextId = useRef(0);
  const marks = history.present;

  // Adding a mark twice is a no-op: a text field's late blur can repeat its finish.
  const add = (mark: Mark) =>
    setHistory((h) =>
      h.present.some((m) => m.id === mark.id)
        ? h
        : commit(h, [...h.present, mark]),
    );
  const finishText = () => {
    setEditing(null);
    if (editing && !isEmpty(editing)) add(editing);
  };

  return {
    marks,
    draft,
    editing,
    tool,
    setTool,
    color,
    setColor,
    size,
    setSize,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    /** Starts a mark; while text is being typed, a click finishes it instead. */
    begin(at: Point) {
      if (editing) return finishText();
      const id = `m${nextId.current++}`;
      const mark = startMark(id, tool, at, color, strokeWidth(image, size));
      if (tool === "text") setEditing(mark);
      else setDraft(mark);
    },
    extend(at: Point) {
      setDraft((d) => d && extendMark(d, at));
    },
    /** Drops the stroke being drawn (a second finger turned it into a pinch). */
    cancel: () => setDraft(null),
    end() {
      if (draft && !isEmpty(draft)) add(draft);
      setDraft(null);
    },
    /** The text mark being typed now reads `text`. */
    type(text: string) {
      setEditing((e) => e && { ...e, text });
    },
    finishText,
    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
    clear() {
      if (marks.length) setHistory((h) => commit(h, []));
    },
    /** Runs a shortcut's action; false when it isn't one for the marks (zoom, done). */
    act(action: MarkupKeyAction) {
      if (typeof action === "object") setTool(action.tool);
      else if (action === "undo") setHistory(undo);
      else if (action === "redo") setHistory(redo);
      else return false;
      return true;
    },
  };
}
