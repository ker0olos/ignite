import { useRef, useState } from "react";
import type { McpServer, ProviderStatus } from "../../../shared/hostProtocol";
import type { RemoteStatus } from "../../../shared/remote";
import { McpServerDialog } from "@/components/mcp/McpServerDialog";
import {
  shownGroups,
  type Item,
  type Section,
} from "@/components/settings/sections";
import { aboutItems } from "@/components/settings/sections/aboutItems";
import { agentItems } from "@/components/settings/sections/agentItems";
import { macItems } from "@/components/settings/sections/macItems";
import { chromeItems } from "@/components/settings/sections/chromeItems";
import { appearanceItems } from "@/components/settings/sections/appearanceItems";
import { sidebarItems } from "@/components/settings/sections/sidebarItems";
import { conversationItems } from "@/components/settings/sections/conversationItems";
import { editorItems } from "@/components/settings/sections/editorItems";
import { filesItems } from "@/components/settings/sections/filesItems";
import { hotkeysItems } from "@/components/settings/sections/hotkeysItems";
import { mcpItems } from "@/components/settings/sections/mcpItems";
import { memoryItems } from "@/components/settings/sections/memoryItems";
import { learningItems } from "@/components/settings/sections/learningItems";
import { lessonsItems } from "@/components/settings/sections/lessonsItems";
import { proceduresItems } from "@/components/settings/sections/proceduresItems";
import { providersItems } from "@/components/settings/sections/providersItems";
import { remoteItems } from "@/components/settings/sections/remoteItems";
import { skillsItems } from "@/components/settings/sections/skillsItems";
import { reflectorItems } from "@/components/settings/sections/reflectorItems";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsSections } from "@/components/settings/SettingsSections";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { useAbout } from "@/hooks/useAbout";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useLessons } from "@/hooks/useLessons";
import type { useProcedures } from "@/hooks/useProcedures";
import type { useMemory } from "@/hooks/useMemory";
import { useScrollToNewServer } from "@/hooks/useScrollToNewServer";
import type { useSkills } from "@/hooks/useSkills";
import type { useReflector } from "@/hooks/useReflector";
import { useInstalledThemes } from "@/hooks/useInstalledThemes";
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
  onOpenConversation,
  mcp,
  skills,
  memory,
  lessons,
  procedures,
  reflector,
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
  onOpenConversation: (folder: string, conversation: string) => void;
  mcp: ReturnType<typeof useMcpServers>;
  skills: ReturnType<typeof useSkills>;
  memory: ReturnType<typeof useMemory>;
  lessons: ReturnType<typeof useLessons>;
  procedures: ReturnType<typeof useProcedures>;
  reflector: ReturnType<typeof useReflector>;
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
  const { themes, setThemes, iconThemes } = useInstalledThemes(open);
  const search = useRef<HTMLInputElement>(null);

  useScrollToNewServer(mcp.servers);

  const items: Item[] = [
    ...providersItems({ providers, providersError, onManageProviders }),
    ...agentItems({ settings, onChange }),
    ...mcpItems({ mcp, onEdit: setEditing, onAdd: () => setEditing("new") }),
    ...skillsItems({ skills }),
    ...chromeItems({ settings, onChange }),
    ...memoryItems({ memory, folderOpen: !!folder, settings, onChange }),
    // Before the sections' own rows, so each switch comes first in its section.
    ...learningItems({
      settings,
      onChange,
      onLessonsChanged: memory.changed,
    }),
    ...lessonsItems({ lessons }),
    ...proceduresItems({ procedures, onOpenConversation }),
    ...reflectorItems({ reflector, onOpenConversation }),
    ...remoteItems({ settings, onChange, status: remote }),
    ...macItems(settings, onChange),
    ...appearanceItems({
      themes,
      iconThemes,
      settings,
      onChange,
      onThemesChange: setThemes,
    }),
    ...sidebarItems({ settings, onChange }),
    ...filesItems({ settings, onChange }),
    ...editorItems({ settings, onChange }),
    ...conversationItems({ settings, onChange }),
    ...hotkeysItems(),
    ...aboutItems({ about }),
  ];

  const { matches, groups } = shownGroups(items, query, section);

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
        className="flex h-[min(720px,85vh)] w-[min(980px,90vw)] max-w-none gap-0 overflow-hidden p-0 max-sm:h-[90dvh] max-sm:w-[95vw] max-sm:flex-col sm:max-w-none frosted:bg-popover/45 frosted:backdrop-blur-2xl frosted:backdrop-saturate-150"
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
