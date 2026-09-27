import type { Item } from "@/components/settings/sections";

/** One settings row: icon, title, description and its control. */
export function SettingsRow({ item }: { item: Item }) {
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
