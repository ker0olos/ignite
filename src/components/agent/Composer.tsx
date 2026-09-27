import { useState } from "react";
import { Plus } from "lucide-react";
import type { ImageContent } from "../../../shared/agentTypes";
import { EffortMenu } from "@/components/agent/EffortMenu";
import { ImageAttachments } from "@/components/agent/ImageAttachments";
import { Kbd } from "@/components/agent/Kbd";
import { ModelMenu } from "@/components/agent/ModelMenu";
import { ACTION, MENU_TRIGGER } from "@/components/agent/styles";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { pastedImages, pickImages } from "@/lib/images";
import { cn } from "@/lib/utils";

type Session = ReturnType<typeof useAgentSession>;

/** Task composer: prompt textarea, toolbar, and send/stop button. */
export function Composer({
  session,
  loading,
  running,
}: {
  session: Session;
  loading: boolean;
  running: boolean;
}) {
  const { state } = session;
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImageContent[]>([]);

  const canSend = !!state && (!!text.trim() || images.length > 0);
  const handleSend = () => {
    if (!canSend) return;
    setText("");
    setImages([]);
    void session.send(text, images);
  };
  const attach = (added: ImageContent[]) =>
    setImages((current) => [...current, ...added]);

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
        />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
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
          placeholder="Describe a task…"
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          rows={1}
          className="max-h-[calc(5lh+1.5rem)] min-h-0 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0.5 pt-4 pb-2 shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex h-6 items-center gap-3.5 px-0.5">
          <button
            type="button"
            aria-label="Attach images"
            className={MENU_TRIGGER}
            onClick={() => void pickImages().then(attach)}
          >
            <Plus className="size-3.5" />
          </button>
          {loading && (
            <>
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-8" />
            </>
          )}
          {state && state.models.length > 0 && (
            <ModelMenu state={state} session={session} />
          )}
          {/* pi offers only "off" for models that can't reason. */}
          {state && state.thinkingLevels.length > 1 && (
            <EffortMenu state={state} session={session} />
          )}
          {session.error && (
            <span className="truncate text-xs text-destructive">
              {session.error}
            </span>
          )}
          {running ? (
            <button
              type="button"
              className={ACTION}
              onClick={() => void session.stop()}
            >
              Stop <Kbd>esc</Kbd>
            </button>
          ) : (
            <button
              type="submit"
              className={cn(ACTION, !canSend && "invisible")}
              disabled={!canSend}
            >
              Send <Kbd>↵</Kbd>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
