import { useEffect, useRef, useState } from "react";
import type { McpServer, ProviderStatus } from "../../../shared/hostProtocol";
import type { RemoteStatus } from "../../../shared/remote";
import { McpServerDialog } from "@/components/mcp/McpServerDialog";
import {
  SECTION_NAMES,
  type Item,
  type Section,
} from "@/components/settings/sections";
import { aboutItems } from "@/components/settings/sections/aboutItems";
import { agentItems } from "@/components/settings/sections/agentItems";
import { chromeItems } from "@/components/settings/sections/chromeItems";
import { appearanceItems } from "@/components/settings/sections/appearanceItems";
import { conversationItems } from "@/components/settings/sections/conversationItems";
import { editorItems } from "@/components/settings/sections/editorItems";
import { filesItems } from "@/components/settings/sections/filesItems";
import { mcpItems } from "@/components/settings/sections/mcpItems";
import { memoryItems } from "@/components/settings/sections/memoryItems";
import { providersItems } from "@/components/settings/sections/providersItems";
import { remoteItems } from "@/components/settings/sections/remoteItems";
import { skillsItems } from "@/components/settings/sections/skillsItems";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsSections } from "@/components/settings/SettingsSections";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { useAbout } from "@/hooks/useAbout";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useMemory } from "@/hooks/useMemory";
import { useScrollToNewServer } from "@/hooks/useScrollToNewServer";
import type { useSkills } from "@/hooks/useSkills";
import type { CodeTheme } from "@/lib/codeThemes";
import { listThemes } from "@/lib/codeThemeDiscovery";
import type { Settings } from "@/lib/settings";

export type { Section } from "@/components/settings/sections";

/** App settings, opened from the gear button or ⌘,. Saved to settings.toml. */
export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
  providers,
  providersError,
  onManageProviders,
  mcp,
  skills,
  memory,
  about,
  folder,
  remote,
  initialSection = "Providers",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  /** Resolves once the change is saved. */
  onChange: (settings: Settings) => void | Promise<void>;
  /** Connection status per provider; null while loading. */
  providers: ProviderStatus[] | null;
  providersError: string | null;
  onManageProviders: () => void;
  mcp: ReturnType<typeof useMcpServers>;
  skills: ReturnType<typeof useSkills>;
  memory: ReturnType<typeof useMemory>;
  about: ReturnType<typeof useAbout>;
  /** The open folder, whose memories the Memory section previews. */
  folder: string | null;
  /** The remote access server's links. */
  remote: RemoteStatus | null;
  /** The section shown first; changing it needs a new `key` to take effect. */
  initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  // The server being edited, "new" while adding one.
  const [editing, setEditing] = useState<McpServer | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [themes, setThemes] = useState<CodeTheme[]>([]);
  const search = useRef<HTMLInputElement>(null);

  useScrollToNewServer(mcp.servers);

  // Rescan on every open so newly installed themes show up.
  useEffect(() => {
    if (open) listThemes(true).then(setThemes);
  }, [open]);

  const items: Item[] = [
    ...providersItems({ providers, providersError, onManageProviders }),
    ...agentItems({ settings, onChange }),
    ...mcpItems({ mcp, onEdit: setEditing, onAdd: () => setEditing("new") }),
    ...skillsItems({ skills }),
    ...chromeItems({ settings, onChange }),
    ...memoryItems({ memory, folderOpen: !!folder, settings, onChange }),
    ...remoteItems({ settings, onChange, status: remote }),
    ...appearanceItems({
      themes,
      settings,
      onChange,
      onThemesChange: setThemes,
    }),
    ...editorItems({ settings, onChange }),
    ...filesItems({ settings, onChange }),
    ...conversationItems({ settings, onChange }),
    ...aboutItems({ about }),
  ];

  const q = query.trim().toLowerCase();
  const matches = (i: Item) =>
    `${i.section} ${i.title} ${i.description ?? ""} ${i.keywords ?? ""}`
      .toLowerCase()
      .includes(q);
  const visible = q
    ? items.filter(matches)
    : items.filter((i) => i.section === section);
  const groups = SECTION_NAMES.map(
    (s) => [s, visible.filter((i) => i.section === s)] as const,
  ).filter(([, rows]) => rows.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        initialFocus={search}
        className="flex h-[min(560px,85vh)] w-[min(760px,90vw)] max-w-none gap-0 overflow-hidden p-0 max-sm:h-[90dvh] max-sm:w-[95vw] max-sm:flex-col sm:max-w-none"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <SettingsNav
          search={search}
          query={query}
          onQueryChange={setQuery}
          section={section}
          onSectionChange={setSection}
          items={items}
          matches={matches}
        />
        <SettingsSections
          query={query}
          groups={groups}
          mcp={mcp}
          skills={skills}
          memory={memory}
          folder={folder}
        />
        <McpServerDialog
          open={editing !== null}
          onOpenChange={(next) => !next && setEditing(null)}
          server={editing === "new" ? null : editing}
          taken={(mcp.servers ?? [])
            .map((m) => m.name)
            .filter((n) => editing === "new" || n !== editing?.name)}
          onSave={mcp.save}
        />
      </DialogContent>
    </Dialog>
  );
}
