const SHELLS = new Set(["bash", "sh", "zsh", "shell"]);

/** Whether a code block is one the user's terminal runs as is: a shell language, or one untagged line. */
export function isShellBlock(lang: string | undefined, code: string): boolean {
  // Agents often leave a command's fence untagged; output rarely fits on one line.
  if (lang === undefined)
    return code.trim() !== "" && !code.trim().includes("\n");
  return SHELLS.has(lang.toLowerCase());
}

/**
 * A code block as keystrokes, in braces so the shell reads all of it before
 * running any: a prompt in it (a sign-in, a password) then reads the user's typing.
 */
export function terminalInput(code: string): string {
  return `{\r${code.trimEnd().replace(/\r?\n/g, "\r")}\r}\r`;
}
