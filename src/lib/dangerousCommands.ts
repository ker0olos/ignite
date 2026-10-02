/**
 * Shell commands that Auto approval still stops for: ones that destroy data
 * beyond the folder, take over the machine, or leak secrets. Each rule has
 * the reason shown on the tool row.
 */

// ponytail: a regex denylist can't model bash (variables, eval, scripts the
// agent writes and then runs), so it catches honest mistakes, not an agent
// set on getting around it. Manual mode, or a sandbox, is the real boundary.

// Where a command starts: line start or after ; & | ( ` $( {, then any
// VAR=value assignments and wrappers that run the next word as a command.
const START = String.raw`(?:^|[;&|(\x60{\n]|\$\()\s*(?:\w+=\S*\s+)*(?:(?:command|exec|nohup|time|nice|env|builtin|sudo|doas|xargs(?:\s+-\S+)*)\s+)*`;
// Arguments up to the end of this simple command.
const ARGS = String.raw`[^;&|\n]*`;
// Paths too broad to touch recursively: /, the home folder, the parent or
// current folder, a bare glob, and the system's top-level folders.
const BROAD = String.raw`(?:\/\*?|~\/?\*?|\$\{?HOME\}?\/?\*?|\.\.?\/?\*?|\*|\/(?:bin|boot|dev|etc|home|lib|opt|private|root|sbin|usr|var|System|Library|Applications|Users|Volumes)(?:\/\S*)?)`;
// Outside the folder, or the system's top-level folders (no . or *).
const ROOTS = String.raw`(?:\/\*?|~\/?\*?|\$\{?HOME\}?\/?\*?|\.\.\/?\*?|\/(?:bin|boot|dev|etc|home|lib|opt|private|root|sbin|usr|var|System|Library|Applications|Users|Volumes)(?:\/\S*)?)`;
const RECURSIVE = String.raw`(?=${ARGS}\s(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b)`;
const END = String.raw`(?=\s|$|[;&|)])`;

const cmd = (name: string, rest = "") =>
  new RegExp(`${START}${name}${rest}`, "m");

