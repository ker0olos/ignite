import { McpExtras } from "@/components/mcp/McpExtras";
import { MemoryExtras } from "@/components/memory/MemoryExtras";
import type { Section } from "@/components/settings/sections";
import { SkillsExtras } from "@/components/skills/SkillsExtras";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useMemory } from "@/hooks/useMemory";
import type { useSkills } from "@/hooks/useSkills";

/** What a section shows below its rows: MCP servers or skills to add, recent memories. */
export function SectionExtras({
  section,
  mcp,
  skills,
  memory,
  folder,
}: {
  section: Section;
  mcp: ReturnType<typeof useMcpServers>;
  skills: ReturnType<typeof useSkills>;
  memory: ReturnType<typeof useMemory>;
  folder: string | null;
}) {
  switch (section) {
    case "Memory":
      return <MemoryExtras memory={memory} folder={folder} />;
    case "Skills":
      return <SkillsExtras skills={skills} />;
    case "MCP":
      return <McpExtras mcp={mcp} />;
    default:
      return null;
  }
}
