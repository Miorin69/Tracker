export interface ClassifiedGeminiError {
  httpStatus: number;
  rpcStatus: string;
  rawMessage: string;
  userMessage: string;
  retryable: boolean;
  shouldFallbackModel: boolean;
  cooldownMs: number;
}

function extractErrorDetails(err: unknown): {
  status?: number;
  rpcStatus: string;
  message: string;
} {
  let status: number | undefined;
  let rpcStatus = '';
  let message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Unexpected AI service error';

  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.status === 'number') status = obj.status;
    else if (typeof obj.code === 'number') status = obj.code;
    if (typeof obj.statusText === 'string') rpcStatus = obj.statusText;
  }

  // Unwrap JSON-encoded SDK error strings (including nested JSON)
  const trimmed = message.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        error?: {
          code?: number;
          message?: string;
          status?: string;
        };
      };
      if (parsed?.error) {
        if (typeof parsed.error.code === 'number') status = parsed.error.code;
        if (typeof parsed.error.status === 'string') {
          rpcStatus = parsed.error.status;
        }
        if (typeof parsed.error.message === 'string') {
          message = parsed.error.message;
        }
      }
    } catch {
      // Not valid JSON; keep original message
    }
  }

  return { status, rpcStatus, message };
}

export function classifyGeminiError(
  err: unknown,
  contextLabel = 'AI service',
): ClassifiedGeminiError {
  const { status, rpcStatus, message } = extractErrorDetails(err);
  const lowerMsg = message.toLowerCase();
  const upperRpc = rpcStatus.toUpperCase();

  // Auth / API key errors — never retry, never fall back
  if (
    status === 401 ||
    status === 403 ||
    upperRpc === 'PERMISSION_DENIED' ||
    upperRpc === 'UNAUTHENTICATED' ||
    lowerMsg.includes('api_key_invalid') ||
    lowerMsg.includes('api key not valid') ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('insufficient authentication scopes')
  ) {
    return {
      httpStatus: 403,
      rpcStatus: upperRpc || 'PERMISSION_DENIED',
      rawMessage: message,
      userMessage:
        'Gemini API authentication failed. Please check your API key in Settings > Secrets.',
      retryable: false,
      shouldFallbackModel: false,
      cooldownMs: 0,
    };
  }

  // Model not found / unsupported — immediately try fallback model
  if (
    status === 404 ||
    upperRpc === 'NOT_FOUND' ||
    lowerMsg.includes('is not found') ||
    lowerMsg.includes('not supported for generatecontent')
  ) {
    return {
      httpStatus: 502,
      rpcStatus: upperRpc || 'NOT_FOUND',
      rawMessage: message,
      userMessage: `${contextLabel} model is temporarily unavailable. Please try again.`,
      retryable: true,
      shouldFallbackModel: true,
      cooldownMs: 10 * 60 * 1000,
    };
  }

  // Quota / Rate limit (429 / RESOURCE_EXHAUSTED) — switch to fallback model immediately!
  if (
    status === 429 ||
    upperRpc === 'RESOURCE_EXHAUSTED' ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('exceeded your current quota') ||
    lowerMsg.includes('quota exceeded') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('too many requests')
  ) {
    const isDailyQuota =
      lowerMsg.includes('per day') ||
      lowerMsg.includes('free_tier_requests') ||
      lowerMsg.includes('retry in ');
    return {
      httpStatus: 429,
      rpcStatus: upperRpc || 'RESOURCE_EXHAUSTED',
      rawMessage: message,
      userMessage:
        'AI quota or rate limit reached. Wait a moment to retry, or select a billing-enabled API key in Settings > Secrets for higher limits.',
      retryable: !isDailyQuota,
      shouldFallbackModel: true,
      cooldownMs: isDailyQuota ? 10 * 60 * 1000 : 30 * 1000,
    };
  }

  // Transient upstream availability / timeout / network / parse errors
  if (
    status === 408 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    upperRpc === 'UNAVAILABLE' ||
    upperRpc === 'DEADLINE_EXCEEDED' ||
    upperRpc === 'INTERNAL' ||
    upperRpc === 'ABORTED' ||
    lowerMsg.includes('503') ||
    lowerMsg.includes('502') ||
    lowerMsg.includes('504') ||
    lowerMsg.includes('unavailable') ||
    lowerMsg.includes('high demand') ||
    lowerMsg.includes('overloaded') ||
    lowerMsg.includes('deadline') ||
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('socket') ||
    lowerMsg.includes('empty response') ||
    lowerMsg.includes('invalid json')
  ) {
    return {
      httpStatus: 503,
      rpcStatus: upperRpc || 'UNAVAILABLE',
      rawMessage: message,
      userMessage: `${contextLabel} is temporarily busy. Please try again in a few seconds.`,
      retryable: true,
      shouldFallbackModel: true,
      cooldownMs: 15 * 1000,
    };
  }

  // Bad request (e.g. unsupported config on a specific model)
  if (status === 400 || upperRpc === 'INVALID_ARGUMENT') {
    return {
      httpStatus: 400,
      rpcStatus: upperRpc || 'INVALID_ARGUMENT',
      rawMessage: message,
      userMessage: `${contextLabel} could not process this request. Please check your input and try again.`,
      retryable: false,
      shouldFallbackModel: false,
      cooldownMs: 0,
    };
  }

  return {
    httpStatus: 500,
    rpcStatus: upperRpc || 'INTERNAL',
    rawMessage: message,
    userMessage: `${contextLabel} encountered an unexpected error. Please try again.`,
    retryable: true,
    shouldFallbackModel: true,
    cooldownMs: 0,
  };
}

