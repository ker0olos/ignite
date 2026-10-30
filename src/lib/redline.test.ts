import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import type { DiffLine } from "@/lib/toolRows";
import { redline, remarkRedline } from "@/lib/redline";

const ctx = (text: string): DiffLine => ({ kind: "ctx", num: 0, text });
const add = (text: string): DiffLine => ({ kind: "add", num: 0, text });
const del = (text: string): DiffLine => ({ kind: "del", num: 0, text });

const html = (lines: DiffLine[]) =>
  renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm, remarkRedline] },
      redline(lines),
    ),
  );

describe("redline", () => {
  it("marks the words a changed line adds and removes", () => {
    expect(
      html([
        del("Skip tasks already done."),
        add("Skip tasks already done or reassigned."),
      ]),
    ).toBe("<p>Skip tasks already done<ins> or reassigned</ins>.</p>");
  });

  it("marks added and removed lines whole, inside their list item or heading", () => {
    const out = html([
      ctx("- Reminders"),
      add("- Shift start"),
      ctx(""),
      del("## Notes"),
    ]);
    expect(out).toContain("<li><ins>Shift start</ins></li>");
    expect(out).toContain("<h2><del>Notes</del></h2>");
  });

  it("shows a line too unlike its old one as removed, then added", () => {
    expect(html([del("alpha beta"), add("gamma delta")])).toBe(
      "<p><del>alpha beta</del>\n<ins>gamma delta</ins></p>",
    );
  });

  it("carries a mark across emphasis and inline code", () => {
    expect(html([add("**bold** then `code` rest")])).toBe(
      "<p><strong><ins>bold</ins></strong><ins> then </ins><ins><code>code</code></ins><ins> rest</ins></p>",
    );
  });

  it("shows changed inline code as it now reads, marked as added", () => {
    expect(html([del("Run `npm test` now"), add("Run `pnpm test` now")])).toBe(
      "<p>Run <ins><code>pnpm test</code></ins> now</p>",
    );
  });

  it("keeps a changed list marker or heading level outside the marks", () => {
    const out = html([del("## Notes"), add("### Notes")]);
    expect(out).toBe("<h2><del>Notes</del></h2>\n<h3><ins>Notes</ins></h3>");
  });

  it("shows text in a fence's place as added", () => {
    expect(html([ctx("a"), del("```"), add("See the log")])).toBe(
      "<p>a\n<ins>See the log</ins></p>",
    );
  });

  it("leaves code blocks as they now read, without marks", () => {
    const out = html([
      ctx("```"),
      del("old()"),
      add("new()"),
      ctx("```"),
      add("```ts"),
      add("added()"),
      add("```"),
    ]);
    expect(out).toContain("<pre><code>new()\n</code></pre>");
    expect(out).toContain('<code class="language-ts">added()\n</code>');
    expect(out).not.toContain("old()");
  });

  it("keeps unchanged text and drops removed blank lines", () => {
    expect(redline([ctx("same"), del(""), { kind: "gap" }])).toBe("same\n");
  });
});