/** The denylist, in the order it is checked. */
export const DANGEROUS_COMMANDS: readonly {
  pattern: RegExp;
  reason: string;
  rawText?: boolean;
}[] = [
  {
    pattern: cmd(String.raw`rm\b`, `${RECURSIVE}${ARGS}\\s${BROAD}${END}`),
    reason:
      "Recursively deletes a broad path (/, ~, the folder, a system folder)",
  },
  {
    pattern: cmd(
      String.raw`find\s+${ROOTS}\s`,
      `${ARGS}-(?:delete|exec\\s+rm)\\b`,
    ),
    reason: "Deletes files across a whole folder tree",
  },
  {
    pattern: cmd(String.raw`xargs\b${ARGS}\brm\s+-[a-zA-Z]*[rR]`),
    reason: "Deletes a list of folders recursively",
  },
  {
    pattern: cmd(String.raw`(?:shred|srm)\b`),
    reason: "Securely erases files",
  },
  {
    pattern: new RegExp(String.raw`\bmv\b${ARGS}\s\/dev\/null${END}`),
    reason: "Moves files into /dev/null",
  },
  {
    pattern: cmd(String.raw`(?:sudo|doas|su|pkexec|runas)\b`),
    reason: "Runs a command as another user (root)",
  },
  {
    pattern: cmd(
      String.raw`(?:mkfs(?:\.\w+)?|newfs(?:_\w+)?|fdisk|sfdisk|gdisk|parted|wipefs|mkswap)\b`,
    ),
    reason: "Formats or partitions a disk",
  },
  {
    pattern: cmd(
      String.raw`diskutil\s+`,
      String.raw`(?:erase\w*|zeroDisk|randomDisk|secureErase|partitionDisk|reformat|apfs\s+(?:delete\w*|erase\w*)|unmountDisk)\b`,
    ),
    reason: "Erases or repartitions a disk",
  },
  {
    pattern: new RegExp(String.raw`\bdd\b${ARGS}\bof=\/dev\/`),
    reason: "Writes raw data to a device",
  },
  {
    pattern:
      /(?:>|\btee\s+(?:-a\s+)?)\s*\/dev\/(?:r?disk|sd|hd|nvme|mmcblk|xvd)/,
    reason: "Writes raw data to a device",
  },
  {
    pattern: /(\w+|:)\s*\(\)\s*\{[^}]*\1\s*\|\s*\1\s*&/,
    reason: "Fork bomb",
    // Parsing splits the function from its body, so match the whole text.
    rawText: true,
  },
  {
    pattern: cmd(
      String.raw`(?:chmod|chown|chgrp|chflags)\b`,
      `${RECURSIVE}${ARGS}\\s${BROAD}${END}`,
    ),
    reason: "Changes permissions across a whole folder tree",
  },
  {
    pattern: cmd(String.raw`chmod\s+(?:-\S+\s+)*[0-7]?777\s+${BROAD}${END}`),
    reason: "Makes system files writable by everyone",
  },
  {
    pattern: /\|\s*(?:sudo\s+)?(?:env\s+)?(?:ba|z|da|k|fi|c|tc)?sh(?:\s|$)/,
    reason: "Pipes text into a shell",
  },
  {
    pattern:
      /\|\s*(?:sudo\s+)?(?:python3?|perl|ruby|node|php|osascript)(?:\s+-\s*)?(?:\s*$|\s*[;&|])/,
    reason: "Pipes text into an interpreter",
  },
  {
    pattern:
      /\b(?:(?:ba|z|da|k|fi)?sh|eval|source|python3?|node|perl|ruby)\s+(?:-c\s+)?(?:<\(|\$\()\s*(?:curl|wget)\b/,
    reason: "Runs code downloaded from the internet",
  },
  {
    pattern: new RegExp(
      String.raw`\bgit\b${ARGS}\bpush\b${ARGS}(?:\s--force\b|\s-[a-zA-Z]*f\b|\s\+\S|\s--delete\b|\s-d\b|\s--mirror\b|\s:\S)`,
    ),
    reason: "Rewrites or deletes history on the remote",
  },
  {
    pattern: new RegExp(
      String.raw`\bgit\b${ARGS}\breset\b${ARGS}\s--(?:hard|merge|keep)\b`,
    ),
    reason: "Discards uncommitted changes (git reset --hard)",
  },
  {
    pattern: new RegExp(
      String.raw`\bgit\b${ARGS}\bclean\b${ARGS}\s-[a-zA-Z]*f`,
    ),
    reason: "Deletes untracked files (git clean)",
  },
  {
    pattern: new RegExp(
      String.raw`\bgit\b${ARGS}\b(?:checkout|restore)\s+(?:--\s+)?\.(?:\s|$)`,
    ),
    reason: "Discards uncommitted changes",
  },
  {
    pattern: new RegExp(
      String.raw`\bgit\b${ARGS}\b(?:branch\s+(?:\S+\s+)*-D\b|stash\s+clear\b|filter-branch\b|filter-repo\b|reflog\s+expire\b|update-ref\s+-d\b|gc\s+${ARGS}--prune=now)`,
    ),
    reason: "Permanently deletes git history or branches",
  },
  {
    pattern: cmd(String.raw`(?:shutdown|reboot|halt|poweroff)\b`),
    reason: "Shuts down or restarts the computer",
  },
  {
    pattern: cmd(
      String.raw`systemctl\s+`,
      String.raw`(?:poweroff|reboot|halt|suspend|hibernate|stop|disable|mask|kill)\b`,
    ),
    reason: "Stops or disables system services",
  },
  {
    pattern: cmd(String.raw`(?:killall|pkill)\b`),
    reason: "Kills processes by name",
  },
  {
    pattern: cmd(String.raw`kill\b`, String.raw`${ARGS}\s-1${END}`),
    reason: "Kills every process",
  },
  {
    pattern: cmd(String.raw`crontab\b`, String.raw`(?!\s+-l\b)`),
    reason: "Changes scheduled jobs (crontab)",
  },
  {
    pattern: cmd(
      String.raw`launchctl\s+`,
      String.raw`(?!(?:list|print|help|version|blame)\b)`,
    ),
    reason: "Changes background services (launchctl)",
  },
  {
    pattern: cmd(String.raw`security\s+\w`),
    reason: "Uses the macOS keychain or security settings",
  },
  {
    pattern: cmd(
      String.raw`(?:csrutil|spctl|nvram|tccutil|dscl|sysadminctl|fdesetup|bless|pmset|scutil\s+--set|networksetup\s+-set)\b`,
    ),
    reason: "Changes macOS system or security settings",
  },
  {
    pattern: cmd(
      String.raw`defaults\s+`,
      String.raw`(?:write|delete)\s+(?:-g\b|NSGlobalDomain|\/Library|com\.apple\.)`,
    ),
    reason: "Changes macOS system preferences",
  },
  {
    pattern: new RegExp(
      String.raw`(?:>|\btee\b|\b(?:cp|mv|ln|install|rsync|sed\s+-i|perl\s+-p?i)\b)${ARGS}(?:\.(?:bash(?:rc|_profile|_login|_logout)|zsh(?:rc|env|profile|login|logout)|profile|zprofile|zlogin|cshrc|tcshrc|kshrc|inputrc|gitconfig)\b|\.ssh\/|\.config\/fish\/|\.gnupg\/)`,
    ),
    reason: "Changes shell startup files, SSH or git config",
  },
  {
    pattern:
      /(?:\.ssh\/(?:id_|[^\s/]*_(?:rsa|ed25519|ecdsa|dsa)\b)|\.aws\/credentials|\.netrc\b|\.git-credentials|\.docker\/config\.json|\.kube\/config|\.config\/gh\/hosts|\.gnupg\/|Library\/Keychains|\.codex\/auth\.json|\.claude\/\.credentials|\.pi\/agent\/auth\.json|\.ignite\/pi\/auth\.json)/,
    reason: "Reads credentials or private keys",
  },
  {
    pattern: new RegExp(
      String.raw`\b(?:env|printenv|export\s+-p|set)\b${ARGS}\|${ARGS}\b(?:curl|wget|nc|ncat|netcat|ssh|scp|sftp|ftp|telnet|socat)\b`,
    ),
    reason: "Sends environment variables over the network",
  },
  {
    pattern: new RegExp(
      String.raw`\b(?:curl|wget|nc|ncat|netcat|socat)\b${ARGS}(?:\$\{?\w*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE_KEY|CREDENTIALS?)\w*|@\S*(?:\.env|id_rsa|id_ed25519|credentials)|--upload-file\s+\S*\.env)`,
      "i",
    ),
    reason: "Sends secrets over the network",
  },
  {
    pattern:
      /\/dev\/(?:tcp|udp)\/|\b(?:nc|ncat|netcat)\b[^;&|\n]*\s-[a-zA-Z]*[ec]\b/,
    reason: "Opens a remote shell",
  },
];

/**
 * One command as the shell runs it: its words with quoting removed (quoted
 * `; & | < >` become spaces) and its file redirects.
 */
export type SimpleCommand = {
  words: string[];
  redirects: { operator: string; target: string }[];
};
/** Commands joined by `|`; a lone command is a pipeline of one. */
export type Pipeline = SimpleCommand[];
/** Splits a command line into pipelines, or null when it can't be parsed. */
export type ParseBash = (command: string) => Pipeline[] | null;

/**
 * Removes the quoting tricks that hide a command from a pattern: `r''m`,
 * `"rm"` and `\rm` all run rm.
 */
function unquote(command: string): string {
  return command.replace(/\\(?=[^\n])/g, "").replace(/["']/g, "");
}

const render = (pipeline: Pipeline) =>
  pipeline
    .map(({ words, redirects }) =>
      [...words, ...redirects.map((r) => `${r.operator} ${r.target}`)].join(
        " ",
      ),
    )
    .join(" | ");

/**
 * Why `command` needs approval under Auto, or null when it may run. With
 * `pipelines` (the parsed command) the rules check each pipeline, so quoted
 * text and heredocs aren't mistaken for commands; without, the raw text.
 */
export function dangerousCommand(
  command: string,
  pipelines?: Pipeline[] | null,
): string | null {
  const raw = unquote(command);
  const texts = pipelines ? pipelines.map(render) : [raw];
  const rule = DANGEROUS_COMMANDS.find(({ pattern, rawText }) =>
    (rawText ? [raw] : texts).some((text) => pattern.test(text)),
  );
  return rule?.reason ?? null;
}
