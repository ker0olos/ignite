import { useEffect, useState } from "react";
import { iconUrl, iconUrlNow } from "@/lib/iconThemes";

/** An icon theme's image file as a URL: undefined while it's read, null if it can't be. */
export function useIconUrl(path: string | undefined) {
  const [read, setRead] = useState<{ path: string; url: string | null }>();
  const now = path ? iconUrlNow(path) : undefined;
  useEffect(() => {
    if (!path || now) return;
    let cancelled = false;
    iconUrl(path).then(
      (url) => !cancelled && setRead({ path, url }),
      () => !cancelled && setRead({ path, url: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [path, now]);
  if (now) return now;
  return read && read.path === path ? read.url : undefined;
}
