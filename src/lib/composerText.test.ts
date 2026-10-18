import { describe, expect, it, vi } from "vitest";
import { addTextTarget, appendToComposer } from "@/lib/composerText";

describe("composer text", () => {
  it("adds text to the conversation's composer when it shows", () => {
    const append = vi.fn();
    const other = vi.fn();
    const remove = addTextTarget({ session: "s1", append });
    const removeOther = addTextTarget({ session: "s2", append: other });
    expect(appendToComposer("s1", "hello")).toBe(true);
    expect(append).toHaveBeenCalledWith("hello");
    expect(other).not.toHaveBeenCalled();
    remove();
    removeOther();
  });

  it("keeps text for a composer not showing until it does, then delivers it once", () => {
    expect(appendToComposer("s3", "one")).toBe(false);
    expect(appendToComposer("s3", "two")).toBe(false);
    const append = vi.fn();
    const remove = addTextTarget({ session: "s3", append });
    expect(append.mock.calls).toEqual([["one"], ["two"]]);
    remove();

    const again = vi.fn();
    addTextTarget({ session: "s3", append: again })();
    expect(again).not.toHaveBeenCalled();
  });

  it("stops adding to a composer once removed", () => {
    const append = vi.fn();
    addTextTarget({ session: null, append })();
    expect(appendToComposer(null, "later")).toBe(false);
    expect(append).not.toHaveBeenCalled();
  });
});
