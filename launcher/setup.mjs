// `npm run setup`: installs the packages, builds the app and adds its launcher
// (sidecar/appLauncher.ts), on every platform. Safe to run again; it picks up
// where it stopped. `npm run setup -- --verbose` also shows each tool's output;
// `--check` reports and changes nothing; `--sandbox` or `--no-sandbox` answers
// the sandbox's questions (Windows' sandbox, Linux's bubblewrap and socat). `npm run uninstall` removes it.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import "./nodeCheck.mjs";

// An option it doesn't know would otherwise run a whole setup (a typo'd `--check,` too).
const OPTIONS = ["--check", "--verbose", "--sandbox", "--no-sandbox"];
const unknown = process.argv.slice(2).filter((a) => !OPTIONS.includes(a));
if (unknown.length) {
  console.error(
    `Unknown option ${unknown.join(" ")}. Setup takes ${OPTIONS.join(" or ")}.`,
  );
  process.exit(1);
}

const { APP_NAME, APP_TITLE } = await import("../src/lib/app.ts");
const { stepper } = await import("../sidecar/appRun.ts");

const clone = dirname(dirname(fileURLToPath(import.meta.url)));
const home = homedir();
const log = join(home, `.${APP_NAME}`, "launch", "setup.log");
// `--check` reports what setup set up and what takes space, and changes nothing (the last log included).
if (process.argv.includes("--check")) {
  const { checks, human, space } = await import("../sidecar/appDoctor.ts");
  const place = { clone, home, platform: process.platform, env: process.env };
  for (const { ok, text } of await checks(place))
    console.log(`${ok ? "✓" : "✗"} ${text}`);
  const used = space(home);
  const total = human(used.reduce((sum, [, bytes]) => sum + bytes, 0));
  console.log(`\nSpace in ~/.${APP_NAME} (${total}):`);
  for (const [name, bytes] of used.filter(([, b]) => b >= 1 << 20))
    console.log(`  ${human(bytes).padStart(8)}  ${name}`);
  console.log(`\nThe last setup's log is ${log}`);
  process.exit(0);
}
const step = stepper(log);
// Each run's log starts afresh; the tools' output joins it (sidecar/appRun.ts).
writeFileSync(
  log,
  `${APP_TITLE} setup, ${new Date().toISOString()}, Node ${process.version}, ${process.platform}-${process.arch}\n`,
);
process.env.IGNITE_TOOL_LOG = log;
if (process.argv.includes("--verbose")) process.env.IGNITE_VERBOSE = "1";

// The sandbox's questions are asked before the long part, so setup then runs to the end unattended.
const sandboxFlag = process.argv.includes("--sandbox")
  ? true
  : process.argv.includes("--no-sandbox")
    ? false
    : null;

async function yes(question) {
  if (sandboxFlag !== null) return sandboxFlag;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [Y/n] `);
  rl.close();
  return !/^n/i.test(answer.trim());
}

async function wantsWindowsSandbox() {
  if (process.platform !== "win32") return false;
  if (sandboxFlag === null)
    console.log(`
The sandbox is recommended: Auto mode needs it to run commands without asking.
Setting it up needs admin rights once, to create a Windows user for ${APP_TITLE}.
`);
  return yes("Turn on the sandbox?");
}
const windowsSandbox = await wantsWindowsSandbox();

// sandbox-runtime needs bubblewrap and socat from the system, which only root installs.
async function installLinuxSandbox() {
  const { installCommand, missingPackages } =
    await import("../sidecar/appLinuxSandbox.ts");
  const path = process.env.PATH ?? "";
  const missing = missingPackages(path);
  if (!missing.length || sandboxFlag === false) return;
  const names = missing.join(" and ");
  const command = installCommand(missing, {
    path,
    root: process.getuid() === 0,
  });
  const manual = `Install ${names} so the agent's commands run sandboxed.`;
  if (!command) return step(manual);
  console.log(`\nThe sandbox needs ${names}: ${command.join(" ")}`);
  if (!(await yes("Install them now? (asks for your password)"))) return;
  step(`Installing ${names}…`);
  const { status } = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
  });
  if (status !== 0) step(`Couldn't install them. ${manual}`);
}
if (process.platform === "linux") await installLinuxSandbox();

function fail(what, error) {
  step(`${what}:\n${error?.message ?? error}`);
  console.error(`\nThe full log is ${log}`);
  process.exit(1);
}

// Everything after this imports the packages: installed once, for the clone and the version setup builds.
const { linkPackages } = await import("../sidecar/appPackages.ts");
const { followRename, preflight, readyToRun } =
  await import("../sidecar/appPreflight.ts");
const moved = await followRename(clone);
if (moved) step(moved);
// Before it downloads anything; a rerun with nothing to download goes on offline too.
if (!(await readyToRun(clone, home))) {
  const problem = await preflight(home);
  if (problem) fail(`${APP_TITLE} can't be set up`, problem);
}
await linkPackages(clone, { keepOwn: true, step }).catch((error) =>
  fail("Couldn't install the packages", error),
);

const { buildsBinary, enableWindowsSandbox } =
  await import("../sidecar/appSetup.ts");
if (buildsBinary() && spawnSync("cargo", ["--version"]).status !== 0)
  fail(
    "No prebuilt binary for this machine",
    "it needs Rust: https://rustup.rs",
  );

if (windowsSandbox) await enableWindowsSandbox(home);

// Built now, so the first start opens at once.
const { buildVersion, LAUNCH } = await import("../sidecar/appBuild.ts");
const { writeState } = await import("../sidecar/appVersions.ts");
// The launcher watches it for mods, so it's there from the start.
const mods = join(dirname(LAUNCH), "mods");
mkdirSync(mods, { recursive: true });
const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: clone })
  .stdout.toString()
  .trim();
await buildVersion(clone, head, clone, mods, console.warn, step).catch(
  (error) => fail(`Couldn't build ${APP_TITLE}`, error),
);
await writeState("next", head);

step(`Adding ${APP_TITLE}'s launcher…`);
const { addLauncher, userData } = await import("../sidecar/appLauncher.ts");
const where = await addLauncher({
  clone,
  home,
  path: process.env.PATH ?? "",
  data: userData(process.platform, home, process.env),
}).catch((error) => fail("Couldn't add the launcher", error));
step(`${where} Opening it now.`);
