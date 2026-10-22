import type { SessionState, ThinkingLevel } from "./hostProtocol.ts";

/** A conversation's model and effort: read, or chosen (the shown one without `session`). */
export type ModelChoiceRequest =
  | { id: number; type: "session_state"; session?: string }
  /**
   * What a new conversation would start with (models, model, effort), for a
   * folder with none; `model` and `level` stand in for the saved defaults.
   */
  | {
      id: number;
      type: "draft_state";
      model?: { provider: string; id: string };
      level?: ThinkingLevel;
    }
  | {
      id: number;
      type: "set_model";
      provider: string;
      modelId: string;
      session?: string;
    }
  | {
      id: number;
      type: "set_thinking_level";
      level: ThinkingLevel;
      session?: string;
    }
  /** Router picks the model and effort for the conversation's next message. */
  | { id: number; type: "route_next"; session?: string }
  /** Makes a model the default for new conversations, with none open to pick it in. */
  | {
      id: number;
      type: "save_default_model";
      provider: string;
      modelId: string;
    };

export type ModelChoiceResponses = {
  session_state: SessionState;
  draft_state: SessionState;
  set_model: SessionState;
  set_thinking_level: SessionState;
  route_next: SessionState;
  save_default_model: undefined;
};
