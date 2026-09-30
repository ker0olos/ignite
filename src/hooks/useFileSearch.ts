import { useEffect, useState } from "react";
import type { FileHit } from "../../shared/conversations";
import type { HostClient } from "@/lib/piHost";

const DEBOUNCE_MS = 100;

type Found = { key: string; files: FileHit[] };

/** Files matching `query` in `folder`, as used by the VS Code-style file palette. */
export function useFileSearch(
  host: HostClient | null,
  folder: string | null,
  query: string,
) {
  const key = host && folder ? JSON.stringify([query, folder]) : null;
  const [found, setFound] = useState<Found | null>(null);

  useEffect(() => {
    if (!host || !folder || !key) return;
    const [text, cwd] = JSON.parse(key) as [string, string];
    const timer = setTimeout(() => {
      host
        .request({
          type: "command_search",
          text,
          folders: [cwd],
          kinds: ["file"],
          limit: 50,
        })
        .then((r) => setFound({ key, files: r.files }))
        .catch(() => setFound({ key, files: [] }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [host, folder, key]);

  return {
    files: key && found?.key === key ? found.files : [],
    loading: !!key && found?.key !== key,
  };
}
