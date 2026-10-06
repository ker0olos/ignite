import type { ModelRouter } from "@/components/agent/Composer";
import { EffortMenu } from "@/components/agent/EffortMenu";
import { ModelMenu } from "@/components/agent/ModelMenu";
import type { useAgentSession } from "@/hooks/useAgentSession";

type Session = ReturnType<typeof useAgentSession>;

/**
 * The composer's model and effort menus. Model Router only picks for a
 * conversation about to start, so only there does its item show; a model
 * picked there is for that conversation alone, and the router leaves it.
 */
export function ComposerModelMenus({
  session,
  modelRouter,
}: {
  session: Session;
  modelRouter?: ModelRouter;
}) {
  const { state } = session;
  if (!state) return null;
  const router = session.session === null ? modelRouter : undefined;
  // Choosing Router drops a model picked here; the setting turns on if it was off.
  const pickRouter =
    router && (() => (session.unpickModel(), router.onChange(true)));
  // The router picks the effort too, so its menu hides while the router picks.
  const routing = !!router?.on && !session.pickedModel;
  return (
    <>
      {state.models.length > 0 && (
        <ModelMenu
          state={state}
          onSelect={session.setModel}
          modelRouter={routing}
          onModelRouter={pickRouter}
        />
      )}
      {/* pi offers only "off" for models that can't reason. */}
      {state.thinkingLevels.length > 1 && !routing && (
        <EffortMenu
          state={state}
          onChange={(level) => void session.setThinkingLevel(level)}
        />
      )}
    </>
  );
}
