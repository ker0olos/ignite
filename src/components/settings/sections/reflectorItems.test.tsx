import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Reflection } from "../../../../shared/reflector";

const confirmNative = vi.fn(async () => true);
vi.mock("@/lib/lifecycle", () => ({ confirmNative }));

const { reflectorItems } = await import("./reflectorItems");

const point = (over: Partial<Reflection> = {}): Reflection => ({
  id: "a",
  text: "Keep reports short",
  entry: "asking",
  taught: "note",
  at: new Date(2026, 9, 22, 12).getTime(),
  ...over,
});

const hook = (over: object) => ({
  reflections: null,
  error: null,
  remove: vi.fn(),
  edit: vi.fn(),
  ...over,
});

const row = (r: ReturnType<typeof hook>, open = vi.fn()) => {
  const [item] = reflectorItems({
    reflector: r as never,
    onOpenConversation: open,
  });
  render(
    <>
      {item.titleView}
      {item.hint}
      {item.control}
    </>,
  );
  return item;
};

describe("reflectorItems", () => {
  it("shows an error, nothing while loading, and an empty state", () => {
    expect(
      reflectorItems({
        reflector: hook({ error: "unreadable" }) as never,
        onOpenConversation: vi.fn(),
      })[0],
    ).toMatchObject({
      title: "Something went wrong",
      description: "unreadable",
    });
    expect(
      reflectorItems({
        reflector: hook({}) as never,
        onOpenConversation: vi.fn(),
      }),
    ).toEqual([]);
    expect(
      reflectorItems({
        reflector: hook({ reflections: [] }) as never,
        onOpenConversation: vi.fn(),
      })[0],
    ).toMatchObject({ title: "Nothing learned yet" });
  });

  it("lists the newest point first", () => {
    const items = reflectorItems({
      reflector: hook({
        reflections: [
          point({ id: "old", at: 1 }),
          point({ id: "new", at: 3 }),
          point({ id: "mid", at: 2 }),
        ],
      }) as never,
      onOpenConversation: vi.fn(),
    });
    expect(items.map((i) => i.id)).toEqual([
      "reflection-new",
      "reflection-mid",
      "reflection-old",
    ]);
  });

  it("shows where the point goes and where it came from", () => {
    const open = vi.fn();
    const from = { conversation: "c1", folder: "/f", title: "Sentry triage" };
    const item = row(
      hook({ reflections: [point({ at: Date.now() - 2 * 3_600_000, from })] }),
      open,
    );
    expect(item.keywords).toContain("Asking");
    expect(screen.getByText("Keep reports short")).toBeTruthy();
    expect(screen.getByText("Asking")).toBeTruthy();
    expect(screen.getByText("Beside ask_user's instructions")).toBeTruthy();
    const when = screen.getByText("2 hours ago");
    expect(when.getAttribute("title")).toContain("2026");
    expect(when.parentElement?.textContent).toBe(
      "Note on an answer · 2 hours ago",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sentry triage" }));
    expect(open).toHaveBeenCalledWith("/f", "c1");
  });

  it("shows when the point applies and the words that taught it", () => {
    const item = row(
      hook({
        reflections: [
          point({ when: "reporting a review", evidence: "too long" }),
        ],
      }),
    );
    expect(screen.getByText("When reporting a review")).toBeTruthy();
    expect(screen.getByText("“too long”")).toBeTruthy();
    expect(item.keywords).toContain("reporting a review");
  });

  it("names an edit without a conversation link", () => {
    row(hook({ reflections: [point({ taught: "edit", at: Date.now() })] }));
    expect(screen.getByText(/Your edit/).textContent).toBe(
      "Your edit · just now",
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Keep reports short",
      "",
    ]);
  });

  it("edits in place: Enter saves a change, blur too, Esc cancels", () => {
    const r = hook({ reflections: [point()] });
    row(r);
    fireEvent.click(screen.getByText("Keep reports short"));
    let box = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(box.maxLength).toBe(400);
    fireEvent.change(box, { target: { value: "Be terse" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(r.edit).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(r.edit).toHaveBeenCalledWith("a", "Be terse");

    fireEvent.click(screen.getByText("Keep reports short"));
    box = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "Other" } });
    fireEvent.blur(box);
    expect(r.edit).toHaveBeenLastCalledWith("a", "Other");

    fireEvent.click(screen.getByText("Keep reports short"));
    fireEvent.blur(screen.getByRole("textbox"));
    expect(r.edit).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText("Keep reports short"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(r.edit).toHaveBeenCalledTimes(2);
  });

  it("puts the point back when its text is emptied, and keys its row by id", () => {
    const r = hook({ reflections: [point()] });
    const item = row(r);
    expect(item.id).toBe("reflection-a");
    fireEvent.click(screen.getByText("Keep reports short"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  " } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(r.edit).not.toHaveBeenCalled();
    expect(screen.getByText("Keep reports short")).toBeTruthy();
  });

  it("removes a point after confirming", async () => {
    const r = hook({ reflections: [point()] });
    row(r);
    fireEvent.click(screen.getByLabelText("Remove this point"));
    await vi.waitFor(() => expect(r.remove).toHaveBeenCalledWith("a"));
    expect(confirmNative).toHaveBeenCalledWith(
      expect.stringContaining("may work the old way again"),
      "Remove",
    );
  });
});
