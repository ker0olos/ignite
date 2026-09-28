import { GitCommitHorizontal, Loader2 } from "lucide-react";
import type { Item } from "@/components/settings/sections";
import { Button } from "@/components/ui/button";
import type { useAbout } from "@/hooks/useAbout";
import { updateButton, updateDescription, versionLine } from "@/lib/about";

/** The About rows: the commit the app runs from, and the update check. */
export function aboutItems({
  about,
}: {
  about: ReturnType<typeof useAbout>;
}): Item[] {
  const { version, error, update, check } = about;
  const button = updateButton(update);
  return [
    {
      section: "About",
      title: version?.subject ?? "Version",
      description: error ?? (version ? versionLine(version) : "Loading…"),
      icon: (
        <GitCommitHorizontal className="size-4 shrink-0 text-muted-foreground" />
      ),
      keywords: `version commit sha ${version?.sha ?? ""}`,
    },
    {
      section: "About",
      title: "Updates",
      description: updateDescription(update),
      keywords: "update upgrade pull latest check",
      control: (
        <Button
          variant="outline"
          size="sm"
          disabled={button.disabled}
          onClick={check}
        >
          {button.spinning && <Loader2 className="size-3.5 animate-spin" />}
          {button.label}
        </Button>
      ),
    },
  ];
}
