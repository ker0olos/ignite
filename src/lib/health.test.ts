import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, it } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import { reportHealthy } from "./health";

describe("reportHealthy", () => {
  it("writes the launcher's health file", async () => {
    const { writes } = fakeFs({});
    await reportHealthy("/home/.ignite/launch/healthy");
    expect(writes).toEqual(["ok"]);
  });

  it("does nothing without a launcher", async () => {
    const { calls } = fakeFs({});
    await reportHealthy();
    expect(calls).toEqual([]);
  });

  it("never throws when the write fails", async () => {
    mockIPC(() => {
      throw new Error("denied");
    });
    await expect(reportHealthy("/nope")).resolves.toBeUndefined();
  });
});
