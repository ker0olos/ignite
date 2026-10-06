import { expect, it } from "vitest";
import type { OpenedSession } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { shownItems } from "@/lib/routedMessage";
import { toEntry } from "./useSessionCache";

it("shows a first message the router is still reading, timed from its send", () => {
  const message = { role: "user" as const, content: "Fix it", timestamp: 7 };
  const opened = {
    session: "s1",
    messages: [],
    running: true,
    routing: message,
    approvals: [],
    queue: { steering: [], followUp: [] },
    models: [],
    thinkingLevel: "high",
    thinkingLevels: [],
    skills: [],
  } as unknown as OpenedSession;
  const entry = toEntry({} as HostClient, "/f", opened);
  if (!("transcript" in entry) || !entry.transcript) throw new Error("none");
  expect(entry.transcript).toMatchObject({
    running: true,
    routing: true,
    routedAt: 7,
  });
  expect(shownItems(entry.transcript)).toEqual([{ kind: "message", message }]);
  expect(entry.state).not.toHaveProperty("routing");
});
