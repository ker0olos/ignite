import type {
  ModelInfo,
  SessionState,
  ThinkingLevel,
} from "../../../shared/hostProtocol";
import { EffortMenu } from "@/components/agent/EffortMenu";
import { ModelMenu } from "@/components/agent/ModelMenu";

/** The sheet's model and effort, as the composer offers them for a new conversation; `routed` while Model Router picks both. */
export function NewTaskChoices({
  state,
  routed = false,
  onRouter,
  onModel,
  onEffort,
}: {
  state: SessionState | null;
  routed?: boolean;
  /** Offers Router in the model menu. */
  onRouter?: () => void;
  onModel: (model: ModelInfo) => void;
  onEffort: (level: ThinkingLevel) => void;
}) {
  if (!state) return null;
  return (
    <div className="group flex items-center gap-3.5 pl-0.5">
      {state.models.length > 0 && (
        <ModelMenu
          state={state}
          onSelect={onModel}
          modelRouter={routed}
          onModelRouter={onRouter}
        />
      )}
      {/* pi offers only "off" for models that can't reason; the router picks effort too. */}
      {state.thinkingLevels.length > 1 && !routed && (
        <EffortMenu state={state} onChange={onEffort} />
      )}
    </div>
  );
}
