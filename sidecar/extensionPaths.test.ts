// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("has extensions write prompt sections, never text added to the system prompt", () => {
  // claude-bridge passes Claude Code only the prompt's sections; added text never reaches it.
  const dir = new URL(".", import.meta.url);
  const appending = readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .filter((f) =>
      /event\.systemPrompt(?!Options)/.test(
        readFileSync(new URL(f, dir), "utf8"),
      ),
    );
  expect(appending).toEqual([]);
});
