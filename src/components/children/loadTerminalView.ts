/** The terminal view's code (xterm with it), loaded on first use; a starting terminal's tab loads it while it waits. */
export const loadTerminalView = () =>
  import("@/components/children/TerminalView");
