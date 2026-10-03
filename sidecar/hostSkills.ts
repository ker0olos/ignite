/** The skills settings' requests: list, on/off, always on, remove, import. */
import type { SkillRequest } from "../shared/skills.ts";
import { reloadSessions } from "./hostMcp.ts";
import type { HostContext } from "./hostTypes.ts";

type Req<K extends SkillRequest["type"]> = Extract<SkillRequest, { type: K }>;

// Sessions read skills on (re)load.
const change = async (ctx: HostContext, edit: () => Promise<void>) => {
  await edit();
  await reloadSessions(ctx);
  return ctx.skills.list();
};

/** Handlers for SkillRequest, merged into the host's. */
export const skillHandlers = {
  skills_list: (ctx: HostContext) => ctx.skills.list(),
  skills_set_enabled: (ctx: HostContext, r: Req<"skills_set_enabled">) =>
    change(ctx, () => ctx.skills.setEnabled(r.skill, r.enabled)),
  skills_set_always: (ctx: HostContext, r: Req<"skills_set_always">) =>
    change(ctx, () => ctx.skills.setAlways(r.skill, r.always)),
  skills_remove: (ctx: HostContext, r: Req<"skills_remove">) =>
    change(ctx, () => ctx.skills.remove(r.skill)),
  skills_catalog: (ctx: HostContext) => ctx.skills.catalog(),
  skills_import: (ctx: HostContext, r: Req<"skills_import">) =>
    change(ctx, () => ctx.skills.importSkills(r.source, r.names)),
};