/**
 * Parses JSON returned by a model, stripping accidental markdown code fences
 * or stray surrounding commentary before failing.
 */
export function parseJsonLenient<T>(rawText: string): T {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Model returned an empty response.');
  }

  // 1. Direct parse
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Continue to cleanup strategies
  }

  // 2. Strip ```json ... ``` or ``` ... ``` fences
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {
      // Continue
    }
  }

  // 3. Extract outermost JSON object
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      // Fall through to throw
    }
  }

  throw new Error('Model returned invalid JSON.');
}

export class ModelCooldownTracker {
  private readonly cooldownUntil = new Map<string, number>();

  isCoolingDown(model: string, now = Date.now()): boolean {
    const until = this.cooldownUntil.get(model);
    if (!until) return false;
    if (now >= until) {
      this.cooldownUntil.delete(model);
      return false;
    }
    return true;
  }

  markCooldown(model: string, durationMs: number, now = Date.now()): void {
    if (durationMs <= 0) return;
    this.cooldownUntil.set(model, now + durationMs);
  }

  clear(): void {
    this.cooldownUntil.clear();
  }
}

export interface ResilientGeminiOptions<T> {
  models: readonly string[];
  contextLabel: string;
  cooldownTracker: ModelCooldownTracker;
  invokeModel: (model: string) => Promise<string | undefined>;
  timeoutMs?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  validateParsed?: (parsed: T) => void;
}

