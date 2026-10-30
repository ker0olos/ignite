import { describe, expect, it } from "vitest";
import { outputKind } from "@/lib/outputKind";

describe("outputKind", () => {
  it("takes a lone URL as a link", () => {
    expect(outputKind("https://github.com/o/r/pull/789\n")).toBe("url");
    expect(outputKind("see https://x.dev")).toBe("terminal");
  });

  it("takes lines with two signs of markdown as markdown", () => {
    expect(outputKind("Intro\n\n## What\n- **bold** trigger: b")).toBe(
      "markdown",
    );
    expect(outputKind("- one\n- two\nRun `pnpm test` then `pnpm build`")).toBe(
      "markdown",
    );
  });

  it("takes plain output, or only one sign, as a terminal's", () => {
    expect(outputKind("✓ 3 passed\n Tests 29 passed")).toBe("terminal");
    expect(outputKind("# build\nout=`make`\necho done")).toBe("terminal");
    expect(outputKind("- a\n- b")).toBe("terminal");
    expect(outputKind("ls src/**/x/**\n- a\n- b")).toBe("terminal");
  });

  it("never takes one line, a diff or JSON as markdown", () => {
    expect(outputKind("Updated `a.ts` and `b.ts` in **bar**")).toBe("terminal");
    expect(outputKind("@@ -1 +1 @@\n- **a**\n- `b` and `c`")).toBe("terminal");
    expect(outputKind('[\n "Run `a` and `b`",\n "## x"\n]')).toBe("terminal");
  });
});
