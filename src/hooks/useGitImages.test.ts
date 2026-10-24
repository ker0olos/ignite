import { renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { GitImages } from "../../shared/git";
import type { DiffTab } from "@/lib/diffTabs";
import type { HostClient } from "@/lib/piHost";
import { useGitImages } from "./useGitImages";

const tab: DiffTab = { repo: "/r", range: "HEAD", path: "a.png", status: "A" };
const png = (data: string) => ({
  type: "image" as const,
  data,
  mimeType: "image/png",
});
const hostWith = (answer: Promise<GitImages>) =>
  ({ request: vi.fn(() => answer) }) as unknown as HostClient;

const shown = async (answer: Promise<GitImages>, status = tab.status) => {
  const host = hostWith(answer);
  const { result } = renderHook(() => useGitImages({ ...tab, status }, host));
  await waitFor(() => expect(result.current).not.toBe(null));
  return result.current;
};

it("compares an image's two versions, or a new or deleted one with itself", async () => {
  const [a, b] = [png("a"), png("b")];
  expect(await shown(Promise.resolve({ before: a, after: b }), "M")).toEqual({
    before: a,
    after: b,
  });
  expect(await shown(Promise.resolve({ after: b }))).toEqual({
    before: b,
    after: b,
  });
  expect(await shown(Promise.resolve({ before: a }), "D")).toEqual({
    before: a,
    after: a,
  });
});

it("says why when there's nothing to show", async () => {
  expect(await shown(Promise.resolve({}))).toEqual({
    message: "Too large to show.",
  });
  expect(await shown(Promise.resolve({ before: png("a") }), "M")).toEqual({
    message: "Too large to show.",
  });
  expect(await shown(Promise.reject(new Error("nope")))).toEqual({
    message: "nope",
  });
});

it("waits for the host", () => {
  const { result } = renderHook(() => useGitImages(tab, null));
  expect(result.current).toBe(null);
});
