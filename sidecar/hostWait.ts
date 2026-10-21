/** Wakes conversations whose bash_wait commands exited: a hidden message that starts a run. */
import { exitedWaits, onBackgroundChange } from "./backgroundBash.ts";
import { groupExitedText } from "./bashWait.ts";
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
  for (const group of exitedWaits()) {
    const id = group[0].session;
    void groupExitedText(group).then((content) => {
      const session = ctx.agents.get(id)?.session;
      // One waiting on its fork takes no messages; it reads this with its next run.
      if (!session || waitsOnFork(ctx, id)) {
        return noteFor(id, content);
      }
      return session
        .sendCustomMessage(
          { customType: "background-exit", content, display: false },
          { triggerTurn: true, deliverAs: "followUp" },
        )
        .catch(() => noteFor(id, content));
    });
  }
}
