// @vitest-environment node
import { beforeAll, expect, it } from "vitest";
import type { ParseBash } from "../src/lib/dangerousCommands.ts";
import { loadBashParser } from "./bashParser.ts";
import { onlySearches } from "./bashSearch.ts";

let parse: ParseBash;
beforeAll(async () => {
  parse = await loadBashParser();
});

const searches = (command: string) => onlySearches(parse(command)!, "/repo");

it.each([
  'grep -n "options.mode\\|options.recalc" src/recalc.ts',
  "cd server && grep -rn foo src | head -20",
  "sed -n '10,40p' src/a.ts; wc -l src/a.ts",
  "cat package.json",
  "rg -l useThing src 2>/dev/null",
  "grep -i foo src/a.ts 2>&1 | sort | uniq",
  "find src -name '*.ts' -print; grep foo src/a.ts",
  "grep foo /repo/src/a.ts",
  "tail -n 20 logs/dev.log",
  "grep -A3 --include=*.ts foo src 2>&1",
])("redirects %s", (command) => {
  expect(searches(command)).toBe(true);
});

it.each([
  "ls src",
  "find src -name '*.ts'",
  "git show HEAD:src/a.ts | grep foo",
  "npm test 2>&1 | tail -20",
  "sed -i 's/a/b/' src/a.ts",
  "grep foo src/a.ts > out.txt",
  "find src -name '*.ts' -exec grep foo {} +",
  "grep foo ~/notes.txt",
  "cat ../other/a.ts",
  "grep foo /etc/hosts",
  "cd /tmp && grep foo a.txt",
  "find src | xargs grep foo",
  "ls -la | head",
  "wc -l src/*.ts | sort -n | tail -20",
  "find . -type f | grep -c test",
  'echo "$x" | sed s/a/b/',
  "tail -n 50 $TMPDIR/ignite-scratchpad/out.log",
  'cat "$HOME/.npmrc"',
  "grep --file=/etc/patterns foo src",
  "tail -f logs/dev.log",
  "tail -F logs/dev.log",
  "grep -rn foo . >& matches.txt",
  "sed -n 's/x/y/w out.txt' a.ts",
])("leaves %s to bash", (command) => {
  expect(searches(command)).toBe(false);
});
