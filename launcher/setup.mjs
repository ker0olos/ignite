// `npm run setup`: setup.ps1 on Windows (which may have no bash), setup.sh elsewhere.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "smol-toml";

const here = dirname(fileURLToPath(import.meta.url));

/** Turns on `[approval] windows_sandbox` in settings.toml, keeping the rest. */
function enableWindowsSandbox() {
  const file = join(homedir(), ".ignite", "settings.toml");
  let settings = {};
  try {
    settings = parse(readFileSync(file, "utf8"));
  } catch {
    // No settings yet: the app fills in the rest.
  }
  settings.approval = { ...settings.approval, windows_sandbox: true };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, stringify(settings));
}

async function offerWindowsSandbox() {
  console.log(`
The sandbox is recommended: Auto mode needs it to run commands without asking.
Setting it up needs admin rights once, to create a Windows user for Ignite.
`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Turn on the sandbox? [Y/n] ");
  rl.close();
  if (!/^n/i.test(answer.trim())) enableWindowsSandbox();
}

const windows = process.platform === "win32";
if (windows) await offerWindowsSandbox();
const { status } = windows
  ? spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(here, "setup.ps1"),
      ],
      { stdio: "inherit" },
    )
  : spawnSync("bash", [join(here, "setup.sh")], { stdio: "inherit" });
process.exit(status ?? 1);
