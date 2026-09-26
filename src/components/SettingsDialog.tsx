import { useState, type ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { Settings, Theme } from "@/lib/settings";
import { cn } from "@/lib/utils";

const THEMES: Theme[] = ["system", "light", "dark"];
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
  const [section, setSection] = useState<Section>("Appearance");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent initialFocus={false} className="gap-0 p-0 sm:max-w-2xl">
        <DialogTitle className="flex h-11 items-center gap-2 border-b px-4 text-[13px] font-medium">
          <Settings2 className="size-4 text-muted-foreground" />
          Settings
        </DialogTitle>
        <div className="flex h-96">
          <nav className="w-44 shrink-0 space-y-0.5 border-r p-2">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={cn(
                  "flex h-7 w-full items-center rounded-md px-2 text-[13px]",
                  s === section ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                {s}
              </button>
            ))}
          </nav>
          <section className="flex-1 p-6">
            <h2 className="text-lg font-semibold tracking-tight">{section}</h2>

            {section === "Appearance" && (
              <Setting
                title="Theme"
                description="Follow the system appearance or pick one."
              >
                <div className="mt-3 inline-flex rounded-lg border p-0.5">
                  {THEMES.map((t) => (
                    <button
                      key={t}
                      onClick={() => onChange({ ...settings, theme: t })}
                      className={cn(
                        "h-7 rounded-md px-3 text-[13px] capitalize",
                        settings.theme === t
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Setting>
            )}

            {section === "Files" && (
              <Setting
                title="Hide Git-ignored files"
                description="Leave files matched by .gitignore out of the file tree."
                control={
                  <Switch
                    checked={settings.files.hide_gitignored}
                    onCheckedChange={(checked) =>
                      onChange({
                        ...settings,
                        files: { ...settings.files, hide_gitignored: checked },
                      })
                    }
                  />
                }
              />
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Setting({
  title,
  description,
  control,
  children,
}: {
  title: string;
  description: string;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[13px] font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}
