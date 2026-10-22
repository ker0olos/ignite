/**
 * A conversation's model and effort (shared/modelChoice.ts): read, or chosen.
 * A chosen model or effort is saved as the default for new conversations.
 */
import type { ModelChoiceRequest } from "../shared/modelChoice.ts";
import { sessionState } from "./hostSession.ts";
import { userPickedModel, userPickedRouter } from "./hostRoute.ts";
import { current, target, type HostContext } from "./hostTypes.ts";

type Request<K extends ModelChoiceRequest["type"]> = Extract<
  ModelChoiceRequest,
  { type: K }
>;

async function state(ctx: HostContext, session?: string) {
  return sessionState(ctx, await current(ctx, session), target(ctx, session));
}

async function setModel(ctx: HostContext, r: Request<"set_model">) {
  userPickedModel(ctx, r.session);
  const s = await current(ctx, r.session);
  const model = (await s.modelRuntime.getAvailable()).find(
    (m) => m.provider === r.provider && m.id === r.modelId,
  );
  if (!model) throw new Error(`${r.modelId} isn't available.`);
  await s.setModel(model, { persist: true });
  return state(ctx, r.session);
}

/** The model and effort requests' handlers. */
export const modelHandlers = {
  session_state: (ctx: HostContext, r: Request<"session_state">) =>
    state(ctx, r.session),
  // ponytail: the draft is shared by every folder, so a folder's own .pi skills only show once its conversation starts.
  draft_state: async (ctx: HostContext, r: Request<"draft_state">) => ({
    ...(await sessionState(
      ctx,
      await ctx.draft({ model: r.model, level: r.level }),
    )),
    skills: ctx.skills
      .sessionSkills({ skills: [] })
      .skills.map(({ name, description }) => ({ name, description })),
  }),
  set_model: setModel,
  set_thinking_level: async (
    ctx: HostContext,
    r: Request<"set_thinking_level">,
  ) => {
    (await current(ctx, r.session)).setThinkingLevel(r.level, {
      persist: true,
    });
    return state(ctx, r.session);
  },
  route_next: (ctx: HostContext, r: Request<"route_next">) => {
    userPickedRouter(ctx, r.session);
    return state(ctx, r.session);
  },
  save_default_model: async (
    ctx: HostContext,
    r: Request<"save_default_model">,
  ) => {
    await ctx.draft({
      model: { provider: r.provider, id: r.modelId },
      save: true,
    });
  },
};
