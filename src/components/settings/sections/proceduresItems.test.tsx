import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Procedure } from "../../../../shared/procedures";
import { proceduresItems } from "./proceduresItems";

const ask = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask }));

const proc = (over: Partial<Procedure> = {}): Procedure => ({
  id: 1,
  title: "Running the sidecar's tests",
  steps: ["Install packages", "Run vitest"],
  folder: "/p/tempo",
  at: Date.now() - 2 * 3_600_000,
  from: { conversation: "c1", folder: "/p/tempo", title: "Sentry triage" },
  ...over,
});

const hook = (over: object) => ({
  procedures: null,
  error: null,
  remove: vi.fn(),
  ...over,
});

const items = (h: ReturnType<typeof hook>, open = vi.fn()) =>
  proceduresItems({ procedures: h as never, onOpenConversation: open });

describe("proceduresItems", () => {
  it("shows an error, nothing while loading, and an empty state", () => {
    expect(items(hook({ error: "unreadable" }))[0]).toMatchObject({
      title: "Something went wrong",
      description: "unreadable",
    });
    expect(items(hook({}))).toEqual([]);
    expect(items(hook({ procedures: [] }))[0].title).toBe("No procedures yet");
  });

  it("lists them in the order the sidecar gives, newest first", () => {
    const list = items(
      hook({
        procedures: [
          proc({ id: 3, at: 3 }),
          proc({ id: 2, at: 2 }),
          proc({ id: 1, at: 1 }),
        ],
      }),
    );
    expect(list.map((i) => i.id)).toEqual([
      "procedure-3",
      "procedure-2",
      "procedure-1",
    ]);
  });

  it("shows the folder, the numbered steps and where it was learned", () => {
    const open = vi.fn();
    const [item] = items(hook({ procedures: [proc()] }), open);
    expect(item.title).toBe("Running the sidecar's tests");
    expect(item.keywords).toContain("tempo Install packages Run vitest");
    render(
      <>
        {item.hint}
        {item.control}
      </>,
    );
    expect(screen.getByText("tempo")).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((l) => l.textContent)).toEqual([
      "Install packages",
      "Run vitest",
    ]);
    const when = screen.getByText("2 hours ago");
    expect(when.getAttribute("title")).toContain("2026");
    expect(when.parentElement?.textContent).toBe("Learned · 2 hours ago");
    fireEvent.click(screen.getByRole("button", { name: "Sentry triage" }));
    expect(open).toHaveBeenCalledWith("/p/tempo", "c1");
  });

  it("shows only the folder when there are no steps, and no link without a conversation", () => {
    const [item] = items(
      hook({ procedures: [proc({ steps: [], from: undefined })] }),
    );
    render(
      <>
        {item.hint}
        {item.control}
      </>,
    );
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sentry triage" })).toBeNull();
  });

  it.each([
    [false, 0],
    [true, 1],
  ])("removes a procedure only once confirmed (%s)", async (ok, calls) => {
    ask.mockResolvedValueOnce(ok);
    const h = hook({ procedures: [proc({ id: 7 })] });
    render(<>{items(h)[0].control}</>);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove this procedure" }),
    );
    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(ask.mock.lastCall?.[0]).toMatch(/^Remove this procedure\?/);
    await waitFor(() => expect(h.remove).toHaveBeenCalledTimes(calls));
    if (calls) expect(h.remove).toHaveBeenCalledWith(7);
  });
});
