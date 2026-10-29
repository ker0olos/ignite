import type { AgentStatus } from "../../shared/hostProtocol";
import { basename } from "@/lib/paths";

type Notice = {
  session: string;
  cwd: string;
  waiting: boolean;
  title: string;
  body: string;
};

const waitingBody = (a: AgentStatus) =>
  a.review?.review?.pr ? "Pull request ready for review" : "Waiting for you";

const bodyOf = (a: AgentStatus, prev?: AgentStatus) => {
  if (a.waiting) return prev?.waiting ? null : waitingBody(a);
  if (!prev?.running || a.running) return null;
  return a.failed ? "Stopped with an error" : "Finished";
};

/** The conversations that just finished or started waiting on the user, between two agent lists. */
/**
 * The chime notifications play: a macOS system sound, else the freedesktop
 * theme's; Windows toasts play their own.
 */
export const chime = (isMac: boolean) =>
  isMac ? "Glass" : "message-new-instant";

export function notices(before: AgentStatus[], after: AgentStatus[]): Notice[] {
  const was = new Map(before.map((a) => [a.session, a]));
  return after.flatMap((a) => {
    const body = bodyOf(a, was.get(a.session));
    if (!body) return [];
    const title = `${a.title || "Conversation"} · ${basename(a.cwd)}`;
    return [
      { session: a.session, cwd: a.cwd, waiting: a.waiting, title, body },
    ];
  });
}

/** Whether a notified conversation is still open and still waiting, or still finished, as its notice said. */
export function stillAsNotified(
  notice: { session: string; waiting: boolean },
  agents: AgentStatus[],
) {
  const a = agents.find((x) => x.session === notice.session);
  if (!a) return false;
  return notice.waiting ? a.waiting : !a.running && !a.waiting;
}
