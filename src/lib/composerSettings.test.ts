import { describe, expect, it, vi } from "vitest";
import { approvalSetting, modelRouterSetting } from "./composerSettings";
import { DEFAULT_SETTINGS } from "./settings";

describe("approvalSetting", () => {
  it("offers the mode and saves a change without touching other settings", () => {
    const save = vi.fn(async () => {});
    const approval = approvalSetting(DEFAULT_SETTINGS, save);
    expect(approval.mode).toBe("auto");
    approval.onChange("manual");
    expect(save).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      approval: { mode: "manual", full_access: false, windows_sandbox: false },
    });
  });
});

describe("modelRouterSetting", () => {
  it("offers Model Router and saves a change", () => {
    const save = vi.fn(async () => {});
    const router = modelRouterSetting(DEFAULT_SETTINGS, save);
    expect(router.on).toBe(true);
    router.onChange(false);
    expect(save).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      conversation: { ...DEFAULT_SETTINGS.conversation, model_router: false },
    });
  });
});
