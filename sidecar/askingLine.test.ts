import { describe, expect, it } from "vitest";
import { askInTurn, askingLine } from "./askingLine.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("askingLine", () => {
  it("asks in the order the calls started, though a later one is ready first", async () => {
    const takeTurn = askingLine();
    const asked: string[] = [];
    const ask = (name: string) => async () => {
      asked.push(name);
      return name;
    };
    const first = takeTurn();
    const second = takeTurn();
    const fast = askInTurn(second, ask("second"));
    await tick();
    expect(asked).toEqual([]);
    const slow = askInTurn(first, ask("first"));
    expect(await Promise.all([slow, fast])).toEqual(["first", "second"]);
    expect(asked).toEqual(["first", "second"]);
  });

  it("lets the next call ask once one ahead won't", async () => {
    const takeTurn = askingLine();
    const first = takeTurn();
    const second = takeTurn();
    const answer = askInTurn(second, async () => "second");
    first.done();
    expect(await answer).toBe("second");
  });

  it("keeps a call behind one that won't ask also behind the calls ahead of that one", async () => {
    const takeTurn = askingLine();
    const asked: string[] = [];
    const [first, middle, last] = [takeTurn(), takeTurn(), takeTurn()];
    const later = askInTurn(last, async () => asked.push("last"));
    middle.done();
    await tick();
    expect(asked).toEqual([]);
    await askInTurn(first, async () => asked.push("first"));
    await later;
    expect(asked).toEqual(["first", "last"]);
  });

  it("doesn't wait for an earlier call's answer", async () => {
    const takeTurn = askingLine();
    const first = takeTurn();
    const second = takeTurn();
    void askInTurn(first, () => new Promise<string>(() => {}));
    expect(await askInTurn(second, async () => "second")).toBe("second");
  });
});
