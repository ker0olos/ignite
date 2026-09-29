import { useRef, useState } from "react";
import { History } from "lucide-react";
import type {
  SavedSession,
  SessionDetails,
} from "../../../shared/conversations";
import { ConversationPicker } from "@/components/sidebar/ConversationPicker";
import { cn } from "@/lib/utils";

const TRIGGER_CLASS =
  "shrink-0 rounded-md p-1 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100";

/** A folder row's history button: opens the search over its closed conversations. */
export function ConversationHistory({
  folderName,
  history,
  details,
  onShow,
}: {
  folderName: string;
  history: () => Promise<SavedSession[]>;
  details: (session: string) => Promise<SessionDetails | null>;
  onShow: (session: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedSession[] | null>(null);
  // Each conversation's details, asked for once while the search is open.
  const [known, setKnown] = useState<Record<string, SessionDetails | null>>({});
  const asked = useRef(new Set<string>());

  const highlight = (session: string) => {
    if (asked.current.has(session)) return;
    asked.current.add(session);
    void details(session).then((d) =>
      setKnown((all) => ({ ...all, [session]: d })),
    );
  };

  const show = () => {
    setSaved(null);
    setKnown({});
    asked.current.clear();
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
        details={known}
        onHighlight={highlight}
        onShow={(session) => {
          setOpen(false);
          onShow(session);
        }}
      />
    </>
  );
}
