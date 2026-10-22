import type { ApprovalMode, ModelInfo } from "../../shared/hostProtocol";
import type { HostClient } from "./piHost";
import type { Settings } from "./settings";

/** Saves `model` as pi's default for new conversations, where no conversation is open to pick it in. */
export function saveDefaultModel(
  host: HostClient,
  { provider, id }: ModelInfo,
) {
  return host.request({
    type: "save_default_model",
    provider,
    modelId: id,
  });
}

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
