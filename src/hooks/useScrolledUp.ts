import { type RefObject, useEffect, useState } from "react";

/** Whether `ref` is scrolled more than a screen above its bottom, as it scrolls or `contentRef` grows. */
export function useScrolledUp(
  ref: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () =>
      setUp(el.scrollHeight - el.scrollTop - el.clientHeight > el.clientHeight);
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (contentRef.current) observer.observe(contentRef.current);
    el.addEventListener("scroll", check, { passive: true });
    check();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, [ref, contentRef]);
  return up;
}
