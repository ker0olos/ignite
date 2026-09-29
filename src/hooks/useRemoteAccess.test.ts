import { describe, expect, it, vi } from "vitest";
import { answer } from "./useRemoteAccess";

const ask = (cmd: string, args: unknown = {}) =>
  ({ type: "remote_invoke", id: 3, cmd, args }) as const;

describe("answer", () => {
  it("runs an allowed call, with bytes both ways", async () => {
    const run = vi.fn(async () => new Uint8Array([1, 2]).buffer);
    const result = await answer(
      ask("plugin:fs|write_text_file", { $bytes: btoa("hi") }),
      run as never,
    );
    expect(run).toHaveBeenCalledWith(
      "plugin:fs|write_text_file",
      new Uint8Array([104, 105]),
      undefined,
    );
    expect(result).toEqual({
      type: "remote_invoke_result",
      id: 3,
      ok: true,
      data: { $bytes: btoa("\x01\x02") },
    });
  });

  it("refuses calls browsers may not make, and reports failures", async () => {
    const run = vi.fn(async () => {
      throw new Error("forbidden path");
    });
    expect(await answer(ask("plugin:shell|spawn"), run as never)).toMatchObject(
      {
        ok: false,
        error: expect.stringContaining("isn't allowed"),
      },
    );
    expect(run).not.toHaveBeenCalled();
    expect(
      await answer(ask("plugin:fs|read_file"), run as never),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("forbidden path"),
    });
  });
});
