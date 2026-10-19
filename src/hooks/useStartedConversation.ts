import { useCallback, useState } from "react";

/** The conversation `folder`'s first message last started, with its worktree; `onBegin` records it. */
export function useStartedConversation(folder: string | null) {
  const [started, setStarted] = useState<{
    folder: string;
    session: string;
    workdir: string;
  } | null>(null);
  const onBegin = useCallback(
    (session: string, workdir: string) => {
      if (folder) setStarted({ folder, session, workdir });
    },
    [folder],
  );
  return { started, onBegin };
}
