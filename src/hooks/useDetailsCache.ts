import { useCallback, useRef, useState } from "react";
import type { SessionDetails } from "../../shared/conversations";

type ReadDetails = (
  cwd: string,
  session: string,
) => Promise<SessionDetails | null>;

// Outlives the command center's remounts: a preview shows what was last read while it's read again.
const read = new Map<string, SessionDetails>();
const KEPT = 50;

const fetchDetails = async (
  details: ReadDetails,
  cwd: string,
  session: string,
) => {
  const d = await details(cwd, session);
  read.delete(session);
  if (d) read.set(session, d);
  if (read.size > KEPT) read.delete(read.keys().next().value!);
  return d;
};

/** Reads a conversation's details ahead of time, so its preview shows at once. */
export const prefetchDetails = (
  details: ReadDetails,
  cwd: string,
  session: string,
) => void fetchDetails(details, cwd, session);

/** Saved conversations' details, read again once per mount; null when one couldn't be read. */
export function useDetailsCache(details: ReadDetails) {
  const [known, setKnown] = useState<Record<string, SessionDetails | null>>(
    () => Object.fromEntries(read),
  );
  const asked = useRef(new Set<string>());
  const want = useCallback(
    (cwd: string, session: string) => {
      if (asked.current.has(session)) return;
      asked.current.add(session);
      void fetchDetails(details, cwd, session).then((d) =>
        setKnown((all) => ({ ...all, [session]: d })),
      );
    },
    [details],
  );
  return { known, want };
}
