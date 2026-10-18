import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import type { SentFile } from "../../shared/attachedFiles";
import { useProvideImageTarget } from "@/hooks/useImageTarget";
import { imageName, named } from "@/lib/images";
import { insertImageTags } from "@/lib/mentions";

/** The composer's attached images (the message's, or a question's), pasted ones tagged at the caret, and the target marked-up images are added to (focusing `input`). */
export function useComposerImages(
  input: RefObject<HTMLTextAreaElement | null>,
  text: string,
  setText: (text: string) => void,
  images: ImageContent[],
  setImages: Dispatch<SetStateAction<ImageContent[]>>,
  /** Takes files dropped on the window. */
  addFile: (file: SentFile) => void,
) {
  const attach = (added: ImageContent[]) =>
    setImages((current) => [...current, ...added]);
  useProvideImageTarget(
    "Add to conversation",
    (image, name) => {
      attach([named(image, name)]);
      input.current?.focus();
    },
    (file) => {
      addFile(file);
      input.current?.focus();
    },
  );
  const remove = (i: number) =>
    setImages((current) => current.filter((_, j) => j !== i));
  // A marked-up image keeps the file name it came from.
  const replace = (i: number, marked: ImageContent) =>
    setImages((current) =>
      current.map((x, j) => {
        if (j !== i) return x;
        const name = imageName(x);
        return name ? named(marked, name) : marked;
      }),
    );
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
  return { attach, remove, replace, paste };
}
