import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import type { Item } from "@/lib/transcript";

const NEAR_BOTTOM_PX = 32;
const AT_BOTTOM_PX = 2;

/** Follows `contentRef`'s growth at the bottom of `scrollRef` until the user scrolls up, or sends a message. */
export function useStickToBottom(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  last: Item | undefined,
) {
  const stuck = useRef(true);
  const sent = last?.kind === "message" && last.message.role === "user";

  // Before the ResizeObserver sees the new message, so it scrolls to it.
  useLayoutEffect(() => {
    if (sent) stuck.current = true;
  }, [sent]);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    let top = el.scrollTop;
    let height = el.scrollHeight;

    const follow = () => {
      if (stuck.current) el.scrollTop = el.scrollHeight;
      top = el.scrollTop;
      height = el.scrollHeight;
    };
    // At the very bottom always follows: the rubber-band bounce and subpixel
    // offsets there read as small moves up. A shrink that clamps scrollTop
    // also lowers scrollHeight, so it isn't taken for the user scrolling.
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (gap <= AT_BOTTOM_PX) stuck.current = true;
      else if (el.scrollTop < top && el.scrollHeight >= height)
        stuck.current = false;
      else if (el.scrollTop > top && gap < NEAR_BOTTOM_PX) stuck.current = true;
      top = el.scrollTop;
      height = el.scrollHeight;
    };

    const observer = new ResizeObserver(follow);
    observer.observe(content);
    observer.observe(el);
    el.addEventListener("scroll", onScroll);
    follow();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, [scrollRef, contentRef]);

  return stuck;
}
