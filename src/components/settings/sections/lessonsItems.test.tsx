import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { lessonsItems } from "./lessonsItems";

const ask = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask }));

const lessons = (over: object) => ({
  lessons: null,
  error: null,
  remove: vi.fn(),
  ...over,
});

describe("lessonsItems", () => {
  it("shows an error, or a hint when there are none", () => {
    expect(
      lessonsItems({ lessons: lessons({ error: "unreadable" }) })[0],
    ).toMatchObject({
      title: "Something went wrong",
      description: "unreadable",
    });
    expect(lessonsItems({ lessons: lessons({ lessons: [] }) })[0].title).toBe(
      "No lessons yet",
    );
    expect(lessonsItems({ lessons: lessons({}) })).toEqual([]);
  });

  it("lists each lesson with where it applies and how often it came up", () => {
    const items = lessonsItems({
      lessons: lessons({
        lessons: [
          { id: "a", text: "Run tests", level: "system_prompt", hits: 0 },
          {
            id: "b",
            text: "No force-push",
            level: "tool_call",
            tool: "git",
            match: "--force",
            folder: "/p/tempo",
            hits: 2,
          },
          {
            id: "c",
            text: "Pull first",
            level: "tool_call",
            tool: "git",
            hits: 0,
          },
          {
            id: "d",
            text: "No -f either",
            level: "tool_call",
            tool: "git",
            match: "push.*-f",
            regex: true,
            hits: 0,
          },
        ],
      }),
    });
    expect(items.map((i) => i.title)).toEqual([
      "Run tests",
      "No force-push",
      "Pull first",
      "No -f either",
    ]);
    expect(items[1].keywords).toContain("tempo git --force");
    const { container } = render(<>{items.map((i) => i.hint)}</>);
    expect(container.textContent).toBe(
      "Every folderEvery conversation" +
        "tempoBlocksgitwith“--force”came up 2×" +
        "Every folderBeforegit" +
        "Every folderBlocksgitmatching/push.*-f/",
    );
  });

  it.each([
    [false, 0],
    [true, 1],
  ])("removes a lesson only once the user confirms (%s)", async (ok, calls) => {
    ask.mockResolvedValueOnce(ok);
    const list = lessons({
      lessons: [
        { id: "a", text: "Run tests", level: "system_prompt", hits: 0 },
      ],
    });
    render(<>{lessonsItems({ lessons: list })[0].control}</>);
    fireEvent.click(screen.getByRole("button", { name: "Remove this lesson" }));
    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(ask.mock.lastCall?.[0]).toMatch(/^Remove this lesson\?/);
    await waitFor(() => expect(list.remove).toHaveBeenCalledTimes(calls));
  });
});
