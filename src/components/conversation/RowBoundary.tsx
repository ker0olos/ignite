import { Component, type ReactNode } from "react";

/**
 * Keeps one conversation row that fails to draw from blanking the whole
 * window. Tries again when `resetOn` changes (the row streamed more).
 */
export class RowBoundary extends Component<
  { resetOn: unknown; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("A conversation row failed to draw:", error);
  }

  componentDidUpdate(previous: { resetOn: unknown }) {
    if (this.state.failed && previous.resetOn !== this.props.resetOn) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p className="text-[13px] text-destructive">
        This part of the conversation couldn't be shown.
      </p>
    );
  }
}
