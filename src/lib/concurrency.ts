// Minimal concurrency limiter so a flexible-date search (which can fan out
// into dozens of date-pair requests) never hammers the flight API faster
// than its rate limit allows.
export function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next() {
    active--;
    const resolve = queue.shift();
    if (resolve) resolve();
  }

  return async function <T>(task: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      next();
    }
  };
}
