import { type RefObject, useState } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import type { SentFile } from "../../shared/attachedFiles";
import { useComposerImages } from "@/hooks/useComposerImages";
import type { QuestionDeck } from "@/hooks/useQuestionDeck";

/**
 * The composer's text, images and dropped files, with attaching and pasting:
 * the shown question's while one shows, else the message's, kept for after.
 */
export function useComposerDraft(
  deck: QuestionDeck | null,
  input: RefObject<HTMLTextAreaElement | null>,
) {
  const [ownText, setOwnText] = useState("");
  const [ownImages, setOwnImages] = useState<ImageContent[]>([]);
  const [ownFiles, setOwnFiles] = useState<SentFile[]>([]);
  const draft = deck
    ? {
        text: deck.draft.text,
        setText: deck.setText,
        images: deck.draft.images,
        setImages: deck.setImages,
        files: deck.draft.files ?? [],
        setFiles: deck.setFiles,
      }
    : {
        text: ownText,
        setText: setOwnText,
        images: ownImages,
        setImages: setOwnImages,
        files: ownFiles,
        setFiles: setOwnFiles,
      };
  const imageActions = useComposerImages(
    input,
    draft.text,
    draft.setText,
    draft.images,
    draft.setImages,
    (file) => draft.setFiles((f) => [...f, file]),
  );
  return { ...draft, ...imageActions };
}
