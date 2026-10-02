/** How far `/compact`'s summary has got: the tokens it has written so far, read off pi's stream as it goes. */

type StreamEvent = { type: string; delta?: string };
/** pi-agent-core's StreamFn, as far as it's used here. */
export type StreamFn = (...args: never[]) => unknown;

// pi doesn't count output tokens until the end; text runs about 4 characters a token.
const CHARS_PER_TOKEN = 4;
const EVERY_MS = 250;

/** Counts one stream's text and thinking deltas; pi itself only awaits its result, so reading it doesn't disturb pi. */
async function watch(stream: unknown, add: (chars: number) => void) {
  for await (const event of stream as AsyncIterable<StreamEvent>) {
    if (event.type === "text_delta" || event.type === "thinking_delta") {
      add(event.delta?.length ?? 0);
    }
  }
}

/**
 * Runs `compact` with the agent's stream function wrapped, reporting the
 * summary's tokens to `onTokens` at most every 250ms; the original comes back
 * after. Compaction aborts any run first, so only its own calls stream here.
 */
export async function withSummaryProgress<T>(
  agent: { streamFunction: StreamFn },
  onTokens: (tokens: number) => void,
  compact: () => Promise<T>,
): Promise<T> {
  const original = agent.streamFunction;
  let chars = 0;
  let sent = 0;
  const add = (n: number) => {
    chars += n;
    if (Date.now() - sent < EVERY_MS) return;
    sent = Date.now();
    onTokens(Math.round(chars / CHARS_PER_TOKEN));
  };
  agent.streamFunction = (async (...args: never[]) => {
    const stream = await (original as (...a: never[]) => unknown)(...args);
    void watch(stream, add).catch(() => {});
    return stream;
  }) as StreamFn;
  try {
    return await compact();
  } finally {
    agent.streamFunction = original;
  }
}
