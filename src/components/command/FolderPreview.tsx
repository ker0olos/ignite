import type { AgentStatus } from "../../../shared/hostProtocol";
import { DetailsSection } from "@/components/command/DetailsSection";
import { basename, tildify } from "@/lib/paths";

/** A folder in the command center: where it is and its listed conversations. */
export function FolderPreview({
  folder,
  home,
  conversations,
}: {
  folder: string;
  home: string;
  conversations: AgentStatus[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 text-[13px]">
      <header className="flex flex-col gap-1">
        <p className="text-[14px] font-medium">{basename(folder)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tildify(folder, home)}
        </p>
      </header>
      <DetailsSection title="Conversations">
        {conversations.length ? (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((c) => (
              <li key={c.session} className="truncate">
                {c.title || "New conversation"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            None open. Pick it to start one.
          </p>
        )}
      </DetailsSection>
    </div>
  );
}
