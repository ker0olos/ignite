/** Tools that ask for themselves: their calls' questions go out in the order the agent made them, though each prepares its own in parallel. */

/** A call's place in line: ask once `ahead` settles, then call `done` (also when it won't ask). */
export type Turn = { ahead: Promise<void>; done: () => void };

/** A line of calls; each call takes its turn as it starts, before anything it awaits. */
export function askingLine() {
  let last = Promise.resolve();
  return (): Turn => {
    const ahead = last;
    let done = () => {};
    const mine = new Promise<void>((resolve) => (done = resolve));
    // The next call waits for this one and every call ahead of it.
    last = Promise.all([ahead, mine]).then(() => {});
    return { ahead, done };
  };
}

/** Asks once the calls ahead have, then lets the next one ask; resolves to the answer. */
export async function askInTurn<A>(turn: Turn, ask: () => Promise<A>) {
  await turn.ahead;
  const answer = ask();
  turn.done();
  return answer;
}
