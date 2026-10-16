import { describe, expect, it } from "vitest";
import type { ToolCall } from "../../shared/agentTypes";
import {
  type Draft,
  EMPTY_DRAFT,
  askingCall,
  noteLabel,
  optionHint,
  pickHint,
  pickKey,
  readAnswered,
  readQuestions,
  toAnswers,
  toggle,
  typesText,
} from "./questions";
import type { Item } from "./transcript";

const options = [{ label: "SQLite" }, { label: "JSON file" }];
const image = { type: "image" as const, data: "x", mimeType: "image/png" };

describe("readQuestions", () => {
  it("keeps well-formed questions only", () => {
    expect(readQuestions({})).toEqual([]);
    expect(
      readQuestions({
        questions: [{ question: "Where?", options }, { question: 3 }, null],
      }),
    ).toEqual([{ question: "Where?", options }]);
  });
});

describe("toggle", () => {
  it("picks one option, replacing the last, and unpicks it", () => {
    const one = toggle(EMPTY_DRAFT, "SQLite", false);
    expect(one.picked).toEqual(["SQLite"]);
    expect(toggle(one, "JSON file", false).picked).toEqual(["JSON file"]);
    expect(toggle(one, "SQLite", false).picked).toEqual([]);
  });

  it("picks several when the question allows it", () => {
    const two = toggle(toggle(EMPTY_DRAFT, "SQLite", true), "JSON file", true);
    expect(two.picked).toEqual(["SQLite", "JSON file"]);
    expect(toggle(two, "SQLite", true).picked).toEqual(["JSON file"]);
  });

  it("keeps the text and images", () => {
    const draft = { picked: [], text: "hi", images: [image] };
    expect(toggle(draft, "SQLite", false)).toMatchObject({
      text: "hi",
      images: [image],
    });
  });
});

describe("toAnswers", () => {
  const questions = [
    { question: "Where?", options },
    { question: "How?", options },
  ];

  it("sends picks with the trimmed text as their note", () => {
    const drafts: Draft[] = [
      { picked: ["SQLite", "JSON file"], text: " fast ", images: [] },
      { picked: ["SQLite"], text: "  ", images: [] },
    ];
    expect(toAnswers(questions, drafts)).toEqual([
      { question: "Where?", choices: ["SQLite", "JSON file"], note: "fast" },
      { question: "How?", choices: ["SQLite"] },
    ]);
  });

  it("sends the text as the only choice when nothing is picked", () => {
    const drafts: Draft[] = [{ picked: [], text: " Postgres ", images: [] }];
    expect(toAnswers(questions, drafts)[0]).toEqual({
      question: "Where?",
      choices: ["Postgres"],
    });
  });

  it("sends images with or without a pick or text", () => {
    const drafts: Draft[] = [
      { picked: ["SQLite"], text: "", images: [image] },
      { picked: [], text: "", images: [image] },
    ];
    expect(toAnswers(questions, drafts)).toEqual([
      { question: "Where?", choices: ["SQLite"], images: [image] },
      { question: "How?", choices: [], images: [image] },
    ]);
  });

  it("leaves unanswered questions to the agent", () => {
    expect(toAnswers(questions, [])).toEqual([
      { question: "Where?", choices: [] },
      { question: "How?", choices: [] },
    ]);
  });
});

describe("noteLabel", () => {
  it("names what the text is a note on", () => {
    expect(noteLabel([])).toBeUndefined();
    expect(noteLabel(["SQLite"])).toBe("Note on SQLite");
    expect(noteLabel(["SQLite", "JSON file"])).toBe("Note on your 2 picks");
  });
});

describe("askingCall", () => {
  const call = (id: string, name: string): ToolCall => ({
    type: "toolCall",
    id,
    name,
    arguments: {},
  });
  const items = (...calls: ToolCall[]): Item[] => [
    { kind: "notice", text: "hi" },
    { kind: "message", message: { role: "user", content: "q" } as never },
    {
      kind: "message",
      message: { role: "assistant", content: calls } as never,
    },
  ];

  it("finds the first waiting call when it asks", () => {
    const ask = call("a", "ask_user");
    expect(askingCall(items(call("b", "bash"), ask), ["a", "b"])).toBe(ask);
  });

  it("is undefined when the first waiting call is another tool", () => {
    expect(
      askingCall(items(call("a", "ask_user"), call("b", "bash")), ["b", "a"]),
    ).toBeUndefined();
  });

  it("is undefined with nothing waiting or no such call", () => {
    expect(askingCall(items(call("a", "ask_user")), [])).toBeUndefined();
    expect(askingCall(items(call("a", "ask_user")), ["z"])).toBeUndefined();
  });
});

describe("readAnswered", () => {
  it("reads the answers a result keeps", () => {
    const answers = [{ question: "Where?", choices: ["SQLite"] }];
    expect(readAnswered({ answers })).toBe(answers);
  });

  it("is undefined for older results and none", () => {
    expect(readAnswered(undefined)).toBeUndefined();
    expect(readAnswered({})).toBeUndefined();
    expect(readAnswered({ answers: "no" })).toBeUndefined();
  });
});

describe("optionHint", () => {
  it("puts Space on the focused option and arrows on its neighbours", () => {
    expect([0, 1, 2, 3].map((i) => optionHint(i, 1))).toEqual([
      "↑",
      "Space",
      "↓",
      undefined,
    ]);
    expect(optionHint(0, null)).toBeUndefined();
  });
});

describe("typesText", () => {
  const key = (key: string, mods = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...mods,
  });
  it("counts characters, not Space, named keys or shortcuts", () => {
    expect(typesText(key("a"))).toBe(true);
    expect(typesText(key("A"))).toBe(true);
    expect(typesText(key(" "))).toBe(false);
    expect(typesText(key("Enter"))).toBe(false);
    expect(typesText(key("a", { metaKey: true }))).toBe(false);
    expect(typesText(key("a", { ctrlKey: true }))).toBe(false);
    expect(typesText(key("a", { altKey: true }))).toBe(false);
  });
});

describe("pickKey", () => {
  const key = (code: string, mods = {}) => ({
    code,
    altKey: true,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...mods,
  });
  it("reads Alt and a digit as an option's index", () => {
    expect(pickKey(key("Digit1"))).toBe(0);
    expect(pickKey(key("Digit9"))).toBe(8);
    expect(pickKey(key("Digit0"))).toBeNull();
    expect(pickKey(key("KeyA"))).toBeNull();
    expect(pickKey(key("Digit1", { altKey: false }))).toBeNull();
    expect(pickKey(key("Digit1", { metaKey: true }))).toBeNull();
    expect(pickKey(key("Digit1", { shiftKey: true }))).toBeNull();
  });
});

describe("pickHint", () => {
  it("names the key with the platform's modifier", () => {
    expect(pickHint(0, true)).toBe("⌥1");
    expect(pickHint(2, false)).toBe("Alt+3");
  });
});
