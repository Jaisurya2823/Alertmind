/**
 * AlertMind — Timer Utilities
 * High-resolution timing for performance measurement across the AI pipeline.
 */

/**
 * Creates a timer that measures elapsed time.
 * Uses process.hrtime.bigint() for nanosecond precision.
 *
 * @returns {{ elapsed: () => number, elapsedMs: () => number }}
 */
export function createTimer() {
  const start = process.hrtime.bigint();

  return {
    /** Returns elapsed time in seconds */
    elapsed() {
      return Number(process.hrtime.bigint() - start) / 1_000_000_000;
    },
    /** Returns elapsed time in milliseconds */
    elapsedMs() {
      return Number(process.hrtime.bigint() - start) / 1_000_000;
    },
  };
}

/**
 * Wraps an async function with timing measurement.
 * Returns [result, durationMs].
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<[T, number]>}
 */
export async function timeAsync(fn) {
  const timer = createTimer();
  const result = await fn();
  return [result, timer.elapsedMs()];
}

/**
 * Returns current Unix timestamp in milliseconds.
 * @returns {number}
 */
export function nowMs() {
  return Date.now();
}

/**
 * Formats a duration in milliseconds for logging.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
