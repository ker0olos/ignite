import { useState } from "react";
import { CopyButton } from "@/components/conversation/CopyButton";
import { MarkdownPage } from "@/components/conversation/MarkdownPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useElementSize } from "@/hooks/useElementSize";
import { cn } from "@/lib/utils";

type View = "rendered" | "raw";

// The card's body height until Show all, its padding (py-3, 24px) included.
const CLIP_PX = 256;

/** Markdown tool output as a page in a card, or its raw text; cut short until Show all. */
export function OutputMarkdown({ text }: { text: string }) {
  const [view, setView] = useState<View>("rendered");
  const [all, setAll] = useState(false);
  // Measured as it resizes, so a pane that narrows, or output first laid out hidden, still offers the rest.
  const [measure, { height }] = useElementSize();
  const cut = !all && height > CLIP_PX - 24;
  const lines = text.replace(/\n+$/, "").split("\n").length;
  const count = `${lines} ${lines === 1 ? "line" : "lines"}`;
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 border-b py-1 pr-1.5 pl-3 text-xs text-muted-foreground">
        <span className="flex-1">Markdown · {count}</span>
        <Tabs value={view} onValueChange={(value) => setView(value as View)}>
          <TabsList className="group-data-horizontal/tabs:h-6">
            <TabsTrigger value="rendered" className="px-2 text-xs">
              Rendered
            </TabsTrigger>
            <TabsTrigger value="raw" className="px-2 text-xs">
              Raw
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <CopyButton text={() => text} />
      </div>
      <div
        className={cn(
          "px-4 py-3 text-[13.5px]",
          !all && "overflow-hidden",
          cut &&
            "[mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]",
        )}
        style={all ? undefined : { maxHeight: CLIP_PX }}
      >
        <div ref={measure}>
          {view === "rendered" ? (
            <MarkdownPage text={text} />
          ) : (
            <pre className="font-mono text-[12px] whitespace-pre-wrap text-foreground/85 [overflow-wrap:anywhere]">
              {text}
            </pre>
          )}
        </div>
      </div>
      {cut && (
        <div className="flex justify-center pb-2.5">
          <Button
            size="xs"
            variant="outline"
            className="rounded-full"
            onClick={() => setAll(true)}
          >
            Show all {count}
          </Button>
        </div>
      )}
    </div>
  );
}
