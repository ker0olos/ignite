import { describe, expect, it, vi } from "vitest";
import {
  brandFor,
  brandSlug,
  brandsLoaded,
  loadBrands,
  onBrandsLoaded,
} from "./brandMarks";

const slugs = new Set(["clickup", "googledrive", "brave", "ram", "local"]);
const isSlug = (s: string) => slugs.has(s);

describe("brandSlug", () => {
  it("runs the name's words together, leaving out filler", () => {
    expect(brandSlug("clickup", isSlug)).toBe("clickup");
    expect(brandSlug("mcp-server-ClickUp", isSlug)).toBe("clickup");
    expect(brandSlug("google_drive", isSlug)).toBe("googledrive");
    expect(brandSlug("googleDriveMcp", isSlug)).toBe("googledrive");
    expect(brandSlug("brave-search", isSlug)).toBe("brave");
  });

  it("matches only the whole name, and never generic ones", () => {
    expect(brandSlug("ram-monitor", isSlug)).toBeUndefined();
    expect(brandSlug("local", isSlug)).toBeUndefined();
    expect(brandSlug("mcp", isSlug)).toBeUndefined();
  });
});

describe("loadBrands", () => {
  it("tries again after a failed load", async () => {
    vi.resetModules();
    vi.doMock("simple-icons/icons.json", () => {
      throw new Error("chunk failed");
    });
    const fresh = await import("./brandMarks");
    await expect(fresh.loadBrands()).rejects.toThrow();
    vi.doUnmock("simple-icons/icons.json");
    await fresh.loadBrands();
    expect(fresh.brandsLoaded()).toBe(true);
  });
});

describe("brandFor", () => {
  it("starts loading on first use, then finds the brand and tells subscribers", async () => {
    const loaded = vi.fn();
    const off = onBrandsLoaded(loaded);
    expect(brandFor("clickup")).toBeUndefined();
    await loadBrands();
    expect(brandsLoaded()).toBe(true);
    expect(loaded).toHaveBeenCalledOnce();
    expect(brandFor("clickup-mcp")).toMatchObject({
      title: "ClickUp",
      hex: expect.stringMatching(/^[0-9A-F]{6}$/),
      path: expect.stringMatching(/^m/i),
    });
    expect(brandFor("everything-here")).toBeUndefined();
    off();
  });
});
