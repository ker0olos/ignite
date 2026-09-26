import { useEffect, useRef, useState, type ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  CUSTOM_THEMES_DIR,
  SYSTEM_THEME,
  listThemes,
  themeGroups,
  type CodeTheme,
} from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const SECTIONS = ["Appearance", "Files"] as const;
type Section = (typeof SECTIONS)[number];

/** App settings, opened from the gear button or ⌘,. Saved to settings.toml. */
export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const [section, setSection] = useState<Section>(SECTIONS[0]);
  const [themes, setThemes] = useState<CodeTheme[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  // Every section is on one scrolling page; the side list only jumps around it.
  function jumpTo(s: Section) {
    document
      .getElementById(sectionId(s))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Highlight the last section whose heading has scrolled to the top, or the
  // last one once the page can't scroll further.
  function trackSection() {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    const current = atBottom
      ? SECTIONS[SECTIONS.length - 1]
      : SECTIONS.findLast(
          (s) =>
            (document.getElementById(sectionId(s))?.offsetTop ?? 0) <=
            el.scrollTop + 32,
        );
    setSection(current ?? SECTIONS[0]);
  }

  // Rescan on every open so newly installed themes show up.
  useEffect(() => {
    if (open) listThemes(true).then(setThemes);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={false}
        className="flex h-[80vh] w-[80vw] max-w-none flex-col gap-0 p-0 sm:max-w-none"
      >
        <DialogTitle className="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-[13px] font-medium">
          <Settings2 className="size-4 text-muted-foreground" />
          Settings
        </DialogTitle>
        <div className="flex min-h-0 flex-1">
          <nav className="w-48 shrink-0 space-y-0.5 border-r p-2">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => jumpTo(s)}
                className={cn(
                  "flex h-7 w-full items-center rounded-md px-2 text-[13px]",
                  s === section ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                {s}
              </button>
            ))}
          </nav>
          <div
            ref={scroller}
            onScroll={trackSection}
            className="relative flex-1 overscroll-contain overflow-y-auto"
          >
            <div className="always-bounce space-y-10 p-6">
              <SettingsSection title="Appearance">
                <Setting
                  title="Theme"
                  description={`Also sets light or dark mode. System follows macOS with GitHub Light and GitHub Dark. Includes themes installed in VS Code, VSCodium, Cursor and Windsurf, and files in ~/${CUSTOM_THEMES_DIR}.`}
                  control={
                    <ThemePicker
                      themes={themes}
                      value={settings.theme}
                      onChange={(theme) => onChange({ ...settings, theme })}
                    />
                  }
                />
              </SettingsSection>

              <SettingsSection title="Files">
                <Setting
                  title="Hide Git-ignored files"
                  description="Leave files matched by .gitignore out of the file tree."
                  control={
                    <Switch
                      checked={settings.files.hide_gitignored}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...settings,
                          files: {
                            ...settings.files,
                            hide_gitignored: checked,
                          },
                        })
                      }
                    />
                  }
                />
              </SettingsSection>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Native pop-up menu: System, then every theme grouped by source. */
function ThemePicker({
  themes,
  value,
  onChange,
}: {
  themes: CodeTheme[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-56 shrink-0 rounded-md border bg-background px-2 text-[13px]"
    >
      <option value={SYSTEM_THEME}>System</option>
      {themeGroups(themes, value).map((group) => (
        <optgroup key={group.source} label={group.source}>
          {group.themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

const sectionId = (s: Section) => `settings-${s.toLowerCase()}`;

function SettingsSection({
  title,
  children,
}: {
  title: Section;
  children: ReactNode;
}) {
  return (
    <section id={sectionId(title)}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Setting({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="mt-5 flex items-start justify-between gap-8">
      <div className="max-w-xl">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {control}
    </div>
  );
}
