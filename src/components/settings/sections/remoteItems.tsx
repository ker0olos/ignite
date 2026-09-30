import type { RemoteStatus } from "../../../../shared/remote";
import { PortInput } from "@/components/remote/PortInput";
import { RemoteLink } from "@/components/remote/RemoteLink";
import type { Item } from "@/components/settings/sections";
import { Switch } from "@/components/ui/switch";
import { isRemote } from "@/lib/remote";
import type { Settings } from "@/lib/settings";

/** The network link, to scan or copy; or why there's none. */
function linkItem(status: RemoteStatus | null): Item {
  const url = status?.urls[0];
  if (!url) {
    const description =
      status?.error ?? "No network address found. Connect to Wi-Fi.";
    return { section: "Remote", title: "Link", description };
  }
  return {
    section: "Remote",
    title: "Link",
    description: `${new URL(url).host}. Scan it with your phone's camera, on the same Wi-Fi.`,
    control: <RemoteLink url={url} />,
  };
}

/** The Tailscale link, which works from anywhere on your tailnet. */
function tailscaleItem(url: string): Item {
  return {
    section: "Remote",
    title: "Tailscale",
    description: `${new URL(url).host}. Opens from any of your devices on Tailscale, on any network.`,
    keywords: "tailscale vpn tailnet anywhere",
    control: <RemoteLink url={url} />,
  };
}

/** Settings rows for remote access; hidden in a browser using it. */
export function remoteItems({
  settings,
  onChange,
  status,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  status: RemoteStatus | null;
}): Item[] {
  if (isRemote()) return [];
  const { remote } = settings;
  const save = (next: Partial<Settings["remote"]>) =>
    onChange({ ...settings, remote: { ...remote, ...next } });
  const rows: Item[] = [
    {
      section: "Remote",
      title: "Remote access",
      description:
        "Serve this app to browsers on your network. Anyone who can reach this Mac can use the agent as you, with no password.",
      keywords: "phone mobile browser lan network wifi web",
      control: (
        <Switch
          checked={remote.enabled}
          onCheckedChange={(enabled) => save({ enabled })}
        />
      ),
    },
    {
      section: "Remote",
      title: "Port",
      description: "Where browsers connect.",
      control: (
        <PortInput value={remote.port} onCommit={(port) => save({ port })} />
      ),
    },
  ];
  if (!remote.enabled) return rows;
  const tailscale = status?.tailscale;
  return [
    ...rows,
    linkItem(status),
    ...(tailscale ? [tailscaleItem(tailscale)] : []),
  ];
}
