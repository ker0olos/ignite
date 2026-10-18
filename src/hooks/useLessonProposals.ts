import { useCallback, useEffect, useState } from "react";
import type { ProposedLesson } from "../../shared/lessons";
import type { HostClient } from "@/lib/piHost";

/** The lessons the reflector proposes for conversation `session`, kept current by the sidecar's pushes. */
export function useLessonProposals(
  host: HostClient | null,
  session: string | null | undefined,
) {
  const [loaded, setLoaded] = useState<{
    session: string;
    lessons: ProposedLesson[];
  } | null>(null);
  const [error, setError] = useState<{ session: string; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!host || !session) return;
    const off = host.subscribe((m) => {
      if (m.type === "lesson_proposals" && m.session === session)
        setLoaded({ session, lessons: m.lessons });
    });
    host
      .request({ type: "lesson_proposals", session })
      .then((lessons) => setLoaded({ session, lessons }))
      .catch(() => {});
    return off;
  }, [host, session]);

  const answer = useCallback(
    async (lesson: string, keep: boolean) => {
      if (!host || !session) return;
      setError(null);
      try {
        const lessons = await host.request({
          type: "lesson_answer",
          session,
          lesson,
          keep,
        });
        setLoaded({ session, lessons });
      } catch (e) {
        setError({ session, text: (e as Error).message });
      }
    },
    [host, session],
  );

  return {
    lessons: loaded && loaded.session === session ? loaded.lessons : [],
    error: error && error.session === session ? error.text : null,
    answer,
  };
}
