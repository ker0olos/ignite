// `npm run setup`: installs the packages, builds the app and adds its launcher
// (sidecar/appLauncher.ts), on every platform. Safe to run again; it picks up
// where it stopped. `npm run setup -- --verbose` also shows each tool's output.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

// Before any TypeScript loads: older Nodes can't run it (nor mods' registerHooks).
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    `Ignite needs Node.js 22.18 or newer (this is ${process.versions.node}).`,
  );
  process.exit(1);
}

const { APP_NAME, APP_TITLE } = await import("../src/lib/app.ts");
const { stepper } = await import("../sidecar/appRun.ts");

const clone = dirname(dirname(fileURLToPath(import.meta.url)));
const home = homedir();
const log = join(home, `.${APP_NAME}`, "launch", "setup.log");
const step = stepper(log);
// Each run's log starts afresh; the tools' output joins it (sidecar/appRun.ts).
writeFileSync(
  log,
  `${APP_TITLE} setup, ${new Date().toISOString()}, Node ${process.version}, ${process.platform}-${process.arch}\n`,
);
process.env.IGNITE_TOOL_LOG = log;
if (process.argv.includes("--verbose")) process.env.IGNITE_VERBOSE = "1";
else console.log("(npm run setup -- --verbose shows each tool's output too)");

function fail(what, error) {
  step(`${what}:\n${error?.message ?? error}`);
  console.error(`\nThe full log is ${log}`);
  process.exit(1);
}

// Everything after this imports the packages: installed once, for the clone and the version setup builds.
const { linkPackages } = await import("../sidecar/appPackages.ts");
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

if (process.platform === "win32") {
  console.log(`
The sandbox is recommended: Auto mode needs it to run commands without asking.
Setting it up needs admin rights once, to create a Windows user for ${APP_TITLE}.
`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Turn on the sandbox? [Y/n] ");
  rl.close();
  if (!/^n/i.test(answer.trim())) await enableWindowsSandbox(home);
}

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
