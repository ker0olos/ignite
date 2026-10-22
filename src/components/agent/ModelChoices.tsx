import type {
  ModelInfo,
  SessionState,
  ThinkingLevel,
} from "../../../shared/hostProtocol";
import type { ModelRouter } from "@/components/agent/Composer";
import { EffortMenu } from "@/components/agent/EffortMenu";
import { ModelMenu } from "@/components/agent/ModelMenu";

/**
 * The model and effort menus (composer, new-task sheet). Router is picked like
 * a model: it becomes the default for new conversations, and picking a model
 * makes that the default instead. `routed` while Router picks both.
 */
export function ModelChoices({
  state,
  routed,
  modelRouter,
  onRouter,
  onModel,
  onEffort,
}: {
  state: SessionState;
  routed: boolean;
  modelRouter: ModelRouter;
  onRouter: () => void;
  onModel: (model: ModelInfo) => void;
  onEffort: (level: ThinkingLevel) => void;
}) {
  return (
    <>
      {state.models.length > 0 && (
        <ModelMenu
          state={state}
          onSelect={(model) => {
            onModel(model);
            modelRouter.onChange(false);
          }}
          modelRouter={routed}
          onModelRouter={() => {
            onRouter();
            modelRouter.onChange(true);
          }}
        />
      )}
      {/* pi offers only "off" for models that can't reason; the router picks effort too. */}
      {state.thinkingLevels.length > 1 && !routed && (
        <EffortMenu state={state} onChange={onEffort} />
      )}
    </>
  );
}
