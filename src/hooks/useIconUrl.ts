import { useEffect, useState } from "react";
import { iconUrl } from "@/lib/iconThemes";

/** An icon theme's image file as a URL once read; undefined until then, or without a path. */
export function useIconUrl(path: string | undefined) {
  const [url, setUrl] = useState<{ path: string; url: string }>();
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    iconUrl(path)
      .then((u) => !cancelled && setUrl({ path, url: u }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url && url.path === path ? url.url : undefined;
}
