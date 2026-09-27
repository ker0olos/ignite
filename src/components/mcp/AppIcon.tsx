import { Plug } from "lucide-react";
import { Glyph } from "@/components/mcp/Glyph";
import { APPS } from "@/components/mcp/marks";

/** The mark of an app whose MCP servers can be imported. */
export function AppIcon({ app }: { app: string }) {
  return <Glyph mark={APPS[app] ?? { icon: Plug }} />;
}
