/** Wakes conversations whose bash_wait commands exited: a hidden message that starts a run. */
import { exitedWaits, onBackgroundChange } from "./backgroundBash.ts";
import { exitedText } from "./bashWait.ts";
import { noteFor } from "./forks.ts";
import { pushProjects, waitsOnFork } from "./hostProjects.ts";
import type { HostContext } from "./hostTypes.ts";

/** Pushes the sidebar and wakes conversations as background commands start and end; returns the unsubscribe. */
export const watchBackground = (ctx: HostContext) =>
  onBackgroundChange(() => {
    pushProjects(ctx);
    wakeWaiting(ctx);
  });

/** Tells each conversation about the commands it waits on that have exited. */
export function wakeWaiting(ctx: HostContext) {
  for (const b of exitedWaits()) {
    void exitedText(b).then((content) => {
      const session = ctx.agents.get(b.session)?.session;
      // One waiting on its fork takes no messages; it reads this with its next run.
      if (!session || waitsOnFork(ctx, b.session)) {
        return noteFor(b.session, content);
      }
      return session
        .sendCustomMessage(
          { customType: "background-exit", content, display: false },
          { triggerTurn: true, deliverAs: "followUp" },
        )
        .catch(() => noteFor(b.session, content));
    });
  }
}
