import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Code,
  FolderTree,
  MessageSquare,
  Palette,
  Plug,
  Search,
  Server,
  type LucideIcon,
} from "lucide-react";
import type { McpServer, ProviderStatus } from "../../shared/hostProtocol";
import {
  McpImportSources,
  McpQuickAdd,
  McpServerControls,
  McpServerDialog,
} from "@/components/McpServers";
import { ClaudeLogo, OpenAILogo } from "@/components/ProviderLogos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CUSTOM_THEMES_DIR,
  SYSTEM_THEME,
  importTheme,
  listThemes,
  themeGroups,
  type CodeTheme,
} from "@/lib/codeThemes";
import type { useMcpServers } from "@/hooks/useMcpServers";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { PROVIDER_GROUPS, groupConnection } from "@/lib/providerGroups";
import { cn } from "@/lib/utils";

const SECTIONS = {
  Providers: { icon: Plug, blurb: "Accounts the agent signs in with." },
  MCP: {
    icon: Server,
    blurb: "Tools the agent can use from other apps and services.",
  },
  Appearance: { icon: Palette, blurb: "Colors for the app and code." },
  Editor: { icon: Code, blurb: "How files look in the viewer." },
  Files: { icon: FolderTree, blurb: "What the file tree shows." },
  Conversation: {
    icon: MessageSquare,
    blurb: "What the agent's replies show.",
  },
} satisfies Record<string, { icon: LucideIcon; blurb: string }>;
export type Section = keyof typeof SECTIONS;
const SECTION_NAMES = Object.keys(SECTIONS) as Section[];

