import { useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, Square } from "lucide-react";
import type { ModelInfo, ThinkingLevel } from "../../shared/hostProtocol";
import { Button } from "@/components/ui/button";
import { Conversation } from "@/components/Conversation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { basename } from "@/lib/paths";
import type { Settings } from "@/lib/settings";

type Session = ReturnType<typeof useAgentSession>;
type SessionState = NonNullable<Session["state"]>;

/** Conversation area and task composer. */
export function AgentPanel({
  folder,
  session,
  codeThemes,
  editor,
}: {
  folder: string;
  session: Session;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
}) {
  const { state, transcript } = session;
  const [text, setText] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const running = transcript?.running ?? false;

  const handleSend = () => {
    if (!text.trim()) return;
    const value = text;
    setText("");
    void session.send(value);
  };

  return (
    <>
      <main
        ref={mainRef}
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto"
      >
        {transcript && transcript.items.length > 0 ? (
          <Conversation
            transcript={transcript}
            folder={folder}
            editor={editor}
            codeThemes={codeThemes}
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
        className="p-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <div className="rounded-lg border bg-background focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
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
            className="max-h-[calc(5lh+1rem)] min-h-0 resize-none overflow-y-auto border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="flex items-center gap-1 px-2 pb-2">
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
              <Button
                type="button"
                size="icon-sm"
                className="ml-auto"
                onClick={() => void session.stop()}
              >
                <Square />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                className="ml-auto"
                disabled={!text.trim()}
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
      </form>
    </>
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
      <DropdownMenuTrigger className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground">
        {state.model ? modelLabel(state.model) : "Choose a model"}
        <ChevronDown className="size-3.5" />
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
      <DropdownMenuTrigger className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground">
        {EFFORT_LABELS[state.thinkingLevel]}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Effort</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={state.thinkingLevel}
            onValueChange={(level: ThinkingLevel) =>
              void session.setThinkingLevel(level)
            }
          >
            {state.thinkingLevels.map((level) => (
              <DropdownMenuRadioItem key={level} value={level}>
                {EFFORT_LABELS[level]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
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
