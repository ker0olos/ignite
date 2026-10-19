import type { NewMemory } from "./memoryDb.ts";

/** A memory of folder /work/app, overridden by `over`. */
export const memory = (over: Partial<NewMemory> = {}): NewMemory => ({
  folder: "/work/app",
  conversation: "s1",
  platform: "ignite",
  type: "discovery",
  title: "Untitled",
  subtitle: null,
  facts: [],
  narrative: null,
  concepts: [],
  filesRead: [],
  filesModified: [],
  createdAt: 1_000,
  ...over,
});
