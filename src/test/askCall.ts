import type { ToolCall } from "../../shared/agentTypes";
import { ASK_TOOL, type Question } from "../../shared/questions";

/** An ask_user call with these questions. */
export const askCall = (id: string, questions: Question[]): ToolCall => ({
  type: "toolCall",
  id,
  name: ASK_TOOL,
  arguments: { questions },
});
