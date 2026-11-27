export interface FetchJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  attempts: number;
}

export interface FetchJsonRetryOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  maxRetries?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, maxRetries: number) => void;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const RETRYABLE_HTTP_STATUSES = new Set([408, 500, 502, 503, 504]);

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const abortErr = new Error('The operation was aborted.');
      abortErr.name = 'AbortError';
      reject(abortErr);
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      const abortErr = new Error('The operation was aborted.');
      abortErr.name = 'AbortError';
      reject(abortErr);
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.message.toLowerCase().includes('aborted'))
  );
}

/**
 * Fetches JSON from an API route and automatically retries transient network,
 * proxy (502/503/504), timeout (408), non-JSON, or server-marked retryable errors
 * with exponential backoff while respecting AbortSignal cancellation.
 */
export async function fetchJsonWithRetry<T extends Record<string, unknown>>(
  url: string,
  options: FetchJsonRetryOptions = {},
): Promise<FetchJsonResult<T>> {
  const {
    method = 'POST',
    headers = { 'Content-Type': 'application/json' },
    body,
    signal,
    maxRetries = 2,
    baseDelayMs = 700,
    onRetry,
    fetchImpl = fetch,
    sleepImpl = sleepWithAbort,
  } = options;

  let lastResult: FetchJsonResult<T> = {
    ok: false,
    status: 0,
    data: null,
    error: 'Network error reaching the server. Please try again.',
    attempts: 0,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      onRetry?.(attempt, maxRetries);
      await sleepImpl(baseDelayMs * Math.pow(2, attempt - 1), signal);
    }

    try {
      const response = await fetchImpl(url, {
        method,
        headers,
        body,
        signal,
      });

      const contentType = response.headers.get('content-type') ?? '';
      let parsed: T | null = null;
      let validJson = false;

      if (contentType.includes('application/json') || response.ok) {
        try {
          parsed = (await response.json()) as T;
          validJson = parsed !== null && typeof parsed === 'object';
        } catch {
          validJson = false;
          parsed = null;
        }
      }

      if (response.ok && validJson && parsed) {
        return {
          ok: true,
          status: response.status,
          data: parsed,
          attempts: attempt + 1,
        };
      }

      const serverError =
        parsed && typeof parsed.error === 'string' && parsed.error.trim()
          ? parsed.error.trim()
          : undefined;
      const serverRetryable =
        parsed && typeof parsed.retryable === 'boolean'
          ? parsed.retryable
          : undefined;

      const shouldRetry =
        attempt < maxRetries &&
        (serverRetryable === true ||
          (!validJson && response.status >= 500) ||
          (serverRetryable !== false &&
            RETRYABLE_HTTP_STATUSES.has(response.status)));

      lastResult = {
        ok: false,
        status: response.status,
        data: parsed,
        error: serverError,
        attempts: attempt + 1,
      };

      if (!shouldRetry) {
        return lastResult;
      }
    } catch (err: unknown) {
      if (isAbortError(err)) {
        throw err;
      }

      lastResult = {
        ok: false,
        status: 0,
        data: null,
        error: 'Network error reaching the server. Please try again.',
        attempts: attempt + 1,
      };

      if (attempt >= maxRetries) {
        return lastResult;
      }
    }
  }

  return lastResult;
}
