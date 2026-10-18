import { type RefObject, useState } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import { useComposerImages } from "@/hooks/useComposerImages";
import { useProvideComposerText } from "@/hooks/useComposerText";
import type { QuestionDeck } from "@/hooks/useQuestionDeck";

/**
 * The composer's text and images, with attaching and pasting: the shown
 * question's while one shows, else the message's, kept for after. Text sent
 * to conversation `session` (diff comments) is added to it.
 */
export function useComposerDraft(
  deck: QuestionDeck | null,
  input: RefObject<HTMLTextAreaElement | null>,
  session: string | null,
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
  useProvideComposerText(session, draft.setText, input);
  const imageActions = useComposerImages(
    input,
    draft.text,
    draft.setText,
    draft.images,
    draft.setImages,
  );
  return { ...draft, ...imageActions };
}
