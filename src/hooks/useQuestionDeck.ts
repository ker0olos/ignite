import { useEffect, useMemo, useState, type SetStateAction } from "react";
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
import {
  type Deck,
  flushDecks,
  loadDeck,
  saveDeck,
} from "@/lib/questionDrafts";
import { waitingCalls } from "@/lib/toolRows";
import type { Transcript } from "@/lib/transcript";

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
  // A reload or closed window writes what's still waiting to be saved.
  useEffect(() => {
    window.addEventListener("pagehide", flushDecks);
    return () => {
      window.removeEventListener("pagehide", flushDecks);
      flushDecks();
    };
  }, []);
  const id = call?.id;
  const loaded = useMemo(() => (id ? loadDeck(id) : undefined), [id]);
  if (!call || !id) return null;
  const saved = () => decks[id] ?? loaded ?? FRESH;
  const { step, drafts } = saved();
  const questions = readQuestions(call.arguments);
  const question = questions[step];
  if (!question) return null;
  const last = step >= questions.length - 1;
  const update = (fn: (d: Deck) => Deck) =>
    setDecks((all) => {
      const deck = fn(all[id] ?? saved());
      saveDeck(id, deck);
      return { ...all, [id]: deck };
    });
  const change = (fn: (d: Draft) => Draft) =>
    update((d) => {
      const next = [...d.drafts];
      next[d.step] = fn(next[d.step] ?? EMPTY_DRAFT);
      return { ...d, drafts: next };
    });
  const to = (at: number) => update((d) => ({ ...d, step: at }));
  const answer: ToolProps["onApprove"] = (...args) => {
    setDecks((all) => {
      const rest = { ...all };
      delete rest[id];
      return rest;
    });
    saveDeck(id, null);
    onApprove(...args);
  };

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
    setFiles: (files: SetStateAction<NonNullable<Draft["files"]>>) =>
      change((d) => ({
        ...d,
        files: typeof files === "function" ? files(d.files ?? []) : files,
      })),
    toggle: (label: string) =>
      change((d) => toggle(d, label, !!question.multiSelect)),
    back: step > 0 ? () => to(step - 1) : undefined,
    next: () =>
      last ? answer(id, true, toAnswers(questions, drafts)) : to(step + 1),
    skip: () => answer(id, false),
  };
}
