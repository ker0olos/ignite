import { describe, expect, it, vi } from "vitest";
import {
  addImageTarget,
  currentImageTarget,
  subscribeImageTargets,
} from "@/lib/imageTarget";

describe("imageTarget", () => {
  it("uses the newest target, falls back as they go, and tells listeners", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeImageTargets(listener);
    expect(currentImageTarget()).toBeNull();

    const conversation = { label: "Add to conversation", add: vi.fn() };
    const sheet = { label: "Add to task", add: vi.fn() };
    const dropConversation = addImageTarget(conversation);
    const dropSheet = addImageTarget(sheet);
    expect(currentImageTarget()).toBe(sheet);

    dropSheet();
    expect(currentImageTarget()).toBe(conversation);
    dropConversation();
    expect(currentImageTarget()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    addImageTarget(conversation)();
    expect(listener).toHaveBeenCalledTimes(4);
  });
});
