const defaultSleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

/** Retry on HTTP 429/5xx with exponential backoff (up to 4 attempts). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status =
        (err as { status?: number; code?: number }).status ??
        (err as { code?: number }).code;
      const retryable =
        status === 429 ||
        (typeof status === "number" && status >= 500 && status < 600);
      if (attempt >= 3 || !retryable) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

/** Run fn over items with at most `limit` in flight. */
export async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
}
