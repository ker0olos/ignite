/**
 * Demo mode (`npm run demo`): the app opens demo/tempo and demo/pantry and
 * shows fixed conversations instead of pi sessions, for screenshots and
 * trying the UI. Pantry's waits on the agent's questions.
 * Nothing is saved or run, so clearing sessions or app state never loses it.
 */
import type {
  AgentStatus,
  ProjectTrust,
  SessionState,
} from "../../shared/hostProtocol";
import { demoQuestionTranscript } from "./demoQuestions";
import { DEMO_MESSAGES } from "./demoTranscript";
import { dirname } from "./paths";
import { fromHistory, type Transcript } from "./transcript";

/** The demo project's folder while in demo mode, otherwise null. */
export const DEMO_FOLDER: string | null = __DEMO_FOLDER__;

const pantry = (demo: string) => `${dirname(demo)}/pantry`;

/** The projects demo mode opens, the shown one last. */
export const demoProjects = (demo: string) => [pantry(demo), demo];

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
  session: string | null;
  state: SessionState | null;
  transcript: Transcript | null;
  trust: ProjectTrust | null;
  error: string | null;
};

/**
 * The session as the workspace shows it: in demo mode the shown folder's demo
 * conversation in place of pi's; otherwise with the host's error when the
 * sidecar didn't start, since the session then never opens.
 */
export function shownSession<S extends View>(
  session: S,
  hostError: string | null,
  current: string | null,
  demo: string | null = DEMO_FOLDER,
): S {
  if (!demo) return { ...session, error: session.error ?? hostError };
  return {
    ...session,
    session: current === pantry(demo) ? "pantry" : "tempo",
    state: DEMO_STATE,
    transcript:
      current === pantry(demo)
        ? demoQuestionTranscript()
        : fromHistory(DEMO_MESSAGES, false),
    trust: "trusted",
    error: null,
  };
}

/**
 * A folder's listed conversations; in demo mode fixed ones: Tempo's with a
 * second working in the background, and Pantry's waiting on its questions.
 */
export function shownRows(
  rows: (cwd: string) => AgentStatus[],
  demo: string | null = DEMO_FOLDER,
): (cwd: string) => AgentStatus[] {
  if (!demo) return rows;
  const idle = { cwd: demo, running: false, waiting: false };
  const all = [
    {
      cwd: pantry(demo),
      session: "pantry",
      title: "Let people sign in to Pantry",
      running: true,
      waiting: true,
    },
    { ...idle, session: "tempo", title: "Add a dark mode to Tempo" },
    {
      ...idle,
      session: "tempo-tests",
      title: "Write tests for recurring tasks",
      running: true,
    },
  ];
  return (cwd) => all.filter((a) => a.cwd === cwd);
}
