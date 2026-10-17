/**
 * The launcher setup adds, so Ignite opens like any app: ~/Applications/Ignite.app
 * on macOS, an app menu entry on Linux, a Start Menu shortcut on Windows. Each
 * runs launcher/launch.mjs with the PATH setup ran with, since apps opened from
 * Finder, a menu or the Start Menu get a bare one. Safe to run again.
 */
import { spawn, spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { APP_NAME, APP_TITLE } from "../src/lib/app.ts";

/** Where Linux keeps per-user app data (its menu entries), or Windows (the Start Menu). */
export function userData(
  platform: NodeJS.Platform,
  home: string,
  env: NodeJS.ProcessEnv,
) {
  if (platform === "win32")
    return env.APPDATA ?? join(home, "AppData", "Roaming");
  return env.XDG_DATA_HOME ?? join(home, ".local", "share");
}

/**
 * Where the launcher lives on `platform`: what the user opens (the app, the
 * menu entry, the shortcut), and on Linux and Windows the script it runs.
 */
export function launcherFiles(
  platform: NodeJS.Platform,
  home: string,
  data: string,
): { shown: string; script?: string } {
  const bin = join(home, `.${APP_NAME}`, "bin");
  if (platform === "darwin")
    return { shown: join(home, "Applications", `${APP_TITLE}.app`) };
  if (platform === "win32")
    return {
      shown: join(
        data,
        "Microsoft",
        "Windows",
        "Start Menu",
        "Programs",
        `${APP_TITLE}.lnk`,
      ),
      script: join(bin, `${APP_NAME}-launch.ps1`),
    };
  return {
    shown: join(data, "applications", `${APP_NAME}.desktop`),
    script: join(bin, `${APP_NAME}-launch`),
  };
}

type Place = {
  /** The clone, whose launcher/launch.mjs runs. */
  clone: string;
  home: string;
  /** The PATH the launcher keeps: setup's, which found node and git. */
  path: string;
  /** Where the platform keeps per-user data (Linux's XDG_DATA_HOME, Windows' APPDATA). */
  data: string;
};

const quoted = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

/** The shell script macOS and Linux run: setup's PATH, then the launcher. */
export const unixLaunch = ({ clone, path }: Place) =>
  `#!/bin/bash\nexport PATH=${quoted(path)}\nexec node ${quoted(join(clone, "launcher", "launch.mjs"))}\n`;

/** The PowerShell script the Windows shortcut runs. */
export const windowsLaunch = ({ clone, path }: Place) => {
  const ps = (s: string) => `'${s.replace(/'/g, "''")}'`;
  return `$env:PATH = ${ps(path)}\n& node ${ps(join(clone, "launcher", "launch.mjs"))}\n`;
};

// LSUIElement: no Dock icon for the launcher; the app it starts has its own.
const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIdentifier</key><string>com.${APP_NAME}.launcher</string>
  <key>CFBundleName</key><string>${APP_TITLE}</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
  <key>NSAppSleepDisabled</key><true/>
</dict>
</plist>
`;

/** The Linux app menu entry. */
export const desktopEntry = (launch: string, clone: string) => `[Desktop Entry]
Type=Application
Name=${APP_TITLE}
Comment=Run AI coding agents on your projects
Exec="${launch}"
Icon=${join(clone, "src-tauri", "icons", "icon.png")}
Terminal=false
Categories=Development;
StartupWMClass=${APP_NAME}
`;

async function write(file: string, text: string, mode?: number) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
  if (mode) await chmod(file, mode);
}

/** ~/Applications/Ignite.app; returns it. */
async function macApp(place: Place) {
  const bundle = launcherFiles("darwin", place.home, place.data).shown;
  const contents = join(bundle, "Contents");
  await write(join(contents, "MacOS", "launch"), unixLaunch(place), 0o755);
  await write(join(contents, "Info.plist"), PLIST);
  await mkdir(join(contents, "Resources"), { recursive: true });
  const icon = join(place.clone, "src-tauri", "icons", "icon.icns");
  await copyFile(icon, join(contents, "Resources", "icon.icns"));
  return bundle;
}

/** The launch script and the app menu entry that runs it; returns the script. */
async function linuxEntry(place: Place) {
  const { shown, script: launch = "" } = launcherFiles(
    "linux",
    place.home,
    place.data,
  );
  await write(launch, unixLaunch(place), 0o755);
  await write(shown, desktopEntry(launch, place.clone));
  spawnSync("update-desktop-database", ["-q", dirname(shown)]);
  return launch;
}

/** PowerShell's arguments to run the launch script with no window. */
const hiddenRun = (launch: string) => [
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-WindowStyle",
  "Hidden",
  "-File",
  launch,
];

/** The launch script and a Start Menu shortcut to it (made through COM, which only PowerShell reaches); returns the script. */
async function windowsShortcut(place: Place) {
  const { shown, script: launch = "" } = launcherFiles(
    "win32",
    place.home,
    place.data,
  );
  await write(launch, windowsLaunch(place));
  const ps = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const args = hiddenRun(launch)
    .map((a) => (a.includes(" ") ? `"${a}"` : a))
    .join(" ");
  const script = [
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${ps(shown)})`,
    `$s.TargetPath = 'powershell.exe'`,
    `$s.Arguments = ${ps(args)}`,
    `$s.IconLocation = ${ps(join(place.clone, "src-tauri", "icons", "icon.ico"))}`,
    // Minimized, so no console flashes up.
    `$s.WindowStyle = 7`,
    `$s.Save()`,
  ].join("; ");
  const made = spawnSync("powershell.exe", ["-NoProfile", "-Command", script]);
  if (made.status !== 0)
    throw new Error(`Couldn't make the Start Menu shortcut: ${made.stderr}`);
  return launch;
}

/** Adds the launcher for this platform, then opens Ignite with it; says where it is. */
export async function addLauncher(
  place: Place,
  platform: NodeJS.Platform = process.platform,
) {
  if (platform === "darwin") {
    const bundle = await macApp(place);
    spawn("open", [bundle], { detached: true, stdio: "ignore" }).unref();
    return `${APP_TITLE} is in ~/Applications.`;
  }
  if (platform === "win32") {
    const launch = await windowsShortcut(place);
    spawn("powershell.exe", hiddenRun(launch), {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return `${APP_TITLE} is in the Start Menu.`;
  }
  const launch = await linuxEntry(place);
  spawn(launch, [], { detached: true, stdio: "ignore" }).unref();
  return `${APP_TITLE} is in your app menu.`;
}
