// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { logIfEndsRuns } from "./hostLog.ts";

afterEach(() => vi.restoreAllMocks());

const logged = () => {
  const write = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  return () => write.mock.calls.map((c) => String(c[0]));
};

it("logs which conversation a run-ending request was for, with the UTC time", () => {
  const lines = logged();
  logIfEndsRuns({ type: "abort", session: "s1" });
  logIfEndsRuns({ type: "close_session" });
  expect(lines()[0]).toMatch(
    /^pi-host: abort s1 at \d{4}-\d\d-\d\dT[\d:.]+Z \(\d+ms\)\n$/,
  );
  expect(lines()[1]).toMatch(
    /^pi-host: close_session the shown or folder's at /,
  );
});

it("leaves out requests that don't end a run, a queue edit but sending now included", () => {
  const lines = logged();
  logIfEndsRuns({ type: "open_session" });
  logIfEndsRuns({ type: "unqueue", action: "up" });
  logIfEndsRuns({ type: "unqueue", action: "now", session: "s1" });
  expect(lines()).toHaveLength(1);
  expect(lines()[0]).toMatch(/^pi-host: unqueue s1 at /);
});
