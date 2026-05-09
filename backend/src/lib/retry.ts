/**
 * Retry helpers for transient HTTP / network failures hitting external APIs
 * (MercadoLibre public endpoints, Wayback CDX, etc).
 *
 * Why a shared module:
 *   The seed script and the production cron both hit `api.mercadolibre.com`,
 *   and both used to handle transient failures inconsistently:
 *     - scripts/seed.ts had a 2-attempt retry loop with linear backoff
 *     - src/scrapers/discovery.ts gave up after the first 5xx/timeout
 *     - src/scrapers/ml-api.ts gave up after the first non-2xx
 *   That asymmetry meant the local seed survived ML hiccups but the cron lost
 *   a whole wave of products / a whole price refresh whenever ML returned a
 *   transient 429 or 503. Centralising the policy here keeps the behaviour
 *   identical across all three callers and makes the retry budget easy to
 *   reason about (and easy to unit-test in isolation).
 *
 * Policy (intentionally conservative — we are a polite consumer, not a crawler):
 *   - Only retry transient errors: HTTP 408/425/429/5xx, AbortError (timeout),
 *     and underlying network errors. Never retry 4xx auth/validation errors.
 *   - Linear backoff: BASE_DELAY_MS * (attempt + 1) — predictable and easy to
 *     bound in worst-case. The cron has CF subrequest budgets to respect, so
 *     exponential backoff with jitter is overkill at our scale.
 *   - Caller-controlled max attempts: defaults to 2 retries (3 total tries),
 *     same as scripts/seed.ts pre-extraction.
 *
 * Pure module: no I/O of its own beyond the fetch the caller supplies via the
 * `attempt()` thunk, so it is trivially unit-testable with an in-memory stub.
 */

export interface RetryOptions {
  /** Total max attempts including the first try. Defaults to 3. */
  maxAttempts?: number;
  /** Base delay in ms for linear backoff. Defaults to 750. */
  baseDelayMs?: number;
  /** Sleep override (for tests). Defaults to setTimeout-based promise. */
  sleep?: (ms: number) => Promise<void>;
}

export function isTransientHttpStatus(status: number): boolean {
  // 408 Request Timeout, 425 Too Early, 429 Too Many Requests, all 5xx.
  // Everything else (4xx auth/validation, redirects, 2xx) is non-transient.
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Returns true when the error looks like a transient network condition we
 * should retry: AbortError (our own timeout), DOMException AbortError, or any
 * Error whose message hints at a connection-level failure (ECONNRESET,
 * ETIMEDOUT, "network", "fetch failed", etc.). Errors flagged with
 * `(err as any).transient === true` by the caller are also honoured.
 */
export function isRetriableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const flagged = (err as Error & { transient?: boolean }).transient === true;
  if (flagged) return true;
  if (err.name === "AbortError") return true;
  const msg = err.message.toLowerCase();
  if (
    msg.includes("aborted") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("enetunreach") ||
    msg.includes("socket hang up")
  ) {
    return true;
  }
  return false;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `attempt()` with linear backoff retry on transient failures.
 *
 * Throws the LAST error if every attempt fails. Returns the first successful
 * result otherwise. Non-retriable errors short-circuit immediately.
 */
export async function withRetry<T>(
  attempt: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 750;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      const isLast = i === maxAttempts - 1;
      if (isLast || !isRetriableError(err)) break;
      await sleep(baseDelayMs * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
