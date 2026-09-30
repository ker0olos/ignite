import { MonitorSmartphone } from "lucide-react";

/** At the sidebar's foot while devices use remote access: how many; opens its settings. */
export function RemoteDevices({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Remote access settings"
      className="flex shrink-0 items-center gap-2 border-t border-sidebar-border px-4 py-2.5 text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
    >
      <span className="relative flex">
        <MonitorSmartphone className="size-3.5" />
        <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-success" />
      </span>
      {count === 1 ? "1 device connected" : `${count} devices connected`}
    </button>
  );
}
