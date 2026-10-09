/** Auto's sandbox on Windows (srt-win, alpha): commands run as `srt-sandbox`, which opens only what's granted. */
import {
  getWindowsSandboxUserStatusAsync,
  grantWindowsAcl,
  installWindowsSandboxAsync,
  resolveSrtWin,
  SandboxManager,
  stampWindowsAcl,
  VENDORED_SRT_WIN_EXE,
  type NetworkConfig,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import { getShellConfig } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import { refusedRequest, sandboxConfig, type Sandbox } from "./sandbox.ts";
import { allowedFile, loadAllowed, type Allowed } from "./sandboxAllow.ts";
import { hostReachable, readsOnly } from "./sandboxNetwork.ts";
import { gitAccess } from "./worktreeGit.ts";

/** PATH folders under the home folder: per-user installs (nvm, Scoop) the sandbox user can't open unless granted. */
export function homeTools(path: string, home: string): string[] {
  const under = home.toLowerCase().replace(/\\?$/, "\\");
  const dirs = path.split(";").filter((d) => d.toLowerCase().startsWith(under));
  return [...new Set(dirs)];
}

/** The session's config: the usual network, and grants that don't depend on a folder. */
export function windowsConfig(
  home: string,
  allowed: Allowed,
  tools: string[],
  scratch: string,
  exists: (path: string) => boolean = existsSync,
): SandboxRuntimeConfig {
  const base = sandboxConfig(tmpdir(), home, allowed);
  return {
    network: base.network,
    filesystem: {
      allowWrite: [scratch, ...allowed.write],
      allowRead: [...tools, ...allowed.read],
      // srt-win creates a missing path to deny it.
      denyRead: base.filesystem.denyRead.filter(exists),
      denyWrite: [],
    },
    windows: { srtWin: { path: VENDORED_SRT_WIN_EXE } },
  };
}

/** A folder's grant: write it and its worktree's git files, read the repository's, keep its pointers (gitAccess). */
export function folderGrant(
  cwd: string,
  exists: (path: string) => boolean = existsSync,
) {
  const git = gitAccess(cwd);
  const objects = git.allow[1];
  return {
    write: [cwd, ...git.allow],
    read: objects ? [dirname(objects)] : [],
    denyWrite: git.deny.filter(exists),
  };
}

const quote = (arg: string) => `'${arg.replace(/'/g, `'\\''`)}'`;

/** srt-win's argv as a Git Bash line, MSYS path conversion off so arguments arrive as written. */
// ponytail: relies on MSYS quoting argv the way srt-win (MSVCRT rules) parses it; spawn the argv directly if a command arrives mangled.
export function bashLine([exe, ...args]: string[]): string {
  const words = [exe.replace(/\\/g, "/"), ...args].map(quote);
  return `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' ${words.join(" ")}`;
}

/** The sandbox user's SID, setting it up first (one UAC prompt) if it isn't yet. */
async function sandboxUser() {
  const srtWin = resolveSrtWin({ path: VENDORED_SRT_WIN_EXE });
  let user = await getWindowsSandboxUserStatusAsync({ srtWin });
  if (!user.provisioned || !user.credPresent) {
    const done = await installWindowsSandboxAsync({ srtWin });
    if (done.cancelled) throw new Error("its one-time setup was declined");
    user = done.user;
  }
  if (!user.sid) throw new Error("the sandbox user has no SID");
  return { sid: user.sid, srtWin };
}

/** Starts the Windows sandbox, its proxy in this process; throws when it can't (UAC declined). */
// ponytail: every command runs as the same srt-sandbox user and grants last until the sidecar ends, so a command can write in any folder a command ran in before; per-exec denies would block those folders' own running commands.
export async function createWindowsSandbox(home = homedir()): Promise<Sandbox> {
  const { sid, srtWin } = await sandboxUser();
  const scratch = join(tmpdir(), `${APP_NAME}-scratchpad`);
  mkdirSync(scratch, { recursive: true });
  // ponytail: always-allowed paths apply from the next start; hosts apply at once.
  const allowed = await loadAllowed(allowedFile(home));
  const tools = homeTools(process.env.PATH ?? "", home);
  const config = windowsConfig(home, allowed, tools, scratch);
  let listed = config.network.allowedDomains;
  const filterRequest = readsOnly(() => listed);
  const withNetwork = (network: NetworkConfig) => ({
    ...config,
    network: { ...network, filterRequest },
  });
  await SandboxManager.initialize(withNetwork(config.network), hostReachable);
  const granted = new Set<string>();
  const bash = getShellConfig().shell;
  return {
    // Per-exec denies would block other commands in the folder too, so no read-only-until-planned here.
    locks: false,
    wrap: async (command, cwd, id) => {
      const now = await loadAllowed(allowedFile(home));
      const { network } = sandboxConfig(tmpdir(), home, now);
      listed = network.allowedDomains;
      SandboxManager.updateConfig(withNetwork(network));
      // ponytail: srt-win's ACL calls are sync, so a folder's first command blocks the sidecar while its grant spreads.
      if (!granted.has(cwd)) {
        const { write, read, denyWrite } = folderGrant(cwd);
        grantWindowsAcl({ sandboxUserSid: sid, srtWin, write, read });
        if (denyWrite.length) {
          stampWindowsAcl({
            sandboxUserSid: sid,
            srtWin,
            denyRead: [],
            denyWrite,
          });
        }
        granted.add(cwd);
      }
      const { argv } = await SandboxManager.wrapWithSandboxArgv(
        `set -o pipefail; ${command}`,
        bash,
        undefined,
        undefined,
        cwd,
        { commandId: id },
      );
      return bashLine(argv);
    },
    // The proxy records its denials as they happen; files blocked show only in the output.
    explain: async (id, output) =>
      SandboxManager.annotateStderrWithSandboxFailures(id, output),
    sendRefused: refusedRequest,
  };
}
