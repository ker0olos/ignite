/** The user's terminals (a real shell in a PTY), which the folder's agents can read. */

/** The tool an agent reads the folder's terminals with. */
export const TERMINAL_READ_TOOL = "terminal_read";

/** One of a folder's terminals. */
export type TerminalInfo = {
  terminal: string;
  /** What users and agents call it: its place among the folder's terminals, oldest first (t1, t2…). */
  name: string;
  cwd: string;
  running: boolean;
  exitCode?: number;
  /** The command line running in it, while one is (not at the shell's prompt). */
  command?: string;
};

/** A terminal's screen and scrollback as escape codes; `exitCode` once its shell has exited. */
export type TerminalSnapshot = { screen: string; exitCode?: number };

export type TerminalRequest =
  /** Starts the user's login shell in `cwd` (the folder, not an agent's worktree). */
  | {
      id: number;
      type: "terminal_open";
      cwd: string;
      cols: number;
      rows: number;
    }
  /** Keystrokes or pasted text, as xterm's onData gives them. */
  | { id: number; type: "terminal_input"; terminal: string; data: string }
  | {
      id: number;
      type: "terminal_resize";
      terminal: string;
      cols: number;
      rows: number;
    }
  /** Ends the shell and forgets the terminal. */
  | { id: number; type: "terminal_close"; terminal: string }
  /** Ends the shell only if no command runs in it (its tab closed); true if it did. */
  | { id: number; type: "terminal_close_idle"; terminal: string }
  | { id: number; type: "terminal_list"; cwd: string }
  /** The screen and scrollback as escape codes, for a new view to write before live data. */
  | { id: number; type: "terminal_snapshot"; terminal: string };

export type TerminalResponses = {
  terminal_open: TerminalInfo;
  terminal_input: undefined;
  terminal_resize: undefined;
  terminal_close: undefined;
  terminal_close_idle: boolean;
  terminal_list: TerminalInfo[];
  terminal_snapshot: TerminalSnapshot;
};

export type TerminalMessage =
  | { type: "terminal_data"; terminal: string; data: string }
  | { type: "terminal_exit"; terminal: string; exitCode: number }
  | { type: "terminal_command"; terminal: string; command?: string };
