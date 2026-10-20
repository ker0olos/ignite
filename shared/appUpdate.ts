import type { AppVersion } from "./hostProtocol.ts";

/** The app's version and updates (About). */
export type AppUpdateRequest =
  | { id: number; type: "app_version" }
  /**
   * Gets the latest code: run from the launcher, builds it to run on the next
   * start (`ready`), else pulls it (`updated` is false when already current).
   */
  | { id: number; type: "app_update" }
  /** Has the launcher start the app again, on a built update, once it quits. */
  | { id: number; type: "app_restart" };

export type AppUpdateResponses = {
  app_version: AppVersion;
  /** `warning`: the update's binary couldn't be verified (appBinary.ts). */
  app_update: { updated: boolean; ready?: boolean; warning?: string };
  app_restart: undefined;
};
