import type { RemoteStatus } from "../../../../shared/remote";
import { PortInput } from "@/components/remote/PortInput";
import { RemoteLink } from "@/components/remote/RemoteLink";
import type { Item } from "@/components/settings/sections";
import { Switch } from "@/components/ui/switch";
import { isRemote } from "@/lib/remote";
import type { Settings } from "@/lib/settings";

const newToken = () => crypto.randomUUID().replaceAll("-", "");

/** The network link, to scan, copy or replace; or why there's none. */
function linkItem(status: RemoteStatus | null, onNewLink: () => void): Item {
  const url = status?.urls[0];
  if (!url) {
    const description =
      status?.error ?? "No network address found. Connect to Wi-Fi.";
    return { section: "Remote", title: "Link", description };
  }
  return {
    section: "Remote",
    title: "Link",
    description: `${new URL(url).host}. Scan it with your phone's camera, on the same Wi-Fi. A new link signs out every browser.`,
    control: <RemoteLink url={url} onNewLink={onNewLink} />,
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
        "Serve this app to browsers on your Wi-Fi network. Anyone with the link can use the agent as you.",
      keywords: "phone mobile browser lan network wifi web",
      control: (
        <Switch
          checked={remote.enabled}
          onCheckedChange={(enabled) =>
            save({ enabled, token: remote.token || newToken() })
          }
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
  return [...rows, linkItem(status, () => save({ token: newToken() }))];
}
