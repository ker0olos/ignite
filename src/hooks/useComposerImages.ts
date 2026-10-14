import { useState, type RefObject } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import { useProvideImageTarget } from "@/hooks/useImageTarget";
import { insertImageTags } from "@/lib/mentions";

/** The composer's attached images, pasted ones tagged at the caret, and the target marked-up images are added to (focusing `input`). */
export function useComposerImages(
  input: RefObject<HTMLTextAreaElement | null>,
  text: string,
  setText: (text: string) => void,
) {
  const [images, setImages] = useState<ImageContent[]>([]);
  const attach = (added: ImageContent[]) =>
    setImages((current) => [...current, ...added]);
  useProvideImageTarget("Add to conversation", (image) => {
    attach([image]);
    input.current?.focus();
  });
  const remove = (i: number) =>
    setImages((current) => current.filter((_, j) => j !== i));
  const replace = (i: number, marked: ImageContent) =>
    setImages((current) => current.map((x, j) => (j === i ? marked : x)));
  const paste = (added: ImageContent[], start: number, end: number) => {
    const tagged = insertImageTags(
      text,
      start,
      end,
      images.length + 1,
      added.length,
    );
    attach(added);
    setText(tagged.text);
    requestAnimationFrame(() =>
      input.current?.setSelectionRange(tagged.caret, tagged.caret),
    );
  };
  return { images, setImages, attach, remove, replace, paste };
}
