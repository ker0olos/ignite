import { type RefObject, useState } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import { useComposerImages } from "@/hooks/useComposerImages";
import type { QuestionDeck } from "@/hooks/useQuestionDeck";

/**
 * The composer's text and images, with attaching and pasting: the shown
 * question's while one shows, else the message's, kept for after.
 */
export function useComposerDraft(
  deck: QuestionDeck | null,
  input: RefObject<HTMLTextAreaElement | null>,
) {
  const [ownText, setOwnText] = useState("");
  const [ownImages, setOwnImages] = useState<ImageContent[]>([]);
  const draft = deck
    ? {
        text: deck.draft.text,
        setText: deck.setText,
        images: deck.draft.images,
        setImages: deck.setImages,
      }
    : {
        text: ownText,
        setText: setOwnText,
        images: ownImages,
        setImages: setOwnImages,
      };
  const imageActions = useComposerImages(
    input,
    draft.text,
    draft.setText,
    draft.images,
    draft.setImages,
  );
  return { ...draft, ...imageActions };
}
