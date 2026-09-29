import { useCallback, useRef, useState } from "react";
import type { SessionDetails } from "../../shared/conversations";

/** Saved conversations' details, each asked for once; null when it couldn't be read. */
export function useDetailsCache(
  details: (cwd: string, session: string) => Promise<SessionDetails | null>,
) {
  const [known, setKnown] = useState<Record<string, SessionDetails | null>>({});
  const asked = useRef(new Set<string>());
  const want = useCallback(
    (cwd: string, session: string) => {
      if (asked.current.has(session)) return;
      asked.current.add(session);
      void details(cwd, session).then((d) =>
        setKnown((all) => ({ ...all, [session]: d })),
      );
    },
    [details],
  );
  return { known, want };
}
