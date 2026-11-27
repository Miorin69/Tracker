import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LruCache,
  ModelCooldownTracker,
  classifyGeminiError,
  parseJsonLenient,
  runGeminiTextWithResilience,
  runGeminiWithResilience,
} from './aiResilience';

test('classifyGeminiError recognizes free-tier 429 daily quota errors for model failover', () => {
  const rawQuotaErr = new Error(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message:
          'You exceeded your current quota, limit: 20, model: gemini-4-hydrogen, free_tier_requests per day. Please retry in 17h.',
      },
    }),
  );

  const classified = classifyGeminiError(rawQuotaErr, 'Coach Hishay');
  assert.equal(classified.httpStatus, 429);
  assert.equal(classified.shouldFallbackModel, true);
  assert.equal(classified.retryable, false);
  assert.ok(classified.cooldownMs >= 60_000);
  assert.match(classified.userMessage, /Settings > Secrets/);
});

test('classifyGeminiError detects 503 unavailable as transient and retryable', () => {
  const err = new Error('503 UNAVAILABLE: This model is currently experiencing high demand.');
  const classified = classifyGeminiError(err, 'Coach Hishay');
  assert.equal(classified.httpStatus, 503);
  assert.equal(classified.retryable, true);
  assert.equal(classified.shouldFallbackModel, true);
});

test('classifyGeminiError fails fast on 403 permission denied without fallback', () => {
  const err = new Error(
    JSON.stringify({
      error: {
        code: 403,
        status: 'PERMISSION_DENIED',
        message: 'API_KEY_INVALID',
      },
    }),
  );
  const classified = classifyGeminiError(err, 'Coach Hishay');
  assert.equal(classified.httpStatus, 403);
  assert.equal(classified.retryable, false);
  assert.equal(classified.shouldFallbackModel, false);
});

test('parseJsonLenient parses raw JSON, fenced JSON, and extracts embedded JSON', () => {
  assert.deepEqual(parseJsonLenient<{ ok: boolean }>('{"ok":true}'), { ok: true });
  assert.deepEqual(
    parseJsonLenient<{ a: number }>('```json\n{"a": 42}\n```'),
    { a: 42 },
  );
  assert.deepEqual(
    parseJsonLenient<{ b: string }>('Here is the JSON:\n{"b":"ok"}\nThanks!'),
    { b: 'ok' },
  );
  assert.throws(() => parseJsonLenient('   '), /empty response/i);
  assert.throws(() => parseJsonLenient('not json at all'), /invalid json/i);
});

test('runGeminiWithResilience fails over on 429 quota and cools down exhausted model', async () => {
  const tracker = new ModelCooldownTracker();
  const calledModels: string[] = [];
  let fakeNow = 1_000_000;

  const result1 = await runGeminiWithResilience<{ headline: string }>({
    models: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    contextLabel: 'Coach Hishay',
    cooldownTracker: tracker,
    sleep: async () => {},
    now: () => fakeNow,
    invokeModel: async (model) => {
      calledModels.push(model);
      if (model === 'gemini-4-hydrogen') {
        throw new Error(
          JSON.stringify({
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'You exceeded your current quota (free_tier_requests per day).',
            },
          }),
        );
      }
      return '{"headline":"Overhead Triceps Extension"}';
    },
  });

  assert.equal(result1.modelUsed, 'gemini-3.1-flash-lite');
  assert.equal(result1.data.headline, 'Overhead Triceps Extension');
  assert.deepEqual(calledModels, ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);

  // Second request within cooldown goes directly to gemini-3.1-flash-lite!
  calledModels.length = 0;
  fakeNow += 5_000;

  const result2 = await runGeminiWithResilience<{ headline: string }>({
    models: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    contextLabel: 'Coach Hishay',
    cooldownTracker: tracker,
    sleep: async () => {},
    now: () => fakeNow,
    invokeModel: async (model) => {
      calledModels.push(model);
      return '{"headline":"Second Call Fast"}';
    },
  });

  assert.equal(result2.modelUsed, 'gemini-3.1-flash-lite');
  assert.deepEqual(calledModels, ['gemini-3.1-flash-lite']);
});

test('runGeminiWithResilience retries transient 503 and malformed JSON and succeeds', async () => {
  const tracker = new ModelCooldownTracker();
  let callCount = 0;

  const result = await runGeminiWithResilience<{ ok: boolean }>({
    models: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    contextLabel: 'Coach Hishay',
    cooldownTracker: tracker,
    sleep: async () => {},
    invokeModel: async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('503 UNAVAILABLE');
      if (callCount === 2) return 'broken { json';
      return '{"ok":true}';
    },
  });

  assert.equal(callCount, 3);
  assert.deepEqual(result.data, { ok: true });
});

test('LruCache evicts oldest entry when over capacity', () => {
  const cache = new LruCache<number>(2);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1); // refreshes 'a'
  cache.set('c', 3); // should evict 'b'
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
});

test('runGeminiTextWithResilience fails over on 429 and retries empty text responses', async () => {
  const tracker = new ModelCooldownTracker();
  const attempts: string[] = [];

  const result = await runGeminiTextWithResilience({
    models: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    contextLabel: 'Coach Hishay chat',
    cooldownTracker: tracker,
    sleep: async () => {},
    invokeModel: async (model) => {
      attempts.push(model);
      if (model === 'gemini-4-hydrogen') {
        throw new Error(
          JSON.stringify({
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'You exceeded your current quota (free_tier_requests per day).',
            },
          }),
        );
      }
      if (attempts.length === 2) {
        return '   ';
      }
      return 'Keep your ribs tucked and brace hard before pressing.';
    },
  });

  assert.equal(result.modelUsed, 'gemini-3.1-flash-lite');
  assert.equal(
    result.data,
    'Keep your ribs tucked and brace hard before pressing.',
  );
  assert.deepEqual(attempts, [
    'gemini-4-hydrogen',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite',
  ]);
});

