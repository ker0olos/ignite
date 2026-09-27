import { writeTextFile } from "@tauri-apps/plugin-fs";

/**
 * Tells the launcher (launcher/launch.sh) the app came up: a window rendered
 * and the sidecar answered. Without a launcher there is no file to write.
 */
export async function reportHealthy(
  file: string | null = __HEALTH_FILE__,
): Promise<void> {
  if (!file) return;
  await writeTextFile(file, "ok").catch(() => {});
}
