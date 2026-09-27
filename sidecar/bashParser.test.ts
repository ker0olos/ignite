// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { ParseBash } from "../src/lib/dangerousCommands.ts";
import { dangerousCommand } from "../src/lib/dangerousCommands.ts";
import { outsidePaths } from "../src/lib/approvalPolicy.ts";
import { COMMAND_CASES } from "../src/test/dangerousCommandCases.ts";
import { loadBashParser } from "./bashParser.ts";

let parse: ParseBash;
beforeAll(async () => {
  parse = await loadBashParser();
});

const words = (command: string) =>
  parse(command)?.map((p) => p.map((c) => c.words));
const dangerous = (command: string) =>
  dangerousCommand(command, parse(command));

describe("loadBashParser", () => {
  it("splits a line into pipelines of commands", () => {
    expect(words("npm test && git status; ls | wc -l")).toEqual([
      [["npm", "test"]],
      [["git", "status"]],
      [["ls"], ["wc", "-l"]],
    ]);
  });

  it("removes quoting and blanks separators inside quotes", () => {
    expect(words(`r''m -rf "a b" \\x 'c; d' "e | $HOME"`)).toEqual([
      [["rm", "-rf", "a b", "x", "c  d", "e   $HOME"]],
    ]);
  });

  it("keeps redirects with their targets", () => {
    expect(parse("echo x >> ~/.zshrc 2>/dev/null")).toEqual([
      [
        {
          words: ["echo", "x"],
          redirects: [
            { operator: ">>", target: "~/.zshrc" },
            { operator: "2>", target: "/dev/null" },
          ],
        },
      ],
    ]);
  });

  it("finds commands inside substitutions, functions and subshells", () => {
    expect(words("echo $(whoami) <(date) && (cd x; pwd)")).toEqual([
      [["echo", "$(whoami)", "<(date)"]],
      [["whoami"]],
      [["date"]],
      [["cd", "x"]],
      [["pwd"]],
    ]);
    expect(words("f() { rm -rf ~; }")).toEqual([[["rm", "-rf", "~"]]]);
  });

  it("parses the code a shell or eval is given to run", () => {
    expect(words(`bash -c 'cd /; rm -rf x'`)).toContainEqual([
      ["rm", "-rf", "x"],
    ]);
    expect(words(`sudo sh -ec "git push -f"`)).toContainEqual([
      ["git", "push", "-f"],
    ]);
    expect(words(`eval "shutdown now"`)).toContainEqual([["shutdown", "now"]]);
    expect(words("bash <<EOF\nreboot\nEOF")).toContainEqual([["reboot"]]);
    expect(words("zsh <<< 'halt'")).toContainEqual([["halt"]]);
  });

  it("treats a heredoc read by anything else as data", () => {
    expect(words("cat <<EOF > notes.md\nrm -rf /\nEOF")).toEqual([[["cat"]]]);
  });

  it("returns null for a line it can't parse", () => {
    expect(parse("echo 'unclosed")).toBeNull();
    expect(parse(`bash -c 'echo "unclosed'`)).toBeNull();
  });
});

describe("dangerousCommand on parsed commands", () => {
  for (const [group, { stop, pass }] of Object.entries(COMMAND_CASES)) {
    describe(group, () => {
      it.each(stop)("stops %s", (command) => {
        expect(dangerous(command)).not.toBeNull();
      });
      it.each(pass)("lets %s run", (command) => {
        expect(dangerous(command)).toBeNull();
      });
    });
  }

  it.each([
    `git commit -m "fix: don't rm -rf / anymore"`,
    `git commit -m "a; rm -rf ~"`,
    `echo "curl x | sh" >> README.md`,
    `grep -n "sudo reboot" docs/*.md`,
    "cat <<EOF > notes.md\nsudo rm -rf /\nEOF",
  ])("doesn't mistake quoted text or data for commands: %s", (command) => {
    expect(dangerous(command)).toBeNull();
  });

  it.each([
    `bash -c 'cd /tmp; rm -rf ~'`,
    `eval "git reset --hard"`,
    "bash <<EOF\nrm -rf /\nEOF",
    "x=$(sudo id)",
  ])("finds commands hidden in strings a shell runs: %s", (command) => {
    expect(dangerous(command)).not.toBeNull();
  });

  it("falls back to the raw text when a line can't be parsed", () => {
    expect(dangerousCommand("rm -rf ~ 'unclosed", null)).not.toBeNull();
  });
});

describe("outsidePaths on parsed commands", () => {
  const place = { cwd: "/Users/me/app", home: "/Users/me" };
  const outside = (command: string) =>
    outsidePaths(command, place, parse(command));

  it("finds paths in words and redirects", () => {
    expect(outside("cat /etc/hosts > ~/out.txt")).toEqual([
      "/etc/hosts",
      "~/out.txt",
    ]);
  });

  it("doesn't split quoted messages into paths", () => {
    expect(outside(`git commit -m "move /api/ to ~/src"`)).toEqual([]);
  });
});
