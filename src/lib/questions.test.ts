import { describe, expect, it } from "vitest";
import {
  type Draft,
  EMPTY_DRAFT,
  OTHER,
  readQuestions,
  setNote,
  toAnswers,
  toggle,
  typeOther,
} from "./questions";

const options = [{ label: "SQLite" }, { label: "JSON file" }];

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
});

describe("typeOther", () => {
  it("picks the user's own answer once, in place of an option", () => {
    const picked = toggle(EMPTY_DRAFT, "SQLite", false);
    const typed = typeOther(picked, "Postgres", false);
    expect(typed).toMatchObject({ picked: [OTHER], other: "Postgres" });
    expect(typeOther(typed, "Postgres 17", false).picked).toEqual([OTHER]);
  });

  it("keeps picked options when several are allowed", () => {
    const picked = toggle(EMPTY_DRAFT, "SQLite", true);
    expect(typeOther(picked, "Postgres", true).picked).toEqual([
      "SQLite",
      OTHER,
    ]);
  });
});

describe("setNote", () => {
  it("keeps a note per option", () => {
    const one = setNote(EMPTY_DRAFT, "SQLite", "fast");
    expect(setNote(one, "JSON file", "small").notes).toEqual({
      SQLite: "fast",
      "JSON file": "small",
    });
    expect(EMPTY_DRAFT.notes).toEqual({});
  });
});

describe("toAnswers", () => {
  const questions = [
    { question: "Where?", options },
    { question: "How?", options },
  ];

  it("sends picked labels and the user's own text, with their trimmed notes", () => {
    const drafts: Draft[] = [
      {
        picked: ["SQLite", OTHER],
        other: " Postgres ",
        notes: { SQLite: " fast ", "JSON file": "unpicked", [OTHER]: "  " },
      },
      { picked: [OTHER], other: "  ", notes: {} },
    ];
    expect(toAnswers(questions, drafts)).toEqual([
      {
        question: "Where?",
        choices: [{ answer: "SQLite", note: "fast" }, { answer: "Postgres" }],
      },
      { question: "How?", choices: [] },
    ]);
  });

  it("leaves unanswered questions to the agent", () => {
    expect(toAnswers(questions, [])).toEqual([
      { question: "Where?", choices: [] },
      { question: "How?", choices: [] },
    ]);
  });
});
