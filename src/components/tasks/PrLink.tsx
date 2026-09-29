import { GitPullRequest } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { prLabel } from "@/lib/tasks";

/** The task's pull request, opening in the browser. */
export function PrLink({ url }: { url: string }) {
  return (
    <button
      type="button"
      title={url}
      onClick={() => void openUrl(url).catch(() => {})}
      className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-success outline-none hover:bg-success/10 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <GitPullRequest className="size-3.5" />
      {prLabel(url)}
    </button>
  );
}
