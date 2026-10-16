import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flushDecks, loadDeck, saveDeck } from "./questionDrafts";

const deck = { step: 1, drafts: [{ picked: ["A"], text: "x", images: [] }] };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("saves a call's draft once typing pauses, and forgets it when answered", () => {
  saveDeck("q1", deck);
  expect(loadDeck("q1")).toBeUndefined();
  vi.advanceTimersByTime(300);
  expect(loadDeck("q1")).toEqual(deck);
  saveDeck("q1", null);
  flushDecks();
  expect(loadDeck("q1")).toBeUndefined();
});

it("keeps other calls' drafts, which another window may have saved", () => {
  saveDeck("q1", deck);
  flushDecks();
  saveDeck("q2", deck);
  flushDecks();
  expect(loadDeck("q1")).toEqual(deck);
});

it("forgets week-old and unreadable drafts", () => {
  localStorage.setItem(
    "question-draft:old",
    JSON.stringify({ at: Date.now() - 8 * 24 * 60 * 60 * 1000, deck }),
  );
  localStorage.setItem("question-draft:bad", "{");
  localStorage.setItem("other", "kept");
  flushDecks();
  expect(loadDeck("old")).toBeUndefined();
  expect(localStorage.getItem("question-draft:bad")).toBeNull();
  expect(localStorage.getItem("other")).toBe("kept");
});

it("keeps going when storage refuses a write", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
    throw new Error("QuotaExceededError");
  });
  saveDeck("q1", deck);
  expect(() => flushDecks()).not.toThrow();
  expect(loadDeck("q1")).toBeUndefined();
});
