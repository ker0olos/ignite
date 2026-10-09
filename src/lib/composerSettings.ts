import type { ApprovalMode } from "../../shared/hostProtocol";
import type { Settings } from "./settings";

/** The approval mode setting, and a change that saves it. */
export function approvalSetting(
  settings: Settings,
  save: (settings: Settings) => Promise<void>,
) {
  return {
    mode: settings.approval.mode,
    onChange: (mode: ApprovalMode) =>
      void save({ ...settings, approval: { ...settings.approval, mode } }),
  };
}

/** The Model Router setting, and a change that saves it. */
export function modelRouterSetting(
  settings: Settings,
  save: (settings: Settings) => Promise<void>,
) {
  return {
    on: settings.conversation.model_router,
    onChange: (model_router: boolean) =>
      void save({
        ...settings,
        conversation: { ...settings.conversation, model_router },
      }),
  };
}
