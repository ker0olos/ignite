import type { ModelRouter } from "@/components/agent/Composer";
import { ModelChoices } from "@/components/agent/ModelChoices";
import type { useAgentSession } from "@/hooks/useAgentSession";

type Session = ReturnType<typeof useAgentSession>;

/** The composer's model and effort menus; Router there picks the model for the conversation's next message. */
export function ComposerModelMenus({
  session,
  modelRouter,
}: {
  session: Session;
  modelRouter: ModelRouter;
}) {
  const { state } = session;
  if (!state) return null;
  const routed =
    session.session === null
      ? modelRouter.on && !session.pickedModel
      : !!state.routeNext;
  return (
    <ModelChoices
      state={state}
      routed={routed}
      modelRouter={modelRouter}
      onRouter={session.pickRouter}
      onModel={(model) => void session.setModel(model)}
      onEffort={(level) => void session.setThinkingLevel(level)}
    />
  );
}
