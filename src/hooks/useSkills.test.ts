import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostMessage } from "../../shared/hostProtocol";
import type { SkillCatalog, SkillEntry } from "../../shared/skills";
import type { HostClient } from "@/lib/piHost";
import { useSkills } from "./useSkills";

const releaseNotes: SkillEntry = {
  id: "release-notes",
  name: "release-notes",
  description: "Drafts release notes from recent commits.",
  enabled: true,
};

const CATALOG: SkillCatalog = {
  sources: [
    {
      id: "claude-code",
      app: "Claude Code",
      label: "Agent Skills",
      plugin: false,
      skills: [
        {
          name: "commit-messages",
          description: "Writes commit messages.",
          added: false,
        },
      ],
    },
  ],
};

/** A fake sidecar client answering each request with `answer` or `catalog`. */
function fakeHost(
  answer: (req: { type: string }) => Promise<unknown>,
  catalog: (req: { type: string }) => Promise<unknown> = async () => CATALOG,
) {
  const listeners = new Set<(m: HostMessage) => void>();
  const host = {
    request: vi.fn((req: { type: string }) =>
      req.type === "skills_catalog" ? catalog(req) : answer(req),
    ) as unknown as HostClient["request"],
    send: vi.fn(),
    subscribe: (cb: (m: HostMessage) => void) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    close: vi.fn(),
  } satisfies HostClient;
  return Object.assign(host, { listeners });
}

describe("useSkills", () => {
  it("does nothing without a sidecar", () => {
    const { result } = renderHook(() => useSkills(null, true));
    expect(result.current.skills).toBeNull();
  });

  it("does nothing while the dialog is closed", async () => {
    const host = fakeHost(async () => [releaseNotes]);
    const { result } = renderHook(() => useSkills(host, false));
    await new Promise((r) => setTimeout(r, 5));
    expect(result.current.skills).toBeNull();
    expect(host.request).not.toHaveBeenCalled();
  });

  it("loads the skills once the dialog opens", async () => {
    const host = fakeHost(async () => [releaseNotes]);
    const { result, rerender } = renderHook(
      ({ open }) => useSkills(host, open),
      {
        initialProps: { open: false },
      },
    );
    expect(result.current.skills).toBeNull();
    rerender({ open: true });
    await waitFor(() => expect(result.current.skills).toEqual([releaseNotes]));
  });

  it("reports a list it couldn't load", async () => {
    const host = fakeHost(async () => {
      throw new Error("skills folder isn't readable.");
    });
    const { result } = renderHook(() => useSkills(host, true));
    await waitFor(() =>
      expect(result.current.error).toBe("skills folder isn't readable."),
    );
  });

  it("sets enabled and shows the sidecar's answer", async () => {
    const host = fakeHost(async (req) =>
      req.type === "skills_list" ? [] : [releaseNotes],
    );
    const { result } = renderHook(() => useSkills(host, true));
    await waitFor(() => expect(result.current.skills).toEqual([]));
    await act(() => result.current.setEnabled("release-notes", false));
    expect(host.request).toHaveBeenCalledWith({
      type: "skills_set_enabled",
      skill: "release-notes",
      enabled: false,
    });
    expect(result.current.skills).toEqual([releaseNotes]);
    expect(result.current.error).toBeNull();
  });

  it("removes a skill and shows a failed action until the next succeeds", async () => {
    const remove = vi.fn(async () => {
      throw new Error("Can't remove a built-in skill.");
    });
    const host = fakeHost(async (req) =>
      req.type === "skills_remove" ? remove() : [releaseNotes],
    );
    const { result } = renderHook(() => useSkills(host, true));
    await act(() => result.current.remove("release-notes"));
    expect(result.current.error).toBe("Can't remove a built-in skill.");
    await act(() => result.current.importSkills("claude-code", ["a"]));
    expect(host.request).toHaveBeenCalledWith({
      type: "skills_import",
      source: "claude-code",
      names: ["a"],
    });
    expect(result.current.error).toBeNull();
  });

  it("can't change anything without a sidecar", async () => {
    const { result } = renderHook(() => useSkills(null, true));
    await act(() => result.current.setEnabled("x", false));
    expect(result.current.error).toBe("The agent host isn't running.");
  });

  describe("catalog", () => {
    const catalogCalls = (host: HostClient) =>
      vi
        .mocked(host.request)
        .mock.calls.map(([r]) => r)
        .filter((r) => r.type === "skills_catalog");

    it("loads what can be imported once the skills list is known", async () => {
      const host = fakeHost(async () => [releaseNotes]);
      const { result } = renderHook(() => useSkills(host, true));
      await waitFor(() => expect(result.current.catalog).toEqual(CATALOG));
      expect(catalogCalls(host)).toEqual([{ type: "skills_catalog" }]);
    });

    it("reloads when the saved skills change, not just any render", async () => {
      const host = fakeHost(async () => [releaseNotes]);
      const { result, rerender } = renderHook(
        ({ open }) => useSkills(host, open),
        {
          initialProps: { open: true },
        },
      );
      await waitFor(() => expect(result.current.catalog).toEqual(CATALOG));
      expect(catalogCalls(host)).toHaveLength(1);

      rerender({ open: true });
      expect(catalogCalls(host)).toHaveLength(1);
    });

    it("reloads when a plugin gains a skill under the same id", async () => {
      const kit = (names: string[]): SkillEntry => ({
        id: "plugins/kit",
        name: "kit",
        description: "",
        enabled: true,
        skills: names.map((name) => ({ name, description: "" })),
      });
      const host = fakeHost(async (req) =>
        req.type === "skills_list" ? [kit(["a"])] : [kit(["a", "b"])],
      );
      const { result } = renderHook(() => useSkills(host, true));
      await waitFor(() => expect(catalogCalls(host)).toHaveLength(1));
      await act(() => result.current.importSkills("/kit", ["b"]));
      await waitFor(() => expect(catalogCalls(host)).toHaveLength(2));
    });

    it("does not fetch the catalog while closed", async () => {
      const host = fakeHost(async () => [releaseNotes]);
      renderHook(() => useSkills(host, false));
      await new Promise((r) => setTimeout(r, 5));
      expect(catalogCalls(host)).toHaveLength(0);
    });

    it("reports a catalog it couldn't load", async () => {
      const host = fakeHost(
        async () => [releaseNotes],
        async () => {
          throw new Error("unreadable");
        },
      );
      const { result } = renderHook(() => useSkills(host, true));
      await waitFor(() => expect(result.current.error).toBe("unreadable"));
    });
  });
});
