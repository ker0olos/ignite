import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useCommentReveal } from "@/hooks/useCommentReveal";
import { revealDiffComment, revealedComment } from "@/lib/diffComments";

it("scrolls the revealed comment's card into view and flashes it, once", () => {
  const card = document.createElement("div");
  card.scrollIntoView = vi.fn();
  card.animate = vi.fn();
  const { result, rerender } = renderHook(({ id }) => useCommentReveal(id), {
    initialProps: { id: 3 },
  });
  result.current.current = card;
  act(() => revealDiffComment(4));
  expect(card.scrollIntoView).not.toHaveBeenCalled();

  act(() => revealDiffComment(3));
  expect(card.scrollIntoView).toHaveBeenCalledWith({
    block: "center",
    behavior: "smooth",
  });
  expect(card.animate).toHaveBeenCalledTimes(1);
  expect(revealedComment()).toBeNull();

  rerender({ id: 3 });
  expect(card.animate).toHaveBeenCalledTimes(1);
});
