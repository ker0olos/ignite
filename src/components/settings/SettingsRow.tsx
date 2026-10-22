import type { Item } from "@/components/settings/sections";
import { cn } from "@/lib/utils";

/** One settings row: icon, title, description and its control. */
export function SettingsRow({ item }: { item: Item }) {
  return (
    <div
      id={item.id}
      className={cn(
        "flex min-h-11 gap-3 px-4 py-2.5 max-sm:flex-wrap max-sm:px-3",
        item.alignTop ? "items-start" : "items-center",
      )}
    >
      {item.icon}
      <div className="min-w-0 flex-1 max-sm:min-w-40">
        {item.titleView ?? <p className="text-[13px]">{item.title}</p>}
        {(item.description || item.hint) && (
          <p className="text-xs text-muted-foreground">
            {item.description} {item.hint}
          </p>
        )}
      </div>
      {item.control && <div className="ml-3 shrink-0">{item.control}</div>}
    </div>
  );
}
