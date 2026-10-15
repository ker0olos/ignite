import { lazy, Suspense } from "react";
import { SubagentView } from "@/components/children/SubagentView";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { ChildTab } from "@/lib/childTabs";
import type { CodeThemes } from "@/lib/codeThemes";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";

// xterm loads with the first terminal or background command shown, not with the app.
const TerminalView = lazy(() =>
  import("@/components/children/TerminalView").then((m) => ({
    default: m.TerminalView,
  })),
);
const BackgroundView = lazy(() =>
  import("@/components/children/BackgroundView").then((m) => ({
    default: m.BackgroundView,
  })),
);

/** A subagent's, background command's or terminal's tab. */
export function ChildView({
  tab,
  folder,
  session,
  host,
  editor,
  codeThemes,
}: {
  tab: ChildTab;
  folder: string;
  session: ReturnType<typeof useAgentSession>;
  /** The sidecar, whether or not a conversation shows. */
  host: HostClient | null;
  editor: Settings["editor"];
  codeThemes: CodeThemes;
}) {
  if (tab.kind === "agent") {
    return (
      <SubagentView
        owner={tab.session}
        id={tab.id}
        model={tab.model}
        {...{ folder, session, editor, codeThemes }}
      />
    );
  }
  return (
    <Suspense>
      {tab.kind === "terminal" ? (
        <TerminalView terminal={tab.terminal} host={host} editor={editor} />
      ) : (
        <BackgroundView
          session={tab.session}
          pid={tab.pid}
          command={tab.command}
          host={host}
          editor={editor}
        />
      )}
    </Suspense>
  );
}
