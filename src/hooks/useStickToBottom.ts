import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import type { Item } from "@/lib/transcript";

const NEAR_BOTTOM_PX = 32;
const AT_BOTTOM_PX = 2;

/**
 * Follows `contentRef`'s growth at the bottom of `scrollRef` until the user
 * scrolls up, or sends a message. The place is the hook's, not the element's:
 * while hidden its scrollTop is ignored, and showing it puts the place back.
 */
export function useStickToBottom(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  last: Item | undefined,
  shown: boolean,
) {
  const stuck = useRef(true);
  const visible = useRef(shown);
  const restore = useRef<() => void>(undefined);
  const sent = last?.kind === "message" && last.message.role === "user";

  // Before the ResizeObserver sees the new message, so it scrolls to it.
  useLayoutEffect(() => {
    if (sent) stuck.current = true;
  }, [sent]);

  useLayoutEffect(() => {
    visible.current = shown;
    if (shown) restore.current?.();
  }, [shown]);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    let top = el.scrollTop;
    let height = el.scrollHeight;
    let width = el.clientWidth;
    let view = el.clientHeight;
    const record = () => {
      top = el.scrollTop;
      height = el.scrollHeight;
      width = el.clientWidth;
      view = el.clientHeight;
    };

    // A width change (an editor tab opening) reflows the text; WebKit has no
    // scroll anchoring, so the middle of the view keeps its share of the height.
    const follow = () => {
      if (el.clientWidth === 0) return;
      if (stuck.current) el.scrollTop = el.scrollHeight;
      else if (el.clientWidth !== width && height > 0) {
        const middle = ((top + view / 2) / height) * el.scrollHeight;
        el.scrollTop = middle - el.clientHeight / 2;
      } else if (!visible.current) el.scrollTop = top;
      record();
    };
    restore.current = () => {
      el.scrollTop = stuck.current ? el.scrollHeight : top;
      record();
    };
    // At the very bottom always follows: the rubber-band bounce and subpixel
    // offsets there read as small moves up. A shrink that clamps scrollTop
    // also lowers scrollHeight, so it isn't taken for the user scrolling.
    const onScroll = () => {
      if (!visible.current) return;
      // The browser clamping scrollTop as the text reflows, not the user.
      if (el.clientWidth !== width) return follow();
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (gap <= AT_BOTTOM_PX) stuck.current = true;
      else if (el.scrollTop < top && el.scrollHeight >= height)
        stuck.current = false;
      else if (el.scrollTop > top && gap < NEAR_BOTTOM_PX) stuck.current = true;
      record();
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
