import { describe, expect, it } from "vitest";
import {
  IMAGE_TOOL,
  type AssistantMessage,
  type ImageContent,
} from "../../shared/agentTypes";
import { cardGeneration, editOriginals, readGeneration } from "./media";
import type { Item, ToolRun } from "./transcript";

describe("readGeneration", () => {
  it("is null without a model or a prompt", () => {
    expect(readGeneration({})).toBeNull();
    expect(readGeneration({ model: "m" })).toBeNull();
    expect(readGeneration({ prompt: "p" })).toBeNull();
    expect(readGeneration({ model: "", prompt: "p" })).toBeNull();
    expect(readGeneration({ model: 1, prompt: "p" })).toBeNull();
  });

  it("reads the minimum", () => {
    expect(readGeneration({ model: "m", prompt: "p" })).toEqual({
      model: "m",
      prompt: "p",
    });
  });

  it("reads every field", () => {
    expect(
      readGeneration({
        model: "m",
        prompt: "p",
        avoid: "text",
        size: "1536x864",
        editOf: "/tmp/a.png",
      }),
    ).toEqual({
      model: "m",
      prompt: "p",
      avoid: "text",
      size: "1536x864",
      editOf: "/tmp/a.png",
    });
  });

  it("drops fields of the wrong type", () => {
    expect(
      readGeneration({ model: "m", prompt: "p", avoid: 2, size: 3 }),
    ).toEqual({ model: "m", prompt: "p" });
  });
});

const call = (id: string, name: string, args: Record<string, unknown>) =>
  ({ type: "toolCall", id, name, arguments: args }) as const;
const generated = { path: "/tmp/a.png", model: "m", prompt: "p" };

describe("cardGeneration", () => {
  it("reads a show_image call with a model and prompt", () => {
    expect(
      cardGeneration(call("1", IMAGE_TOOL, generated), { status: "done" }),
    ).toEqual({ model: "m", prompt: "p" });
    expect(cardGeneration(call("1", IMAGE_TOOL, generated), undefined)).toEqual(
      { model: "m", prompt: "p" },
    );
  });

  it("is null for other tools, plain images, failures and approvals", () => {
    expect(cardGeneration(call("1", "bash", generated), undefined)).toBeNull();
    expect(
      cardGeneration(call("1", IMAGE_TOOL, { path: "/tmp/a.png" }), undefined),
    ).toBeNull();
    expect(
      cardGeneration(call("1", IMAGE_TOOL, generated), { status: "error" }),
    ).toBeNull();
    expect(
      cardGeneration(call("1", IMAGE_TOOL, generated), {
        status: "running",
        approval: {},
      }),
    ).toBeNull();
  });
});

describe("editOriginals", () => {
  const image = (data: string): ImageContent => ({
    type: "image",
    data,
    mimeType: "image/png",
  });
  const shown = (data: string): ToolRun => ({
    status: "done",
    result: { content: [], details: { image: image(data) } },
  });
  const turn = (...calls: ReturnType<typeof call>[]): Item => ({
    kind: "message",
    message: {
      role: "assistant",
      content: calls,
      provider: "p",
      model: "m",
      stopReason: "toolUse",
      timestamp: 0,
    } as AssistantMessage,
  });

  it("finds what was shown at the edit's path before it", () => {
    const items = [
      turn(call("v1", IMAGE_TOOL, { path: "/a.png" })),
      { kind: "notice", text: "x" } as unknown as Item,
      turn(call("v2", IMAGE_TOOL, { path: "/b.png", editOf: "/a.png" })),
    ];
    const originals = editOriginals(items, { v1: shown("1"), v2: shown("2") });
    expect(originals.get("v2")).toEqual(image("1"));
    expect(originals.has("v1")).toBe(false);
  });

  it("keeps the original of an edit saved over it", () => {
    const items = [
      turn(
        call("v1", IMAGE_TOOL, { path: "/a.png" }),
        call("v2", IMAGE_TOOL, { path: "/a.png", editOf: "/a.png" }),
      ),
    ];
    const originals = editOriginals(items, { v1: shown("1"), v2: shown("2") });
    expect(originals.get("v2")).toEqual(image("1"));
  });

  it("has nothing for an original never shown, or one with no image yet", () => {
    const items = [
      turn(call("v1", IMAGE_TOOL, { path: "/a.png" }), call("x", "bash", {})),
      turn(call("v2", IMAGE_TOOL, { path: "/b.png", editOf: "/c.png" })),
      turn(call("v3", IMAGE_TOOL, { path: "/d.png", editOf: "/a.png" })),
    ];
    expect(editOriginals(items, {}).size).toBe(0);
  });
});
