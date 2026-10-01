/** The user's terminals (a real shell in a PTY), which the folder's agents can read. */

/** The tool an agent reads the folder's terminals with. */
export const TERMINAL_READ_TOOL = "terminal_read";

/** One of a folder's terminals. */
export type TerminalInfo = {
  terminal: string;
  cwd: string;
  running: boolean;
  exitCode?: number;
};

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
  | { id: number; type: "terminal_list"; cwd: string }
  /** The screen and scrollback as escape codes, for a new view to write before live data. */
  | { id: number; type: "terminal_snapshot"; terminal: string };

export type TerminalResponses = {
  terminal_open: TerminalInfo;
  terminal_input: undefined;
  terminal_resize: undefined;
  terminal_close: undefined;
  terminal_list: TerminalInfo[];
  terminal_snapshot: string;
};

export type TerminalMessage =
  | { type: "terminal_data"; terminal: string; data: string }
  | { type: "terminal_exit"; terminal: string; exitCode: number };
