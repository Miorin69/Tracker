import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJsonWithRetry } from './apiFetch';

function makeResponse(
  status: number,
  body: string,
  contentType = 'application/json',
): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': contentType },
  });
}

test('fetchJsonWithRetry auto-recovers from transient 503 and HTML 502 responses', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return makeResponse(502, '<html>Bad Gateway</html>', 'text/html');
    }
    if (calls === 2) {
      return makeResponse(
        503,
        JSON.stringify({ error: 'Temporarily busy', retryable: true }),
      );
    }
    return makeResponse(200, JSON.stringify({ brief: { headline: 'Ready' } }));
  };

  const result = await fetchJsonWithRetry<{ brief?: { headline: string } }>(
    '/api/ai/coach-brief',
    {
      maxRetries: 2,
      fetchImpl: fakeFetch,
      sleepImpl: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
  assert.equal(result.data?.brief?.headline, 'Ready');
});

test('fetchJsonWithRetry auto-recovers from transient network errors', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) {
      throw new TypeError('Failed to fetch');
    }
    return makeResponse(200, JSON.stringify({ ok: true }));
  };

  const result = await fetchJsonWithRetry<{ ok?: boolean }>('/api/test', {
    maxRetries: 2,
    fetchImpl: fakeFetch,
    sleepImpl: async () => {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
});

test('fetchJsonWithRetry does not retry 403 auth or non-retryable 429 errors', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    return makeResponse(
      429,
      JSON.stringify({ error: 'Quota exceeded', retryable: false }),
    );
  };

  const result = await fetchJsonWithRetry<{ error?: string }>('/api/test', {
    maxRetries: 2,
    fetchImpl: fakeFetch,
    sleepImpl: async () => {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
  assert.equal(calls, 1);
  assert.equal(result.error, 'Quota exceeded');
});

test('fetchJsonWithRetry propagates AbortError immediately without retrying', async () => {
  const controller = new AbortController();
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    controller.abort();
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  };

  await assert.rejects(
    () =>
      fetchJsonWithRetry('/api/test', {
        signal: controller.signal,
        maxRetries: 2,
        fetchImpl: fakeFetch,
        sleepImpl: async () => {},
      }),
    (err: unknown) => err instanceof Error && err.name === 'AbortError',
  );
  assert.equal(calls, 1);
});
