import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { ImageContent } from "../../../shared/agentTypes";
import type { ApprovalMode } from "../../../shared/hostProtocol";
import { ComposerToolbar } from "@/components/agent/ComposerToolbar";
import { ImageAttachments } from "@/components/agent/ImageAttachments";
import { MENU_TRIGGER } from "@/components/agent/styles";
import { Textarea } from "@/components/ui/textarea";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useProvideImageTarget } from "@/hooks/useImageTarget";
import { typedText } from "@/lib/demo";
import { pastedImages, pickImages } from "@/lib/images";
import { cn } from "@/lib/utils";

type Session = ReturnType<typeof useAgentSession>;

/** The approval mode setting and how to change it. */
export type Approval = {
  mode: ApprovalMode;
  onChange: (mode: ApprovalMode) => void;
};

/** Task composer: prompt textarea, toolbar, and send/stop button. */
export function Composer({
  session,
  loading,
  running,
  approval,
}: {
  session: Session;
  loading: boolean;
  running: boolean;
  approval: Approval;
}) {
  const { state } = session;
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImageContent[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);

  // A new conversation is ready to type in.
  useEffect(() => {
    if (session.fresh) input.current?.focus();
  }, [session.fresh]);

  const canSend =
    (!!state || session.none) && (!!text.trim() || images.length > 0);
  const handleSend = () => {
    if (!canSend) return;
    setText("");
    setImages([]);
    void session.send(text, images);
  };
  const attach = (added: ImageContent[]) =>
    setImages((current) => [...current, ...added]);
  useProvideImageTarget("Add to chat", (image) => {
    attach([image]);
    input.current?.focus();
  });

  return (
    <form
      className="mx-auto w-full max-w-3xl px-4 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSend();
      }}
    >
      <div className="group border-t transition-colors focus-within:border-foreground/35">
        <ImageAttachments
          images={images}
          onRemove={(i) =>
            setImages((current) => current.filter((_, j) => j !== i))
          }
          onEdit={(i, marked) =>
            setImages((current) =>
              current.map((x, j) => (j === i ? marked : x)),
            )
          }
        />
        <Textarea
          ref={input}
          value={text}
          onChange={(e) => setText(typedText(e.target.value))}
          onPaste={(e) => {
            const { clipboardData } = e;
            if (clipboardData.files.length === 0) return;
            e.preventDefault();
            void pastedImages(clipboardData).then(attach);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && running) {
              e.preventDefault();
              void session.stop();
              return;
            }
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing)
              return;
            e.preventDefault();
            handleSend();
          }}
          placeholder="Describe a task"
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          rows={1}
          className="max-h-[calc(5lh+1.5rem)] min-h-0 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0.5 pt-4 pb-2 shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex h-6 items-center gap-3.5 px-0.5 max-sm:h-10">
          <button
            type="button"
            aria-label="Attach images"
            // A finger-sized target on a phone, still flush with the text's edge.
            className={cn(
              MENU_TRIGGER,
              "max-sm:-ml-2.5 max-sm:size-10 max-sm:justify-center",
            )}
            onClick={() => void pickImages().then(attach)}
          >
            <Plus className="size-3.5 max-sm:size-5" />
          </button>
          <ComposerToolbar
            session={session}
            loading={loading}
            running={running}
            canSend={canSend}
            approval={approval}
          />
        </div>
      </div>
    </form>
  );
}
