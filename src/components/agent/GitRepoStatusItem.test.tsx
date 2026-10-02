import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { GitRepoStatus } from "../../../shared/git";
import type { HostClient } from "@/lib/piHost";
import { GitRepoStatusItem } from "./GitRepoStatusItem";

const status: GitRepoStatus = {
  repo: "/w/motr-expo",
  name: "lead-led/motr-expo",
  branch: "feat/server",
  changed: 1,
  unpushed: 1,
};

it("opens the repository's files and commits without submitting the composer", async () => {
  const request = vi.fn().mockResolvedValue({
    files: [{ path: "lib/server.ts", status: "M", added: 3, removed: 1 }],
    commits: [{ hash: "6e3011a", subject: "feat: connect" }],
  });
  const submit = vi.fn((e: Event) => e.preventDefault());
  render(
    <form onSubmit={(e) => submit(e.nativeEvent)}>
      <GitRepoStatusItem
        host={{ request } as unknown as HostClient}
        status={status}
      />
    </form>,
  );
  fireEvent.click(screen.getByText("motr-expo"));
  expect(await screen.findByText("server.ts")).toBeTruthy();
  expect(screen.getByText("feat: connect")).toBeTruthy();
  expect(screen.getByText("No pull request yet")).toBeTruthy();
  expect(request).toHaveBeenCalledWith({
    type: "git_repo_details",
    repo: "/w/motr-expo",
  });
  expect(submit).not.toHaveBeenCalled();
});
