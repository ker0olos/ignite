import { useState } from "react";
import { History } from "lucide-react";
import type { SavedSession } from "../../../shared/hostProtocol";
import { ConversationPicker } from "@/components/sidebar/ConversationPicker";
import { cn } from "@/lib/utils";

const TRIGGER_CLASS =
  "shrink-0 rounded-md p-1 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100";

/** A folder row's history button: opens the search over its closed conversations. */
export function ConversationHistory({
  folderName,
  history,
  onShow,
}: {
  folderName: string;
  history: () => Promise<SavedSession[]>;
  onShow: (session: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedSession[] | null>(null);

  const show = () => {
    setSaved(null);
    setOpen(true);
    history()
      .then(setSaved)
      .catch(() => setSaved([]));
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          show();
        }}
        aria-label={`Previous conversations in ${folderName}`}
        className={cn(TRIGGER_CLASS, open && "opacity-100")}
      >
        <History className="size-3.5 text-muted-foreground" />
      </button>
      <ConversationPicker
        open={open}
        onOpenChange={setOpen}
        folderName={folderName}
        saved={saved}
        onShow={(session) => {
          setOpen(false);
          onShow(session);
        }}
      />
    </>
  );
}
