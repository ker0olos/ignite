import { useEffect, useRef, useState } from "react";
import type { McpServer, ProviderStatus } from "../../../shared/hostProtocol";
import { McpServerDialog } from "@/components/mcp/McpServerDialog";
import {
  SECTION_NAMES,
  serverRowId,
  type Item,
  type Section,
} from "@/components/settings/sections";
import { appearanceItems } from "@/components/settings/sections/appearanceItems";
import { conversationItems } from "@/components/settings/sections/conversationItems";
import { editorItems } from "@/components/settings/sections/editorItems";
import { filesItems } from "@/components/settings/sections/filesItems";
import { mcpItems } from "@/components/settings/sections/mcpItems";
import { providersItems } from "@/components/settings/sections/providersItems";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsSections } from "@/components/settings/SettingsSections";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { useMcpServers } from "@/hooks/useMcpServers";
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
  initialSection = "Providers",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (settings: Settings) => void;
  /** Connection status per provider; null while loading. */
  providers: ProviderStatus[] | null;
  providersError: string | null;
  onManageProviders: () => void;
  mcp: ReturnType<typeof useMcpServers>;
  /** The section shown first; changing it needs a new `key` to take effect. */
  initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  // The server being edited, "new" while adding one.
  const [editing, setEditing] = useState<McpServer | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [themes, setThemes] = useState<CodeTheme[]>([]);
  const search = useRef<HTMLInputElement>(null);

  // Bring a server that was just added (preset, import or form) into view.
  const serverNames = mcp.servers?.map((m) => m.name).join("\n") ?? null;
  const knownNames = useRef<string[] | null>(null);
  useEffect(() => {
    if (serverNames === null) return;
    const names = serverNames.split("\n");
    const known = knownNames.current;
    knownNames.current = names;
    const added = known && names.find((n) => !known.includes(n));
    if (!added) return;
    document
      .getElementById(serverRowId(added))
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [serverNames]);

  // Rescan on every open so newly installed themes show up.
  useEffect(() => {
    if (open) listThemes(true).then(setThemes);
  }, [open]);

  const items: Item[] = [
    ...providersItems({ providers, providersError, onManageProviders }),
    ...mcpItems({ mcp, onEdit: setEditing, onAdd: () => setEditing("new") }),
    ...appearanceItems({
      themes,
      settings,
      onChange,
      onThemesChange: setThemes,
    }),
    ...editorItems({ settings, onChange }),
    ...filesItems({ settings, onChange }),
    ...conversationItems({ settings, onChange }),
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
        className="flex h-[min(560px,85vh)] w-[min(760px,90vw)] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none"
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
        <SettingsSections query={query} groups={groups} mcp={mcp} />
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
