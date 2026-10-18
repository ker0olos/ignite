import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConversationPane } from "./ConversationPane";
import type { Editor } from "@/components/conversation/shared";
import type { CodeThemes } from "@/lib/codeThemes";
import { EMPTY } from "@/lib/transcript";

const observed: Element[] = [];

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(el: Element) {
        observed.push(el);
      }
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(900);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
});

afterEach(() => {
  observed.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("follows the bottom from its first commit, with its scroll element attached", () => {
  const { container } = render(
    <ConversationPane
      transcript={EMPTY}
      session="s1"
      folder="/f"
      shown
      send={() => {}}
      skipWait={async () => true}
      onApprove={() => {}}
      waitingOnFork={false}
      waiting={[]}
      askingStep={0}
      editor={{} as Editor}
      codeThemes={{} as CodeThemes}
      showThinking={false}
      stickyUserMessages={false}
    />,
  );
  const main = container.querySelector("main")!;
  expect(observed).toContain(main);
  expect(main.scrollTop).toBe(900);
});
