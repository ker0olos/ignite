import type {
  ModelInfo,
  SessionState,
  ThinkingLevel,
} from "../../../shared/hostProtocol";
import { EffortMenu } from "@/components/agent/EffortMenu";
import { ModelMenu } from "@/components/agent/ModelMenu";

/** The sheet's model and effort, as the composer offers them for a new conversation. */
export function NewTaskChoices({
  state,
  onModel,
  onEffort,
}: {
  state: SessionState | null;
  onModel: (model: ModelInfo) => void;
  onEffort: (level: ThinkingLevel) => void;
}) {
  if (!state) return null;
  return (
    <div className="group flex items-center gap-3.5 pl-0.5">
      {state.models.length > 0 && (
        <ModelMenu state={state} onSelect={onModel} />
      )}
      {/* pi offers only "off" for models that can't reason. */}
      {state.thinkingLevels.length > 1 && (
        <EffortMenu state={state} onChange={onEffort} />
      )}
    </div>
  );
}
