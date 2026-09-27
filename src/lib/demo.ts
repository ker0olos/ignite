/**
 * Demo mode (`npm run demo`): the app opens demo/tempo and shows a fixed
 * conversation instead of a pi session, for screenshots and trying the UI.
 * Nothing is saved or run, so clearing sessions or app state never loses it.
 */
import type { ProjectTrust, SessionState } from "../../shared/hostProtocol";
import { DEMO_MESSAGES } from "./demoTranscript";
import { fromHistory, type Transcript } from "./transcript";

/** The demo project's folder while in demo mode, otherwise null. */
export const DEMO_FOLDER: string | null = __DEMO_FOLDER__;

const claude = (id: string, name: string) => ({
  provider: "claude-bridge",
  id,
  name,
});
const OPUS = claude("claude-opus-5-5", "Claude Opus 5.5");

/** The composer's model and effort in the demo. */
export const DEMO_STATE: SessionState = {
  models: [
    claude("claude-fable-5-1", "Claude Fable 5.1"),
    OPUS,
    claude("claude-sonnet-5", "Claude Sonnet 5"),
    claude("claude-haiku-4-5", "Claude Haiku 4.5"),
  ],
  model: OPUS,
  thinkingLevel: "high",
  thinkingLevels: ["off", "low", "medium", "high", "xhigh", "max"],
};

type View = {
  state: SessionState | null;
  transcript: Transcript | null;
  trust: ProjectTrust | null;
  error: string | null;
};

/**
 * The session as the workspace shows it: in demo mode the demo conversation
 * in place of pi's; otherwise with the host's error when the sidecar didn't
 * start, since the session then never opens.
 */
export function shownSession<S extends View>(
  session: S,
  hostError: string | null,
  folder: string | null = DEMO_FOLDER,
): S {
  if (!folder) return { ...session, error: session.error ?? hostError };
  return {
    ...session,
    state: DEMO_STATE,
    transcript: fromHistory(DEMO_MESSAGES, false),
    trust: "trusted",
    error: null,
  };
}
