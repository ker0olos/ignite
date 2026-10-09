import { useState, type RefObject } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import { useProvideImageTarget } from "@/hooks/useImageTarget";

/** The composer's attached images, and the target marked-up images are added to (focusing `input`). */
export function useComposerImages(
  input: RefObject<HTMLTextAreaElement | null>,
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
  return { images, setImages, attach, remove, replace };
}
