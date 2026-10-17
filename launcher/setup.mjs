// `npm run setup`: builds the app, then adds its launcher with setup.ps1 on
// Windows (which may have no bash), setup.sh elsewhere.
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

// Mods need Node's registerHooks, and the sidecar runs TypeScript directly.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18))
  fail("Ignite needs Node.js 22.18 or newer.");
// CI's binary is verified with gh; without it, the binary is built with Rust.
const works = (cmd, args) => spawnSync(cmd, args).status === 0;
if (!works("gh", ["auth", "status"]) && !works("cargo", ["--version"]))
  fail(
    "Ignite needs the GitHub CLI signed in (gh auth login) to use its prebuilt binary, or Rust to build one: https://rustup.rs",
  );

/** Builds this checkout's commit now, so the first start opens at once. */
async function firstBuild() {
  const { buildVersion, LAUNCH } = await import("../sidecar/appBuild.ts");
  const { writeState } = await import("../sidecar/appVersions.ts");
  const clone = dirname(here);
  const mods = join(dirname(LAUNCH), "mods");
  mkdirSync(mods, { recursive: true });
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: clone })
    .stdout.toString()
    .trim();
  console.log(
    "Setting up Ignite. Without a prebuilt binary this takes a few minutes.",
  );
  try {
    await buildVersion(clone, head, clone, mods);
  } catch (error) {
    fail(`Couldn't build Ignite:\n${error.message}`);
  }
  await writeState("next", head);
}

const windows = process.platform === "win32";
if (windows) await offerWindowsSandbox();
await firstBuild();
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
