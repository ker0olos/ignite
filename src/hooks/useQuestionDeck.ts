import { useState, type SetStateAction } from "react";
import type { ToolCall } from "../../shared/agentTypes";
import type { ToolProps } from "@/components/conversation/shared";
import { useWaitingOrder } from "@/hooks/useWaitingPlace";
import {
  type Draft,
  EMPTY_DRAFT,
  readQuestions,
  toAnswers,
  toggle,
} from "@/lib/questions";
import { waitingCalls } from "@/lib/toolRows";
import type { Transcript } from "@/lib/transcript";

type Deck = { step: number; drafts: Draft[] };

const NONE: string[] = [];
const FRESH: Deck = { step: 0, drafts: [] };

/** The shown conversation's waiting calls in the order they began to wait, shared by its rows and the composer. */
export function useWaitingCalls(transcript: Transcript | null | undefined) {
  return useWaitingOrder(
    transcript ? waitingCalls(transcript.items, transcript.tools) : NONE,
  );
}

/** The questions shown in the composer. */
export type QuestionDeck = NonNullable<ReturnType<typeof useQuestionDeck>>;

/** An ask_user call's questions one at a time, each with its draft, kept per call while the user switches away; null without one. */
export function useQuestionDeck(
  call: ToolCall | undefined,
  onApprove: ToolProps["onApprove"],
) {
  const [decks, setDecks] = useState<Record<string, Deck>>({});
  if (!call) return null;
  const id = call.id;
  const { step, drafts } = decks[id] ?? FRESH;
  const questions = readQuestions(call.arguments);
  const question = questions[step];
  if (!question) return null;
  const last = step >= questions.length - 1;
  const update = (fn: (d: Deck) => Deck) =>
    setDecks((all) => ({ ...all, [id]: fn(all[id] ?? FRESH) }));
  const change = (fn: (d: Draft) => Draft) =>
    update((d) => {
      const next = [...d.drafts];
      next[d.step] = fn(next[d.step] ?? EMPTY_DRAFT);
      return { ...d, drafts: next };
    });
  const to = (at: number) => update((d) => ({ ...d, step: at }));

  return {
    id,
    question,
    step,
    count: questions.length,
    last,
    draft: drafts[step] ?? EMPTY_DRAFT,
    setText: (text: SetStateAction<string>) =>
      change((d) => ({
        ...d,
        text: typeof text === "function" ? text(d.text) : text,
      })),
    setImages: (images: SetStateAction<Draft["images"]>) =>
      change((d) => ({
        ...d,
        images: typeof images === "function" ? images(d.images) : images,
      })),
    toggle: (label: string) =>
      change((d) => toggle(d, label, !!question.multiSelect)),
    back: step > 0 ? () => to(step - 1) : undefined,
    next: () =>
      last ? onApprove(id, true, toAnswers(questions, drafts)) : to(step + 1),
    skip: () => onApprove(id, false),
  };
}
