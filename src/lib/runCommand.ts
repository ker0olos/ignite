const SHELLS = new Set(["bash", "sh", "zsh", "shell"]);

/** Whether a code block is one the user's terminal runs as is: tagged with a shell language. */
export function isShellBlock(lang: string | undefined): boolean {
  return lang !== undefined && SHELLS.has(lang.toLowerCase());
}

/**
 * A code block as keystrokes, in braces so the shell reads all of it before
 * running any: a prompt in it (a sign-in, a password) then reads the user's typing.
 */
export function terminalInput(code: string): string {
  return `{\r${code.trimEnd().replace(/\r?\n/g, "\r")}\r}\r`;
}
