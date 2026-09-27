import { useRef, useState, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import type { ImageContent } from "../../shared/agentTypes";
import type { ModelInfo } from "../../shared/hostProtocol";
import { Conversation } from "@/components/Conversation";
import { EffortSlider } from "@/components/EffortSlider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { CodeThemes } from "@/lib/codeThemes";
import {
  EFFORT_LABELS,
  modelLabel,
  modelMenu,
  same,
  type MenuGroup,
} from "@/lib/modelMenu";
import { imageUrl, pastedImages, pickImages } from "@/lib/images";
import { basename } from "@/lib/paths";
import { cn } from "@/lib/utils";
import type { Settings } from "@/lib/settings";

type Session = ReturnType<typeof useAgentSession>;
type SessionState = NonNullable<Session["state"]>;

/** Conversation area and task composer. */
export function AgentPanel({
  folder,
  session,
  codeThemes,
  editor,
  showThinking,
}: {
  folder: string;
  session: Session;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  showThinking: boolean;
}) {
  const { state, transcript } = session;
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImageContent[]>([]);
  const mainRef = useRef<HTMLElement>(null);
  const running = transcript?.running ?? false;
  const loading = !state && !session.error;

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
    <>
      <main
        ref={mainRef}
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto"
      >
        {loading ? (
          <ConversationSkeleton />
        ) : transcript && transcript.items.length > 0 ? (
          <Conversation
            transcript={transcript}
            folder={folder}
            editor={editor}
            codeThemes={codeThemes}
            showThinking={showThinking}
            scrollRef={mainRef}
          />
        ) : (
          // The empty area doubles as the title bar, so it drags the window.
          <div
            data-tauri-drag-region
            className="always-bounce flex h-full items-center justify-center text-sm text-muted-foreground"
          >
            What should we build in {basename(folder)}?
          </div>
        )}
      </main>
      <form
        className="mx-auto w-full max-w-3xl px-4 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <div className="group border-t transition-colors focus-within:border-foreground/35">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 px-0.5 pt-3">
              {images.map((image, i) => (
                <div key={i} className="group/image relative">
                  <img
                    src={imageUrl(image)}
                    alt=""
                    className="size-14 rounded-md border object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove image"
                    className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full bg-foreground text-background group-hover/image:flex"
                    onClick={() =>
                      setImages((current) => current.filter((_, j) => j !== i))
                    }
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
    </>
  );
}

const MENU_TRIGGER =
  "flex h-6 items-center text-xs text-muted-foreground/70 outline-none group-focus-within:text-muted-foreground hover:text-foreground focus-visible:text-foreground";
const ACTION =
  "ml-auto flex h-6 items-center gap-2 text-xs text-foreground outline-none hover:opacity-80 focus-visible:underline";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border px-1 font-sans text-[11px] text-muted-foreground">
      {children}
    </kbd>
  );
}

/** Placeholder turns while the session opens, laid out like Conversation. */
function ConversationSkeleton() {
  return (
    <div
      data-tauri-drag-region
      className="mx-auto max-w-3xl space-y-6 px-4 py-6"
    >
      <Skeleton className="ml-auto h-9 w-2/5 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <Skeleton className="ml-auto h-9 w-1/3 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

function ModelMenu({
  state,
  session,
}: {
  state: SessionState;
  session: Session;
}) {
  const { featured, more } = modelMenu(state.models);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={MENU_TRIGGER}>
        {state.model ? modelLabel(state.model) : "Choose a model"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        <ModelGroups
          groups={featured}
          current={state.model}
          onSelect={session.setModel}
        />
        {more.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More models</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                <ModelGroups
                  groups={more}
                  current={state.model}
                  onSelect={session.setModel}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EffortMenu({
  state,
  session,
}: {
  state: SessionState;
  session: Session;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={MENU_TRIGGER}>
        {EFFORT_LABELS[state.thinkingLevel]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-auto">
        <EffortSlider
          levels={state.thinkingLevels}
          value={state.thinkingLevel}
          onChange={(level) => void session.setThinkingLevel(level)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModelGroups({
  groups,
  current,
  onSelect,
}: {
  groups: MenuGroup[];
  current?: ModelInfo;
  onSelect: (model: ModelInfo) => void;
}) {
  return (
    <>
      {groups.map((group, i) => (
        <DropdownMenuGroup key={group.name} className={i > 0 ? "mt-2" : ""}>
          {groups.length > 1 && (
            <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
          )}
          {group.models.map((model) => (
            <DropdownMenuItem
              key={`${model.provider}/${model.id}`}
              onClick={() => onSelect(model)}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px]">{model.label}</span>
                {model.description && (
                  <span className="truncate text-xs text-muted-foreground">
                    {model.description}
                  </span>
                )}
              </div>
              {current && same(current, model) && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      ))}
    </>
  );
}
