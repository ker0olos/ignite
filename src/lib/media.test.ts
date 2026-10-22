import { describe, expect, it } from "vitest";
import {
  AUDIO_TOOL,
  IMAGE_TOOL,
  VIDEO_TOOL,
  type AssistantMessage,
  type ImageContent,
} from "../../shared/agentTypes";
import {
  audioCard,
  audioTitle,
  cardGeneration,
  editOriginals,
  peaks,
  readGeneration,
  resultAudio,
  resultVideo,
  videoCard,
} from "./media";
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

describe("audioCard", () => {
  const music = { path: "/a.mp3", model: "m", prompt: "p" };

  it("reads music and speech, keeping only non-empty fields", () => {
    expect(audioCard(call("1", AUDIO_TOOL, music), undefined)).toEqual({
      model: "m",
      prompt: "p",
    });
    expect(
      audioCard(
        call("1", AUDIO_TOOL, {
          model: "m",
          script: "hi",
          voice: "Kore",
          prompt: "",
        }),
        { status: "done" },
      ),
    ).toEqual({ model: "m", script: "hi", voice: "Kore" });
  });

  it("draws a card for a plain audio file too", () => {
    expect(audioCard(call("1", AUDIO_TOOL, { path: "/a" }), undefined)).toEqual(
      {},
    );
  });

  it("is null for other tools, failures and approvals", () => {
    expect(audioCard(call("1", "bash", music), undefined)).toBeNull();
    expect(
      audioCard(call("1", AUDIO_TOOL, music), { status: "error" }),
    ).toBeNull();
    expect(
      audioCard(call("1", AUDIO_TOOL, music), {
        status: "running",
        approval: {},
      }),
    ).toBeNull();
  });
});

describe("audioTitle", () => {
  it("says speech, generated audio, or plain audio", () => {
    expect(audioTitle({ script: "hi" })).toBe("Generated speech");
    expect(audioTitle({ voice: "Kore" })).toBe("Generated speech");
    expect(audioTitle({ model: "m" })).toBe("Generated audio");
    expect(audioTitle({})).toBe("Audio");
  });
});

describe("resultAudio", () => {
  const audio = { type: "audio", data: "AA", mimeType: "audio/wav" };
  const withDetails = (details: unknown) => ({ content: [], details });

  it("reads details.audio", () => {
    expect(resultAudio(withDetails({ audio }))).toEqual(audio);
  });

  it("is undefined without a result or a well-formed audio", () => {
    expect(resultAudio(undefined)).toBeUndefined();
    expect(resultAudio({ content: [] })).toBeUndefined();
    expect(
      resultAudio(withDetails({ audio: { ...audio, type: "x" } })),
    ).toBeUndefined();
    expect(
      resultAudio(withDetails({ audio: { ...audio, data: 1 } })),
    ).toBeUndefined();
    expect(
      resultAudio(withDetails({ audio: { type: "audio", data: "A" } })),
    ).toBeUndefined();
  });
});

describe("videoCard", () => {
  const clip = { path: "/a.mp4", model: "m", prompt: "p" };

  it("reads a show_video call, keeping only non-empty fields", () => {
    expect(videoCard(call("1", VIDEO_TOOL, clip), undefined)).toEqual({
      model: "m",
      prompt: "p",
    });
    expect(
      videoCard(
        call("1", VIDEO_TOOL, {
          ...clip,
          avoid: "text",
          size: "640x360",
          from: "/a.png",
        }),
        { status: "done" },
      ),
    ).toEqual({
      model: "m",
      prompt: "p",
      avoid: "text",
      size: "640x360",
      from: "/a.png",
    });
    expect(
      videoCard(
        call("1", VIDEO_TOOL, { ...clip, from: "", avoid: 2 }),
        undefined,
      ),
    ).toEqual({ model: "m", prompt: "p" });
  });

  it("draws a card for a plain video file too", () => {
    expect(videoCard(call("1", VIDEO_TOOL, { path: "/a" }), undefined)).toEqual(
      {},
    );
  });

  it("is null for other tools, failures and approvals", () => {
    expect(videoCard(call("1", "bash", clip), undefined)).toBeNull();
    expect(
      videoCard(call("1", VIDEO_TOOL, clip), { status: "error" }),
    ).toBeNull();
    expect(
      videoCard(call("1", VIDEO_TOOL, clip), {
        status: "running",
        approval: {},
      }),
    ).toBeNull();
  });
});

describe("resultVideo", () => {
  const video = { type: "video", data: "AA", mimeType: "video/mp4" };
  const withDetails = (details: unknown) => ({ content: [], details });

  it("reads details.video, inline or by path", () => {
    expect(resultVideo(withDetails({ video }))).toEqual(video);
    const onDisk = { type: "video", path: "/a.mp4", mimeType: "video/mp4" };
    expect(resultVideo(withDetails({ video: onDisk }))).toEqual(onDisk);
  });

  it("is undefined without a result or a well-formed video", () => {
    expect(resultVideo(undefined)).toBeUndefined();
    expect(resultVideo({ content: [] })).toBeUndefined();
    expect(
      resultVideo(withDetails({ video: { ...video, type: "x" } })),
    ).toBeUndefined();
    expect(
      resultVideo(withDetails({ video: { ...video, data: 1 } })),
    ).toBeUndefined();
    expect(
      resultVideo(withDetails({ video: { type: "video", data: "A" } })),
    ).toBeUndefined();
  });
});

describe("peaks", () => {
  it("takes each slice's loudest sample, scaled so the loudest is 1", () => {
    const samples = new Float32Array([0.1, -0.2, 0.5, 0.25]);
    expect(peaks(samples, 2)).toEqual([expect.closeTo(0.4), 1]);
  });

  it("stays zero for silence", () => {
    expect(peaks(new Float32Array(10), 4)).toEqual([0, 0, 0, 0]);
  });

  it("returns count values for fewer samples than bars, and for none", () => {
    expect(peaks(new Float32Array([0.5]), 3)).toHaveLength(3);
    expect(peaks(new Float32Array(0), 3)).toEqual([0, 0, 0]);
  });
});
