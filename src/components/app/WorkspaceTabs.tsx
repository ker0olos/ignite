import { MessageSquare } from "lucide-react";
import { FileTabs } from "@/components/app/FileTabs";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import { useFrontTabClose } from "@/hooks/useFrontTabClose";
import type { useTabs } from "@/hooks/useTabs";
import { conversationTitle } from "@/lib/conversations";
import { tabLabel } from "@/lib/diffTabs";
import { nextFront, type Front } from "@/lib/ideTabs";

/** The IDE layouts' one strip: conversations, then files; a conversation's tab only hides when closed. */
export function WorkspaceTabs({
  folder,
  projectList,
  tabs,
  files,
  front,
  hidden,
  onHide,
  terminalCommand,
}: {
  folder: string;
  projectList: ProjectListProps;
  tabs: ReturnType<typeof useTabs>;
  /** The editor's tabs this strip shows (VS Code's terminals go to its panel). */
  files: string[];
  /** The file in front, else null: the shown conversation is. */
  front: string | null;
  hidden: string[];
  onHide: (session: string) => void;
  terminalCommand?: (terminal: string) => string | undefined;
}) {
  const { conversations, shown } = projectList;
  const rows = projectList.rows(folder).flatMap((r) => [r, ...(r.forks ?? [])]);
  const titles = new Map(rows.map((r) => [r.session, conversationTitle(r)]));
  // The shown one has a tab even when the tag filter leaves it out of the rows.
  const listed = [...titles.keys()];
  if (shown && !titles.has(shown)) listed.push(shown);
  const open = listed.filter((s) => !hidden.includes(s));
  const isConversation = (tab: string) => listed.includes(tab);
  const frontTab = front ?? shown;

  const bring = (next: Front) => {
    if ("file" in next) return tabs.activate(next.file);
    tabs.activate(null);
    if (next.conversation === null) conversations.create(folder);
    else if (next.conversation !== shown)
      conversations.show(folder, next.conversation);
  };
  const close = (tab: string) => {
    const next = nextFront(
      { conversations: open, files, front: frontTab, shown },
      tab,
    );
    if (isConversation(tab)) onHide(tab);
    else tabs.close(tab);
    if (next) bring(next);
  };
  // ⌘W, unless a tab outside the strip (VS Code's terminal panel) is active.
  const stripActive = !tabs.active || files.includes(tabs.active);
  useFrontTabClose(frontTab && stripActive ? () => close(frontTab) : null);

  const all = [...open, ...files];
  if (all.length === 0) return null;
  return (
    <FileTabs
      files={all}
      active={frontTab ?? ""}
      folder={folder}
      // One row that scrolls; each title truncates.
      className="flex-nowrap overflow-x-auto pt-1.5 *:max-w-60 *:shrink-0"
      label={(tab) => {
        if (!isConversation(tab)) return tabLabel(tab, folder, terminalCommand);
        const title = titles.get(tab) ?? conversationTitle({ title: "" });
        return { name: title, title, icon: MessageSquare, iconPath: "" };
      }}
      onSelect={(tab) =>
        bring(isConversation(tab) ? { conversation: tab } : { file: tab })
      }
      onClose={close}
    />
  );
}
