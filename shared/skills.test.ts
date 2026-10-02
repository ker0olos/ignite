import { expect, it } from "vitest";
import { typedSkill } from "./skills.ts";

const BLOCK =
  '<skill name="code-review" location="/s/SKILL.md">\nReferences are relative to /s.\n\nBody\n</skill>';

it("shows a message pi expanded from a skill as the command the user typed", () => {
  expect(typedSkill(BLOCK)).toBe("/code-review");
  expect(typedSkill(`${BLOCK}\n\nsrc/\nand more`)).toBe(
    "/code-review src/\nand more",
  );
});

it("leaves other messages alone", () => {
  expect(typedSkill("fix <skill> parsing")).toBe("fix <skill> parsing");
});