interface Item {
  section: Section;
  title: string;
  description?: string;
  /** A mark shown before the title. */
  icon?: ReactNode;
  /** The row element's id, to scroll to it. */
  id?: string;
  /** Extra words search should match. */
  keywords?: string;
  control?: ReactNode;
}

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
    ...(providersError
      ? [
          {
            section: "Providers" as const,
            title: "Agent host unavailable",
            description: providersError,
          },
        ]
      : PROVIDER_GROUPS.map((group) => ({
          section: "Providers" as const,
          title: group.name,
          icon: <ProviderTile name={group.name} />,
          keywords: "provider account model subscription api key",
          control: (
            <ProviderState
              how={providers ? groupConnection(group, providers) : undefined}
            />
          ),
        }))),
    {
      section: "Providers",
      title: "",
      keywords: "connect disconnect manage provider account login api key",
      control: (
        <Button variant="outline" size="sm" onClick={onManageProviders}>
          Manage…
        </Button>
      ),
    },
    ...(mcp.error
      ? [
          {
            section: "MCP" as const,
            title: "Something went wrong",
            description: mcp.error,
          },
        ]
      : []),
    ...(mcp.servers ?? []).map((server) => ({
      section: "MCP" as const,
      id: serverRowId(server.name),
      title: server.name,
      keywords: `mcp server tool ${server.tools.join(" ")}`,
      control: (
        <McpServerControls
          server={server}
          onEdit={() => setEditing(server)}
          onEnabledChange={(enabled) => mcp.setEnabled(server.name, enabled)}
          onSignIn={() => mcp.signIn(server.name)}
          onRemove={() => mcp.remove(server.name)}
        />
      ),
    })),
    {
      section: "MCP",
      title: "Add a custom server",
      description:
        "Connect any MCP server by its URL, or run one as a local command.",
      keywords: "mcp server tool add new import preset claude cursor codex",
      control: (
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          Add…
        </Button>
      ),
    },
    {
      section: "Appearance",
      title: "Theme",
      description: `Also sets light or dark mode. Add your own to ~/${CUSTOM_THEMES_DIR}.`,
      keywords: "color dark light mode vs code cursor windsurf vscodium",
      control: (
        <ThemePicker
          themes={themes}
          value={settings.theme}
          onChange={async (id) => {
            // Editor themes are copied in, so uninstalling the editor later
            // can't break the saved choice.
            const theme = await importTheme(id);
            onChange({ ...settings, theme });
            if (theme !== id) listThemes(true).then(setThemes);
          }}
        />
      ),
    },
    {
      section: "Editor",
      title: "Font",
      description: "Comma-separated; the first installed one is used.",
      keywords: "font family typeface monospace",
      control: (
        <FontInput
          value={settings.editor.font_family}
          onCommit={(font_family) =>
            onChange({
              ...settings,
              editor: { ...settings.editor, font_family },
            })
          }
        />
      ),
    },
    {
      section: "Editor",
      title: "Word wrap",
      description: "Wrap long lines to the viewer's width.",
      keywords: "line",
      control: (
        <Switch
          checked={settings.editor.word_wrap}
          onCheckedChange={(word_wrap) =>
            onChange({ ...settings, editor: { ...settings.editor, word_wrap } })
          }
        />
      ),
    },
    {
      section: "Files",
      title: "Hide Git-ignored files",
      description: "Leave out files matched by .gitignore.",
      keywords: "gitignore file tree hidden",
      control: (
        <Switch
          checked={settings.files.hide_gitignored}
          onCheckedChange={(hide_gitignored) =>
            onChange({
              ...settings,
              files: { ...settings.files, hide_gitignored },
            })
          }
        />
      ),
    },
    {
      section: "Conversation",
      title: "Show thinking",
      description: "Show the model's reasoning above its replies.",
      keywords: "reasoning thoughts",
      control: (
        <Switch
          checked={settings.conversation.show_thinking}
          onCheckedChange={(show_thinking) =>
            onChange({
              ...settings,
              conversation: { ...settings.conversation, show_thinking },
            })
          }
        />
      ),
    },
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
        <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r bg-sidebar p-2">
          <label className="mb-2 flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50">
            <Search className="size-3.5 shrink-0" />
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          {SECTION_NAMES.map((s) => {
            const Icon = SECTIONS[s].icon;
            const dim = q && !items.some((i) => i.section === s && matches(i));
            return (
              <button
                key={s}
                onClick={() => {
                  setQuery("");
                  setSection(s);
                }}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px]",
                  !q && s === section
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                  dim && "opacity-40",
                )}
              >
                <Icon className="size-4 text-muted-foreground" />
                {s}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-8 pt-6 pb-8">
          {groups.length === 0 && (
            <p className="mt-16 text-center text-[13px] text-muted-foreground">
              No settings match “{query.trim()}”.
            </p>
          )}
          {groups.map(([s, rows]) => (
            <section key={s} className="mb-8">
              {q ? (
                <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                  {s}
                </h2>
              ) : (
                <header className="mb-4">
                  <h2 className="text-base font-semibold">{s}</h2>
                  <p className="text-[13px] text-muted-foreground">
                    {SECTIONS[s].blurb}
                  </p>
                </header>
              )}
              <div className="divide-y rounded-lg border bg-card">
                {rows.map((i) => (
                  <Row key={i.title} item={i} />
                ))}
              </div>
              {s === "MCP" && !!mcp.catalog?.sources.length && (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                    Import from other apps
                  </h3>
                  <McpImportSources
                    sources={mcp.catalog.sources}
                    onImport={mcp.importServers}
                  />
                </div>
              )}
              {s === "MCP" && !!mcp.catalog?.presets.length && (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                    Quick add
                  </h3>
                  <McpQuickAdd
                    presets={mcp.catalog.presets}
                    onAdd={mcp.addPreset}
                  />
                </div>
              )}
            </section>
          ))}
        </div>
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

const serverRowId = (name: string) => `mcp-server-${name}`;

function Row({ item }: { item: Item }) {
  return (
    <div id={item.id} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
      {item.icon}
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>
      {item.control && <div className="ml-3 shrink-0">{item.control}</div>}
    </div>
  );
}

/** A provider's logo. */
function ProviderTile({ name }: { name: string }) {
  const Logo = name === "Claude" ? ClaudeLogo : OpenAILogo;
  return <Logo className="size-4 shrink-0" />;
}

function ProviderState({
  how,
}: {
  how: ReturnType<typeof groupConnection> | undefined;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full",
          how ? "bg-success" : "bg-muted-foreground/40",
        )}
      />
      {how === undefined
        ? "Checking…"
        : how === "subscription"
          ? "Subscription"
          : how === "api_key"
            ? "API key"
            : "Not connected"}
    </span>
  );
}

/** Theme menu: System, then every theme grouped by source. */
function ThemePicker({
  themes,
  value,
  onChange,
}: {
  themes: CodeTheme[];
  value: string;
  onChange: (id: string) => void;
}) {
  const groups = themeGroups(themes, value);
  const items = [
    { value: SYSTEM_THEME, label: "System" },
    ...groups.flatMap((g) =>
      g.themes.map((t) => ({ value: t.id, label: t.label })),
    ),
  ];
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(id) => id && onChange(id)}
    >
      <SelectTrigger size="sm" className="w-56 text-[13px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-80">
        <SelectGroup>
          <SelectItem value={SYSTEM_THEME} className="text-[13px]">
            System
          </SelectItem>
        </SelectGroup>
        {groups.map((group) => (
          <SelectGroup key={group.source}>
            <SelectLabel>{group.source}</SelectLabel>
            {group.themes.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-[13px]">
                {t.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Text field that saves on Enter or when it loses focus, not per keystroke.
 * Emptying it restores the default font.
 */
function FontInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Show changes saved elsewhere (another window, a reset) while not typing.
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setDraft(value);
  }

  const commit = () => {
    const next = draft.trim() || DEFAULT_SETTINGS.editor.font_family;
    setDraft(next);
    if (next !== value) onCommit(next);
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      spellCheck={false}
      className="h-7 w-56 rounded-md border bg-background px-2 font-mono text-[12px]"
    />
  );
}
