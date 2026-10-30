import { openUrl } from "@tauri-apps/plugin-opener";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import { LinkPill } from "@/components/conversation/LinkPill";
import { cn } from "@/lib/utils";

const open = (url: string) => () => {
  if (url) void openUrl(url).catch(() => {});
};

// Images stay links: the text isn't the user's, and loading one would reach its host unasked.
const COMPONENTS: Components = {
  a: ({ href = "", children }) => (
    <LinkPill kind="url" onOpen={open(href)}>
      {children}
    </LinkPill>
  ),
  img: ({ src, alt }) => (
    <LinkPill kind="url" onOpen={open(String(src ?? ""))}>
      {alt || "Image"}
    </LinkPill>
  ),
};

const PROSE =
  "leading-relaxed text-foreground [&_code]:rounded [&_code]:bg-code/12 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.92em] [&_code]:text-code [&_h1]:mb-2 [&_h1]:text-[1.2em] [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p]:last:mb-0 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:pl-5";

/** Markdown from outside the conversation (tool output, a pull request's description) as a page; links open in the browser. */
export function MarkdownPage({
  text,
  plugins = [],
  className,
}: {
  text: string;
  plugins?: NonNullable<Options["remarkPlugins"]>;
  className?: string;
}) {
  return (
    <div className={cn(PROSE, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, ...plugins]}
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
