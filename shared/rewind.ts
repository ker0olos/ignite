import type { ImageContent } from "./agentTypes.ts";

/** What rewinding did to the conversation's files: put back as they were, left (no checkpoint for that message), or shared with the folder. */
export type RewoundFiles = "restored" | "missing" | "shared";

/**
 * Edits user message `entryId`: the conversation goes back to before it,
 * its files to how they were then, and `text` is sent in its place.
 * Refused unless the conversation is idle.
 */
export type RewindRequest = {
  id: number;
  type: "rewind";
  session: string;
  entryId: string;
  text: string;
  images?: ImageContent[];
};

export type RewindResponses = { rewind: undefined };
