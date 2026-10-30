import { useMemo } from "react";
import { OutputLink } from "@/components/conversation/OutputLink";
import { OutputMarkdown } from "@/components/conversation/OutputMarkdown";
import { OutputText } from "@/components/conversation/OutputText";
import { outputKind } from "@/lib/outputKind";

/** Tool output that isn't records: a lone link as a pill, markdown as a page, else a terminal's text. */
export function OutputShaped({ text }: { text: string }) {
  const kind = useMemo(() => outputKind(text), [text]);
  if (kind === "url") return <OutputLink url={text.trim()} />;
  if (kind === "markdown") return <OutputMarkdown text={text} />;
  return <OutputText text={text} />;
}
