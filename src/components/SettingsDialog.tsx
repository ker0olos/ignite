import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const THEMES: Theme[] = ["system", "light", "dark"];

/** App settings, opened from the gear button or ⌘,. */
export function SettingsDialog({
  open,
  onOpenChange,
  theme,
  onThemeChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent initialFocus={false} className="gap-0 p-0 sm:max-w-2xl">
        <DialogTitle className="flex h-11 items-center gap-2 border-b px-4 text-[13px] font-medium">
          <Settings2 className="size-4 text-muted-foreground" />
          Settings
        </DialogTitle>
        <div className="flex h-96">
          <nav className="w-44 shrink-0 border-r p-2">
            <div className="flex h-7 items-center rounded-md bg-accent px-2 text-[13px]">
              Appearance
            </div>
          </nav>
          <section className="flex-1 p-6">
            <h2 className="text-lg font-semibold tracking-tight">Appearance</h2>
            <p className="mt-5 text-[13px] font-medium">Theme</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Follow the system appearance or pick one.
            </p>
            <div className="mt-3 inline-flex rounded-lg border p-0.5">
              {THEMES.map((t) => (
                <button
                  key={t}
                  onClick={() => onThemeChange(t)}
                  className={cn(
                    "h-7 rounded-md px-3 text-[13px] capitalize",
                    theme === t
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
