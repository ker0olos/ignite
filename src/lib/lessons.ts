import { basename } from "@/lib/paths";

/** Where a lesson applies: "Every folder" (no folder), the open one (""), or a folder by name. */
export const lessonScope = (folder: string | undefined) =>
  folder === undefined
    ? "Every folder"
    : folder
      ? basename(folder)
      : "This folder";
