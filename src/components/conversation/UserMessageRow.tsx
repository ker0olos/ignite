import { useContext } from "react";
import { EditMessageButton } from "@/components/conversation/EditMessageButton";
import { MessageEditContext } from "@/components/conversation/shared";
import { UserBubble } from "@/components/conversation/UserBubble";
import { UserMessageEditor } from "@/components/conversation/UserMessageEditor";
import { useMessageEdit } from "@/hooks/useMessageEdit";
import type { Row } from "@/lib/toolRows";
import { cn } from "@/lib/utils";

/** User message row with optional sticky positioning; an `editable` one offers Edit, in place. */
export function UserMessageRow({
  message,
  sticky,
  editable = false,
}: {
  message: Extract<Row, { kind: "user" }>["message"];
  sticky: boolean;
  editable?: boolean;
}) {
  const context = useContext(MessageEditContext);
  const edit = editable ? context : null;
  const draft = useMessageEdit(message, edit);
  return (
    <div
      className={cn(
        sticky && "sticky top-0 z-10 -mx-4 bg-background px-4 py-2",
      )}
    >
      {draft.editing ? (
        <UserMessageEditor
          text={draft.text}
          images={draft.images}
          sending={draft.sending}
          canSend={!draft.sending && !edit?.disabled}
          onChange={draft.setText}
          onKeyDown={draft.onKeyDown}
          onCancel={draft.cancel}
          onSend={() => void draft.submit()}
        />
      ) : (
        <UserBubble
          message={message}
          action={
            edit && (
              <EditMessageButton
                disabled={edit.disabled}
                onEdit={draft.start}
              />
            )
          }
        />
      )}
    </div>
  );
}