export interface ResilientGeminiResult<T> {
  data: T;
  modelUsed: string;
  attempts: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Executes a Gemini JSON generation task across ordered candidate models with:
 * - Automatic cooldown skipping for recently quota-exhausted models
 * - Per-attempt timeout protection (prevents hung Cloud Run 504s)
 * - Lenient JSON fence cleanup & retry on empty/malformed output
 * - Automatic model failover (e.g., gemini-4-hydrogen -> gemini-3.1-flash-lite)
 * - Short backoff retry on transient 503/network errors
 */
export async function runGeminiWithResilience<T>(
  opts: ResilientGeminiOptions<T>,
): Promise<ResilientGeminiResult<T>> {
  const {
    models,
    contextLabel,
    cooldownTracker,
    invokeModel,
    timeoutMs = 24000,
    retryDelayMs = 450,
    sleep = defaultSleep,
    now = Date.now,
    validateParsed,
  } = opts;

  const currentNow = now();
  const activeModels = models.filter(
    (m) => !cooldownTracker.isCoolingDown(m, currentNow),
  );
  // If every model is cooling down, still try the full list so we don't block recovery
  const orderedModels = activeModels.length > 0 ? activeModels : [...models];

  // Build attempt schedule: try each model once, plus one backoff retry on the
  // most reliable fallback model if transient errors occurred.
  const schedule: Array<{ model: string; delayMs: number }> = orderedModels.map(
    (model, idx) => ({
      model,
      delayMs: idx === 0 ? 0 : Math.min(retryDelayMs * idx, 1200),
    }),
  );
  if (orderedModels.length > 0) {
    const fallbackModel = orderedModels[orderedModels.length - 1];
    schedule.push({ model: fallbackModel, delayMs: retryDelayMs * 2 });
  }

  let lastClassified: ClassifiedGeminiError | null = null;
  let attempts = 0;

  for (let i = 0; i < schedule.length; i++) {
    const step = schedule[i];
    // Skip duplicate retry step if the previous error was quota/404 on this exact model
    if (
      i === schedule.length - 1 &&
      lastClassified &&
      !lastClassified.retryable
    ) {
      break;
    }

    if (step.delayMs > 0 && attempts > 0) {
      await sleep(step.delayMs);
    }

    attempts += 1;
    try {
      const rawText = await withTimeout(invokeModel(step.model), timeoutMs);
      const parsed = parseJsonLenient<T>(rawText ?? '');
      if (validateParsed) {
        validateParsed(parsed);
      }
      return { data: parsed, modelUsed: step.model, attempts };
    } catch (err: unknown) {
      const classified = classifyGeminiError(err, contextLabel);
      lastClassified = classified;

      console.warn(
        `[${contextLabel}] ${step.model} failed (${classified.httpStatus} ${classified.rpcStatus}): ${classified.rawMessage.slice(0, 180)}`,
      );

      if (classified.cooldownMs > 0) {
        cooldownTracker.markCooldown(step.model, classified.cooldownMs, now());
      }

      // Immediately abort on auth or bad-input errors
      if (!classified.shouldFallbackModel && !classified.retryable) {
        throw classified;
      }
    }
  }

  throw (
    lastClassified ?? {
      httpStatus: 503,
      rpcStatus: 'UNAVAILABLE',
      rawMessage: 'All model attempts failed',
      userMessage: `${contextLabel} is temporarily busy. Please try again in a few seconds.`,
      retryable: true,
      shouldFallbackModel: false,
      cooldownMs: 0,
    }
  );
}

/**
 * Executes a plain-text Gemini generation/chat call across ordered candidate
 * models with cooldown tracking, timeout protection, and automatic failover.
 */
export async function runGeminiTextWithResilience(
  opts: Omit<ResilientGeminiOptions<string>, 'validateParsed'>,
): Promise<ResilientGeminiResult<string>> {
  const {
    models,
    contextLabel,
    cooldownTracker,
    invokeModel,
    timeoutMs = 22000,
    retryDelayMs = 450,
    sleep = defaultSleep,
    now = Date.now,
  } = opts;

  const currentNow = now();
  const activeModels = models.filter(
    (m) => !cooldownTracker.isCoolingDown(m, currentNow),
  );
  const orderedModels = activeModels.length > 0 ? activeModels : [...models];

  const schedule: Array<{ model: string; delayMs: number }> = orderedModels.map(
    (model, idx) => ({
      model,
      delayMs: idx === 0 ? 0 : Math.min(retryDelayMs * idx, 1200),
    }),
  );
  if (orderedModels.length > 0) {
    const fallbackModel = orderedModels[orderedModels.length - 1];
    schedule.push({ model: fallbackModel, delayMs: retryDelayMs * 2 });
  }

  let lastClassified: ClassifiedGeminiError | null = null;
  let attempts = 0;

  for (let i = 0; i < schedule.length; i++) {
    const step = schedule[i];
    if (
      i === schedule.length - 1 &&
      lastClassified &&
      !lastClassified.retryable
    ) {
      break;
    }

    if (step.delayMs > 0 && attempts > 0) {
      await sleep(step.delayMs);
    }

    attempts += 1;
    try {
      const rawText = await withTimeout(invokeModel(step.model), timeoutMs);
      const trimmed = (rawText ?? '').trim();
      if (!trimmed) {
        throw new Error('Model returned an empty response.');
      }
      return { data: trimmed, modelUsed: step.model, attempts };
    } catch (err: unknown) {
      const classified = classifyGeminiError(err, contextLabel);
      lastClassified = classified;

      console.warn(
        `[${contextLabel}] ${step.model} failed (${classified.httpStatus} ${classified.rpcStatus}): ${classified.rawMessage.slice(0, 180)}`,
      );

      if (classified.cooldownMs > 0) {
        cooldownTracker.markCooldown(step.model, classified.cooldownMs, now());
      }

      if (!classified.shouldFallbackModel && !classified.retryable) {
        throw classified;
      }
    }
  }

  throw (
    lastClassified ?? {
      httpStatus: 503,
      rpcStatus: 'UNAVAILABLE',
      rawMessage: 'All model attempts failed',
      userMessage: `${contextLabel} is temporarily busy. Please try again in a few seconds.`,
      retryable: true,
      shouldFallbackModel: false,
      cooldownMs: 0,
    }
  );
}

export class LruCache<T> {
  private readonly store = new Map<string, T>();
  private readonly maxEntries: number;

  constructor(maxEntries = 150) {
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const val = this.store.get(key);
    if (val === undefined) return undefined;
    // Refresh recency
    this.store.delete(key);
    this.store.set(key, val);
    return val;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
  }

  get size(): number {
    return this.store.size;
  }
}
