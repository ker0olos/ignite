import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UpdateState } from "@/lib/about";
import { aboutItems } from "./aboutItems";

const about = (over: Partial<Parameters<typeof aboutItems>[0]["about"]>) => ({
  version: null,
  error: null,
  update: "idle" as UpdateState,
  check: vi.fn(),
  ...over,
});
const disabled = (item: { control?: unknown }) =>
  (item.control as ReactElement<{ disabled: boolean }>).props.disabled;

describe("aboutItems", () => {
  it("shows the commit once it's known, or why it isn't", () => {
    const [loading] = aboutItems({ about: about({}) });
    expect(loading).toMatchObject({
      title: "Version",
      description: "Loading…",
    });

    const version = {
      sha: "a1b2c3d4",
      date: "2026-09-28T09:00:00Z",
      subject: "Hi",
    };
    const [known] = aboutItems({ about: about({ version }) });
    expect(known.title).toBe("Hi");
    expect(known.description).toMatch(/^a1b2c3d · /);
    expect(known.keywords).toContain("a1b2c3d4");

    const [failed] = aboutItems({ about: about({ error: "no git" }) });
    expect(failed.description).toBe("no git");
  });

  it("checks from the button, which alone shows the progress", () => {
    const check = vi.fn();
    const [, idle] = aboutItems({ about: about({ check }) });
    expect(idle.description).toMatch(/latest version/);
    render(<>{idle.control}</>);
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(check).toHaveBeenCalledOnce();
    cleanup();

    const [, checking] = aboutItems({ about: about({ update: "checking" }) });
    expect(checking.description).toBeUndefined();
    expect(disabled(checking)).toBe(true);
    const { container } = render(<>{checking.control}</>);
    expect(screen.getByRole("button").textContent).toBe("Checking for updates");
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    cleanup();

    const [, done] = aboutItems({ about: about({ update: "up-to-date" }) });
    expect(done.description).toBeUndefined();
    render(<>{done.control}</>);
    expect(screen.getByRole("button", { name: "Up to date" })).toBeTruthy();
  });
});
