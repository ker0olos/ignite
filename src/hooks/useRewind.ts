import { useCallback } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import type { SkillInfo } from "../../shared/skills";
import type { HostClient } from "@/lib/piHost";
import { skillPrompt } from "@/lib/mentions";

/**
 * Edits one of the shown conversation's user messages: it goes back to just
 * before it and sends `text` in its place. Resolves false when refused, its
 * reason in the error line.
 */
export function useRewind(
  opened: HostClient | null,
  session: string | null,
  skills: SkillInfo[],
  setError: (e: string | null) => void,
) {
  return useCallback(
    async (entryId: string, text: string, images: ImageContent[]) => {
      if (!opened || !session) return false;
      setError(null);
      try {
        await opened.request({
          type: "rewind",
          session,
          entryId,
          text: skillPrompt(text, skills),
          ...(images.length > 0 && { images }),
        });
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      }
    },
    [opened, session, skills, setError],
  );
}
