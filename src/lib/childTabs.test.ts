import { Bot, SquareTerminal } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  childTabId,
  childTabs,
  readChildTab,
  type ChildTab,
} from "./childTabs";
import { tabLabel } from "./diffTabs";

const agent: ChildTab = {
  kind: "agent",
  session: "s",
  id: "agent-1",
  model: "haiku",
};
const bg: ChildTab = {
  kind: "background",
  session: "s",
  pid: 42,
  command: "npm run dev",
};
const status = { cwd: "/w", session: "s", title: "", waiting: false };

describe("child tab ids", () => {
  it("round-trip a subagent and a background command", () => {
    expect(readChildTab(childTabId(agent))).toEqual(agent);
    expect(readChildTab(childTabId(bg))).toEqual(bg);
  });

  it("read nothing from other tabs or malformed ids", () => {
    expect(readChildTab("/work/src/a.ts")).toBeNull();
    expect(readChildTab("child:{nope")).toBeNull();
    expect(readChildTab('child:{"kind":"agent","id":"x"}')).toBeNull();
    expect(readChildTab('child:{"kind":"other","session":"s"}')).toBeNull();
    expect(
      readChildTab('child:{"kind":"background","session":"s"}'),
    ).toBeNull();
  });

  it("label a tab by its subagent or command", () => {
    expect(tabLabel(childTabId(agent), "/work")).toMatchObject({
      name: "agent-1",
      detail: "haiku",
      icon: Bot,
    });
    expect(tabLabel(childTabId(bg), "/work")).toMatchObject({
      name: "npm run dev",
      detail: "42",
      icon: SquareTerminal,
    });
  });
});

describe("childTabs", () => {
  it("lists a conversation's subagents, then its background commands", () => {
    const listed = childTabs({
      ...status,
      running: true,
      subagents: [{ id: "agent-1", model: "haiku", running: true }],
      background: [{ pid: 42, command: "npm run dev", running: false }],
    });
    expect(listed.map(({ tab, running }) => [tab, running])).toEqual([
      [agent, true],
      [bg, false],
    ]);
    expect(listed[0].id).toBe(childTabId(agent));
  });

  it("lists nothing for a conversation without any", () => {
    expect(childTabs({ ...status, running: false })).toEqual([]);
  });
});
