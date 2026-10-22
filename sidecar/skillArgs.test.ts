// @vitest-environment node
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { skillInfo } from "./skillArgs.ts";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "skill-args-"));
});

const skill = (filePath: string) =>
  ({ name: "x", description: "X.", filePath }) as unknown as Skill;

/** skillInfo of a new SKILL.md whose frontmatter adds `lines`. */
async function info(...lines: string[]) {
  const file = join(root, `${Math.random()}.md`);
  await writeFile(
    file,
    `---\nname: x\ndescription: X.\n${lines.join("\n")}\n---\n`,
  );
  return skillInfo(skill(file));
}

describe("skillInfo", () => {
  it("reads Claude Code's argument-hint, quoted or as YAML's list", async () => {
    const hint = async (line: string) =>
      (await info(`argument-hint: ${line}`)).argumentHint;
    expect(await hint(`"[level] <target>"`)).toBe("[level] <target>");
    expect(await hint("[issue-number]")).toBe("[issue-number]");
    expect(await hint("[file, line]")).toBe("[file, line]");
  });

  it("reads each argument's description, in order", async () => {
    expect(
      await info(
        `argument-hint: "[level] [target]"`,
        "argument-descriptions:",
        "  - How hard to look",
        "  - ",
      ),
    ).toMatchObject({ argumentDescriptions: ["How hard to look", ""] });
  });

  it("reads each loaded skill's file once, a reloaded one's again", async () => {
    const file = join(root, "SKILL.md");
    const write = (hint: string) =>
      writeFile(
        file,
        `---\nname: x\ndescription: X.\nargument-hint: "${hint}"\n---\n`,
      );
    const loaded = skill(file);
    await write("<a>");
    expect(skillInfo(loaded).argumentHint).toBe("<a>");
    await write("<b>");
    expect(skillInfo(loaded).argumentHint).toBe("<a>");
    expect(skillInfo(skill(file)).argumentHint).toBe("<b>");
  });

  it("has none when they're missing, empty or the file can't be read", async () => {
    expect(
      await info(`argument-hint: ""`, "argument-descriptions: [' ']"),
    ).toEqual({ name: "x", description: "X." });
    expect(skillInfo(skill(join(root, "gone.md")))).toEqual({
      name: "x",
      description: "X.",
    });
  });
});
