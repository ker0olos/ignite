import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../../shared/agentTypes";
import { GH_TOOL, GIT_TOOL } from "../../shared/git";
import { conversationPrs } from "./conversationPrs";
import { assistant, call, result } from "./demoTranscript";
import { darkModeMessages } from "./demoDarkMode";
import { EMPTY, fromHistory, type Transcript } from "./transcript";

const URL12 = "https://github.com/acme/web/pull/12";
const URL49 = "https://github.com/acme/api/pull/49";
const create = (id: string) => call(id, GH_TOOL, { args: ["pr", "create"] });

const prs = (messages: AgentMessage[]) =>
  conversationPrs(fromHistory(messages, false));

describe("conversationPrs", () => {
  it("is empty for an empty transcript", () => {
    expect(conversationPrs(EMPTY)).toEqual([]);
  });

  it("reads the url from the tool result message", () => {
    const c = create("a");
    expect(prs([assistant([c]), result(c, URL12)])).toEqual([
      { url: URL12, number: 12 },
    ]);
  });

  it("lists several in order and drops duplicates", () => {
    const [a, b, c] = [create("a"), create("b"), create("c")];
    expect(
      prs([
        assistant([a, b, c]),
        result(a, URL12),
        result(b, URL49),
        result(c, URL12),
      ]).map((p) => p.number),
    ).toEqual([12, 49]);
  });

  it("falls back to the live tool result", () => {
    const c = create("a");
    const t: Transcript = {
      ...fromHistory([assistant([c])], true),
      tools: {
        a: {
          status: "done",
          result: { content: [{ type: "text", text: URL49 }] },
        },
      },
    };
    expect(conversationPrs(t)).toEqual([{ url: URL49, number: 49 }]);
  });

  it("ignores a failed call, a pending call and a result with no text", () => {
    const [a, b] = [create("a"), create("b")];
    const t = fromHistory(
      [assistant([a, b]), result(a, "failed: no commits")],
      true,
    );
    expect(conversationPrs(t)).toEqual([]);
    expect(
      conversationPrs({
        ...t,
        tools: { b: { status: "running", result: { content: [] } } },
      }),
    ).toEqual([]);
  });

  it("ignores other gh calls, other tools and non-assistant messages", () => {
    const view = call("v", GH_TOOL, { args: ["pr", "view"] });
    const bare = call("w", GH_TOOL, {});
    const git = call("g", GIT_TOOL, { args: ["pr", "create"] });
    expect(
      prs([
        { role: "user", content: "hi", timestamp: 0 },
        assistant([{ type: "text", text: URL12 }, view, bare, git]),
        result(view, URL12),
        result(bare, URL12),
        result(git, URL12),
      ]),
    ).toEqual([]);
  });

  it("finds the demo's pull request", () => {
    expect(prs(darkModeMessages("/demo/tempo"))).toEqual([
      { url: "https://github.com/you/tempo/pull/12", number: 12 },
    ]);
  });
});
