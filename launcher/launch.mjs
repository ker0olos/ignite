// What the Ignite shortcut runs (made by `npm run setup`): starts the newest
// built version at once (sidecar/appBuild.ts), with the user's mods, and falls
// back if it doesn't come up. The app builds updates in the background.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, rmSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  binaryOf,
  buildVersion,
  ensureDist,
  isBuilt,
  LAUNCH,
  versionDir,
  viteEnv,
} from "../sidecar/appBuild.ts";
import {
  clearState,
  pruneVersions,
  readState,
  writeState,
} from "../sidecar/appVersions.ts";
import { portTaken, serveFrontend } from "./serve.mjs";

const PORT = 1420;
const clone = dirname(dirname(fileURLToPath(import.meta.url)));
const MODS = join(dirname(LAUNCH), "mods");
const HEALTHY = join(LAUNCH, "healthy");
mkdirSync(MODS, { recursive: true });
mkdirSync(LAUNCH, { recursive: true });
const logFd = openSync(join(LAUNCH, "log"), "a");
const log = (text) => writeSync(logFd, `${text}\n`);

const quote = (text, q) => text.replaceAll(q, q === "'" ? "''" : "'");

function tell(text, urgent = false) {
  log(text);
  const run = (cmd, args) =>
    spawn(cmd, args, { stdio: "ignore", detached: true, windowsHide: true })
      .on("error", () => {})
      .unref();
  const line = quote(text, '"');
  if (process.platform === "darwin")
    return run("osascript", [
      "-e",
      urgent
        ? `display alert "${line}"`
        : `display notification "${line}" with title "Ignite"`,
    ]);
  if (process.platform === "linux")
    return run("notify-send", [
      ...(urgent ? ["-u", "critical"] : []),
      "Ignite",
      text,
    ]);
  // The balloon closes with its process, so that waits a few seconds.
  const ps = urgent
    ? `[System.Windows.Forms.MessageBox]::Show('${quote(text, "'")}', 'Ignite')`
    : `$n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(8000, 'Ignite', '${quote(text, "'")}', 'Info'); Start-Sleep 8; $n.Dispose()`;
  run("powershell.exe", [
    "-NoProfile",
    "-WindowStyle",
    "Hidden",
    "-Command",
    `Add-Type -AssemblyName System.Windows.Forms; ${ps}`,
  ]);
}

/** The version to start: a built update, else the last good one, else this clone's commit, built now. */
async function pick() {
  const next = await readState("next");
  if (next && next !== (await readState("bad")) && isBuilt(versionDir(next)))
    return next;
  const good = await readState("good");
  if (good && isBuilt(versionDir(good))) return good;
  tell("Setting up. The first start takes a few minutes.");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: clone })
    .toString()
    .trim();
  await buildVersion(clone, head, clone, MODS, (text) => tell(text), log);
  return head;
}

async function waitHealthy(seconds, exited) {
  for (let i = 0; i < seconds * 4; i++) {
    if (existsSync(HEALTHY)) return true;
    const done = await Promise.race([
      exited.then(() => true),
      new Promise((r) => setTimeout(() => r(false), 250)),
    ]);
    if (done) return false;
  }
  return false;
}

/** Runs version `sha` until it quits. Fails if it never reports healthy (src/lib/health.ts). */
async function start(sha, mods) {
  const dir = versionDir(sha);
  rmSync(HEALTHY, { force: true });
  let dist;
  try {
    dist = await ensureDist(dir, mods);
  } catch (error) {
    log(error.message);
    return false;
  }
  const close = await serveFrontend({
    dist,
    dir,
    mods,
    port: PORT,
    logFd,
    log,
  });
  const app = spawn(binaryOf(dir), [], {
    cwd: join(dir, "src-tauri"),
    env: { ...process.env, ...viteEnv(mods) },
    stdio: ["ignore", logFd, logFd],
  });
  const exited = new Promise((resolve) => {
    app.on("exit", resolve);
    app.on("error", (error) => resolve(log(error.message)));
  });
  if (!(await waitHealthy(60, exited))) {
    app.kill();
    close();
    return false;
  }
  const previous = await readState("good");
  await writeState("good", sha);
  if ((await readState("next")) === sha) await clearState("next");
  pruneVersions(clone, [sha, previous, await readState("next")]).catch((e) =>
    log(e.message),
  );
  await exited;
  close();
  return true;
}

async function launch() {
  const sha = await pick();
  if (await start(sha, MODS)) return;
  const good = await readState("good");
  let fallback = sha;
  if (good && good !== sha && isBuilt(versionDir(good))) {
    await writeState("bad", sha);
    await clearState("next");
    tell(
      "The latest update didn't start with your changes, so Ignite is staying on the previous version.",
    );
    if (await start(good, MODS)) return;
    fallback = good;
  }
  tell("Ignite didn't start with your changes, so they're off for now.");
  if (await start(fallback, "")) return;
  tell("Ignite couldn't start. The log is in ~/.ignite/launch/log.", true);
}

log(`--- ${new Date().toString()}`);
if (await portTaken(PORT)) {
  tell("Port 1420 is taken, most likely by Ignite in dev mode. Quit it first.");
} else {
  try {
    // Restarts only into an update, so a restart that never quit can't reopen a later quit.
    do {
      await clearState("restart");
      await launch();
    } while ((await readState("restart")) && (await readState("next")));
  } catch (error) {
    tell(`Ignite couldn't start: ${error.message.slice(0, 200)}`, true);
  }
}
process.exit(0);
