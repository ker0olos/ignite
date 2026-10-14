import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitRepoStatus } from "../../shared/git";
import { useGitRepoDetails } from "@/hooks/useGitRepoDetails";
import type { HostClient } from "@/lib/piHost";

const ask = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask }));

const status: GitRepoStatus = {
  repo: "/r",
  name: "r",
  changed: 1,
  unpushed: 0,
};
const file = { path: "src/a.txt", status: "M", added: 1, removed: 1 };

function fakeHost(discard: () => Promise<unknown>) {
  const request = vi.fn((r: { type: string }) =>
    r.type === "git_discard"
      ? discard()
      : Promise.resolve({ files: [file], commits: [] }),
  );
  return { host: { request } as unknown as HostClient, request };
}

async function render(discard: () => Promise<unknown>) {
  const { host, request } = fakeHost(discard);
  const hook = renderHook(() => useGitRepoDetails(host, status, true));
  await waitFor(() => expect(hook.result.current.details).not.toBeNull());
  return { result: hook.result, request };
}

beforeEach(() => ask.mockReset());

describe("useGitRepoDetails discard", () => {
  it("asks first, then drops the file and reads the details again", async () => {
    ask.mockResolvedValue(true);
    const { result, request } = await render(
      () => new Promise((r) => setTimeout(r, 10)),
    );
    await act(() => result.current.discard("src/a.txt"));
    expect(ask).toHaveBeenCalledWith(
      "Are you sure you want to discard changes in 'a.txt'?",
      expect.objectContaining({ okLabel: "Discard File" }),
    );
    expect(request).toHaveBeenCalledWith({
      type: "git_discard",
      repo: "/r",
      path: "src/a.txt",
    });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  });

  it("removes the file from the list without waiting for the next read", async () => {
    ask.mockResolvedValue(true);
    const { result, request } = await render(() => Promise.resolve());
    request.mockImplementation((r: { type: string }) =>
      r.type === "git_discard" ? Promise.resolve() : new Promise(() => {}),
    );
    await act(() => result.current.discard("src/a.txt"));
    expect(result.current.details?.files).toEqual([]);
  });

  it("does nothing when the dialog is cancelled", async () => {
    ask.mockResolvedValue(false);
    const { result, request } = await render(() => Promise.resolve());
    await act(() => result.current.discard("src/a.txt"));
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.details?.files).toEqual([file]);
  });

  it("keeps the file and shows the error when discarding fails", async () => {
    ask.mockResolvedValue(true);
    const { result, request } = await render(() =>
      Promise.reject(new Error("index.lock exists")),
    );
    await act(() => result.current.discard("src/a.txt"));
    expect(result.current.error).toBe("index.lock exists");
    expect(result.current.details?.files).toEqual([file]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
