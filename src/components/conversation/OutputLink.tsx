import { openUrl } from "@tauri-apps/plugin-opener";
import { LinkPill } from "@/components/conversation/LinkPill";
import { linkLabel } from "@/lib/noteLinks";

/** Tool output that's only a link, as a pill opening it in the browser. */
export function OutputLink({ url }: { url: string }) {
  return (
    <p className="text-[14px] text-foreground">
      <LinkPill kind="url" onOpen={() => void openUrl(url).catch(() => {})}>
        {linkLabel(url)}
      </LinkPill>
    </p>
  );
}
