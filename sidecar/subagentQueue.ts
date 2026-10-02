/** Runs at most `max()` jobs at once; the rest wait in order. `max` is read whenever a slot frees. */
export function concurrency(max: () => number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  const next = () => {
    while (running < max() && waiting.length > 0) {
      running++;
      waiting.shift()!();
    }
  };

  const take = (signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const stopped = () => new Error("Stopped while waiting for a turn.");
      if (signal?.aborted) return reject(stopped());
      const go = () => {
        signal?.removeEventListener("abort", cancel);
        resolve();
      };
      const cancel = () => {
        waiting.splice(waiting.indexOf(go), 1);
        reject(stopped());
      };
      signal?.addEventListener("abort", cancel, { once: true });
      waiting.push(go);
      next();
    });

  /** Runs `job` once a slot is free. */
  return async function run<T>(
    job: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    await take(signal);
    try {
      return await job();
    } finally {
      running--;
      next();
    }
  };
}
