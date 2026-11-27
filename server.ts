import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  buildAiAdjustmentPrompt,
  mergeAiAdjustedPlan,
} from './src/utils/aiPlanMerge.ts';
import type {
  AdjustmentScope,
  AiAdjustPayload,
  DietMode,
} from './src/utils/aiPlanMerge.ts';
import type { DayIndex, WeeklyPlan } from './src/types/plan.ts';
import { parseImportedPlan } from './src/utils/planLogic.ts';
import {
  buildCoachBriefPrompt,
  sanitizeCoachBrief,
} from './src/utils/coachLogic.ts';
import type {
  CoachBrief,
  CoachItemKind,
  CoachSelection,
} from './src/utils/coachLogic.ts';
import {
  buildChatSystemInstruction,
  buildGeminiChatHistory,
  sanitizeChatHistory,
} from './src/utils/chatLogic.ts';
import type { ChatPersona } from './src/utils/chatLogic.ts';
import {
  LruCache,
  ModelCooldownTracker,
  classifyGeminiError,
  parseJsonLenient,
  runGeminiTextWithResilience,
  runGeminiWithResilience,
} from './src/utils/aiResilience.ts';
import type { ClassifiedGeminiError } from './src/utils/aiResilience.ts';
import {
  analyzeWorkoutFocus,
  buildWorkoutVisualBriefPrompt,
  extractYouTubeLinksFromGrounding,
  parseYouTubeUrl,
} from './src/utils/workoutFocusLogic.ts';
import type {
  FocusScope,
  WorkoutVisualAiBrief,
  YouTubeResource,
} from './src/utils/workoutFocusLogic.ts';

const FREE_TIER_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
const modelCooldowns = new ModelCooldownTracker();
const coachBriefCache = new LruCache<CoachBrief>(200);
const visualBriefCache = new LruCache<WorkoutVisualAiBrief>(120);

function isClassifiedGeminiError(err: unknown): err is ClassifiedGeminiError {
  return (
    Boolean(err) &&
    typeof err === 'object' &&
    typeof (err as ClassifiedGeminiError).httpStatus === 'number' &&
    typeof (err as ClassifiedGeminiError).userMessage === 'string' &&
    typeof (err as ClassifiedGeminiError).retryable === 'boolean'
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_DIET_MODES = new Set<string>([
  'keep',
  'vegetarian',
  'flex-vegetarian',
  'eggetarian',
  'vegan',
  'omnivore',
]);

const VALID_SCOPES = new Set<string>(['both', 'training', 'food']);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Concise 1-2 sentence summary of the exact training and/or food adjustments applied.',
    },
    splitLabel: {
      type: Type.STRING,
      description:
        'Optional crisp 2-5 word label when the overall training split structure changed (e.g., "4-Day Upper / Lower", "3-Day Home Dumbbell").',
    },
    caloriesTarget: {
      type: Type.INTEGER,
      description: 'Daily calorie target in kcal.',
    },
    proteinTarget: {
      type: Type.INTEGER,
      description: 'Daily protein target in grams.',
    },
    prepTimeLimit: {
      type: Type.STRING,
      description: 'Must be one of: "30 mins", "60 mins", or "90+ mins".',
    },
    stapleMeals: {
      type: Type.OBJECT,
      properties: {
        breakfast: { type: Type.STRING },
        lunch: { type: Type.STRING },
        dinner: { type: Type.STRING },
        snack: { type: Type.STRING },
      },
      required: ['breakfast', 'lunch', 'dinner', 'snack'],
    },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayIndex: { type: Type.INTEGER },
          workoutTitle: { type: Type.STRING },
          warmup: {
            type: Type.STRING,
            description:
              'Brief muscle-group-specific warm-up movements (5-6 mins) for training days; empty string for rest days.',
          },
          exercises: { type: Type.STRING },
          durationMinutes: { type: Type.INTEGER },
          isRestDay: { type: Type.BOOLEAN },
          mealOverrides: {
            type: Type.OBJECT,
            description:
              'Optional per-day meal overrides. Omit on days that use stapleMeals. When included (e.g. on vegetarian days in flex-vegetarian mode), populate breakfast, lunch, dinner, and snack with 100% compliant dishes.',
            properties: {
              breakfast: { type: Type.STRING },
              lunch: { type: Type.STRING },
              dinner: { type: Type.STRING },
              snack: { type: Type.STRING },
            },
            required: ['breakfast', 'lunch', 'dinner', 'snack'],
          },
        },
        required: [
          'dayIndex',
          'workoutTitle',
          'warmup',
          'exercises',
          'durationMinutes',
          'isRestDay',
        ],
      },
    },
    prepSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 to 6 concise weekly meal prep steps matching the prep time limit.',
    },
    groceryItems: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '6 to 12 consolidated grocery list items with practical quantities.',
    },
  },
  required: [
    'summary',
    'caloriesTarget',
    'proteinTarget',
    'prepTimeLimit',
    'stapleMeals',
    'days',
    'prepSteps',
    'groceryItems',
  ],
};

const EXERCISE_COACH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    coachNote: { type: Type.STRING },
    targetMuscles: { type: Type.ARRAY, items: { type: Type.STRING } },
    formCues: { type: Type.ARRAY, items: { type: Type.STRING } },
    commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
    progressionTip: { type: Type.STRING },
    alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
    followUpAnswer: { type: Type.STRING },
  },
  required: [
    'headline',
    'coachNote',
    'targetMuscles',
    'formCues',
    'commonMistakes',
    'progressionTip',
    'alternatives',
  ],
};

const MEAL_COACH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    coachNote: { type: Type.STRING },
    estimatedMacros: {
      type: Type.OBJECT,
      properties: {
        calories: { type: Type.INTEGER },
        proteinGrams: { type: Type.INTEGER },
        carbsGrams: { type: Type.INTEGER },
        fatGrams: { type: Type.INTEGER },
      },
      required: ['calories', 'proteinGrams', 'carbsGrams', 'fatGrams'],
    },
    goalFitNote: { type: Type.STRING },
    timingAndMicros: { type: Type.STRING },
    prepTips: { type: Type.ARRAY, items: { type: Type.STRING } },
    smartSwaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    followUpAnswer: { type: Type.STRING },
  },
  required: [
    'headline',
    'coachNote',
    'estimatedMacros',
    'goalFitNote',
    'timingAndMicros',
    'prepTips',
    'smartSwaps',
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/ai/adjust-plan', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid request payload.' });
        return;
      }

      const planValidation = parseImportedPlan(
        JSON.stringify(body.currentPlan ?? null),
      );
      if (!planValidation.ok) {
        res.status(400).json({ error: planValidation.error });
        return;
      }
      const currentPlan: WeeklyPlan = planValidation.plan;

      const instruction =
        typeof body.instruction === 'string' ? body.instruction.trim() : '';
      const dietMode: DietMode =
        typeof body.dietMode === 'string' && VALID_DIET_MODES.has(body.dietMode)
          ? (body.dietMode as DietMode)
          : 'keep';
      const scope: AdjustmentScope =
        typeof body.scope === 'string' && VALID_SCOPES.has(body.scope)
          ? (body.scope as AdjustmentScope)
          : 'both';
      const vegetarianDays: DayIndex[] = Array.isArray(body.vegetarianDays)
        ? body.vegetarianDays
            .filter(
              (n): n is DayIndex =>
                typeof n === 'number' &&
                Number.isInteger(n) &&
                n >= 0 &&
                n <= 6,
            )
        : [];

      if (!instruction && dietMode === 'keep') {
        res.status(400).json({
          error:
            'Enter a training or food instruction, or choose a dietary preference.',
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'AI plan generation is not configured yet. Please check your Gemini API key in Settings > Secrets.',
        });
        return;
      }

      // If the user explicitly chose a dietary mode other than 'keep' while scope was 'training',
      // widen scope to 'both' so dietary preferences are never silently discarded.
      const effectiveScope: AdjustmentScope =
        scope === 'training' && dietMode !== 'keep' ? 'both' : scope;

      const prompt = buildAiAdjustmentPrompt({
        currentPlan,
        instruction,
        dietMode,
        vegetarianDays,
        scope: effectiveScope,
      });

      const systemInstruction =
        'You are an experienced strength & conditioning coach and sports nutritionist. Tailor weekly workout splits and high-protein meal plans precisely to the user constraints, including full or partial-week vegetarian days, while keeping entries concise enough to fit cleanly on a single-page weekly command sheet. Always apply concrete modifications to the requested fields rather than echoing the input unchanged.';

      let mergedResult: ReturnType<typeof mergeAiAdjustedPlan> | null = null;

      await runGeminiWithResilience<AiAdjustPayload>({
        models: FREE_TIER_MODELS,
        contextLabel: 'AI planner',
        cooldownTracker: modelCooldowns,
        timeoutMs: 25000,
        validateParsed: (parsedPayload) => {
          const candidate = mergeAiAdjustedPlan(
            currentPlan,
            parsedPayload,
            effectiveScope,
            { dietMode, vegetarianDays },
          );
          if (!candidate.changes.hasChanges) {
            throw new Error(
              'Model returned an empty response with no plan changes.',
            );
          }
          mergedResult = candidate;
        },
        invokeModel: async (model) => {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: PLAN_RESPONSE_SCHEMA,
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });
          return response.text;
        },
      });

      if (!mergedResult) {
        res.status(503).json({
          error:
            'AI planner could not generate concrete changes for that request. Please try rephrasing or widening the adjustment scope.',
          retryable: true,
        });
        return;
      }

      res.json(mergedResult);
    } catch (err: unknown) {
      const classified = isClassifiedGeminiError(err)
        ? err
        : classifyGeminiError(err, 'AI planner');
      res.status(classified.httpStatus).json({
        error: classified.userMessage,
        retryable: classified.retryable,
      });
    }
  });

  app.post('/api/ai/coach-brief', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid request payload.' });
        return;
      }

      const rawSel =
        body.selection && typeof body.selection === 'object'
          ? (body.selection as Record<string, unknown>)
          : null;
      const kind: CoachItemKind | null =
        rawSel?.kind === 'exercise' || rawSel?.kind === 'meal'
          ? rawSel.kind
          : null;
      const title =
        typeof rawSel?.title === 'string' ? rawSel.title.trim() : '';

      if (!rawSel || !kind || !title) {
        res.status(400).json({
          error: 'Select an exercise or meal to inspect with Coach Hishay.',
        });
        return;
      }

      const selection: CoachSelection = {
        kind,
        dayIndex:
          typeof rawSel.dayIndex === 'number' &&
          Number.isInteger(rawSel.dayIndex)
            ? Math.max(0, Math.min(6, rawSel.dayIndex))
            : 0,
        dayName:
          typeof rawSel.dayName === 'string' && rawSel.dayName.trim()
            ? rawSel.dayName.trim()
            : 'Monday',
        title,
        mealSlot:
          rawSel.mealSlot === 'breakfast' ||
          rawSel.mealSlot === 'lunch' ||
          rawSel.mealSlot === 'dinner' ||
          rawSel.mealSlot === 'snack'
            ? rawSel.mealSlot
            : undefined,
        workoutContext:
          typeof rawSel.workoutContext === 'string'
            ? rawSel.workoutContext.trim()
            : undefined,
      };

      const rawCtx =
        body.planContext && typeof body.planContext === 'object'
          ? (body.planContext as Record<string, unknown>)
          : {};
      const planContext = {
        caloriesTarget:
          typeof rawCtx.caloriesTarget === 'number' &&
          Number.isFinite(rawCtx.caloriesTarget)
            ? Math.round(rawCtx.caloriesTarget)
            : 2200,
        proteinTarget:
          typeof rawCtx.proteinTarget === 'number' &&
          Number.isFinite(rawCtx.proteinTarget)
            ? Math.round(rawCtx.proteinTarget)
            : 160,
        prepTimeLimit:
          rawCtx.prepTimeLimit === '30 mins' ||
          rawCtx.prepTimeLimit === '60 mins' ||
          rawCtx.prepTimeLimit === '90+ mins'
            ? (rawCtx.prepTimeLimit as '30 mins' | '60 mins' | '90+ mins')
            : ('60 mins' as const),
        holidayTag:
          typeof rawCtx.holidayTag === 'string' && rawCtx.holidayTag.trim()
            ? rawCtx.holidayTag.trim()
            : 'Normal Week',
      };

      const followUpQuestion =
        typeof body.followUpQuestion === 'string'
          ? body.followUpQuestion.trim()
          : undefined;

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'AI coach is not configured yet. Please check your Gemini API key in Settings > Secrets.',
        });
        return;
      }

      const prompt = buildCoachBriefPrompt({
        selection,
        planContext,
        followUpQuestion,
      });

      const systemInstruction =
        'You are Coach Hishay, a certified strength & conditioning specialist (CSCS) and sports nutritionist. Speak directly, concisely, and encouragingly in plain English with evidence-based biomechanics and nutrition advice. Avoid fluff and keep bullet points tight and immediately actionable.';

      const schema =
        kind === 'exercise' ? EXERCISE_COACH_SCHEMA : MEAL_COACH_SCHEMA;

      const cacheKey = [
        kind,
        title.toLowerCase(),
        selection.mealSlot ?? '',
        (selection.workoutContext ?? '').toLowerCase(),
        planContext.caloriesTarget,
        planContext.proteinTarget,
        planContext.prepTimeLimit,
        planContext.holidayTag.toLowerCase(),
      ].join('|');

      if (!followUpQuestion) {
        const cachedBrief = coachBriefCache.get(cacheKey);
        if (cachedBrief) {
          res.json({ brief: cachedBrief });
          return;
        }
      }

      const { data: parsed } = await runGeminiWithResilience<
        Record<string, unknown>
      >({
        models: FREE_TIER_MODELS,
        contextLabel: 'Coach Hishay',
        cooldownTracker: modelCooldowns,
        timeoutMs: 22000,
        invokeModel: async (model) => {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: schema,
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });
          return response.text;
        },
      });

      const brief = sanitizeCoachBrief(parsed, kind);
      if (!followUpQuestion) {
        delete brief.followUpAnswer;
        coachBriefCache.set(cacheKey, brief);
      }
      res.json({ brief });
    } catch (err: unknown) {
      const classified = isClassifiedGeminiError(err)
        ? err
        : classifyGeminiError(err, 'Coach Hishay');
      res.status(classified.httpStatus).json({
        error: classified.userMessage,
        retryable: classified.retryable,
      });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid chat request payload.' });
        return;
      }

      const persona: ChatPersona =
        body.persona === 'adjuster' ? 'adjuster' : 'coach';
      const message =
        typeof body.message === 'string' ? body.message.trim() : '';

      if (!message) {
        res.status(400).json({ error: 'Enter a message to send.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'AI chat is not configured yet. Please check your Gemini API key in Settings > Secrets.',
        });
        return;
      }

      let currentPlan: WeeklyPlan | null = null;
      if (body.currentPlan && typeof body.currentPlan === 'object') {
        const parsedPlan = parseImportedPlan(JSON.stringify(body.currentPlan));
        if (parsedPlan.ok) {
          currentPlan = parsedPlan.plan;
        }
      }

      let selection: CoachSelection | null = null;
      if (body.selection && typeof body.selection === 'object') {
        const rawSel = body.selection as Record<string, unknown>;
        if (
          (rawSel.kind === 'exercise' || rawSel.kind === 'meal') &&
          typeof rawSel.title === 'string' &&
          rawSel.title.trim()
        ) {
          selection = {
            kind: rawSel.kind,
            dayIndex:
              typeof rawSel.dayIndex === 'number' &&
              Number.isInteger(rawSel.dayIndex)
                ? Math.max(0, Math.min(6, rawSel.dayIndex))
                : 0,
            dayName:
              typeof rawSel.dayName === 'string' && rawSel.dayName.trim()
                ? rawSel.dayName.trim()
                : 'Monday',
            title: rawSel.title.trim(),
            mealSlot:
              rawSel.mealSlot === 'breakfast' ||
              rawSel.mealSlot === 'lunch' ||
              rawSel.mealSlot === 'dinner' ||
              rawSel.mealSlot === 'snack'
                ? rawSel.mealSlot
                : undefined,
            workoutContext:
              typeof rawSel.workoutContext === 'string'
                ? rawSel.workoutContext.trim()
                : undefined,
          };
        }
      }

      const historyTurns = sanitizeChatHistory(body.history, 20);
      const geminiHistory = buildGeminiChatHistory(historyTurns);
      const systemInstruction = buildChatSystemInstruction(
        persona,
        currentPlan,
        selection,
      );
      const contextLabel =
        persona === 'coach' ? 'Coach Hishay chat' : 'AI Plan Architect chat';

      const { data: reply, modelUsed } = await runGeminiTextWithResilience({
        models: FREE_TIER_MODELS,
        contextLabel,
        cooldownTracker: modelCooldowns,
        timeoutMs: 22000,
        invokeModel: async (model) => {
          const chat = ai.chats.create({
            model,
            history: geminiHistory,
            config: {
              systemInstruction,
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });
          const response = await chat.sendMessage({
            message: message.slice(0, 2000),
          });
          return response.text;
        },
      });

      res.json({ reply, modelUsed });
    } catch (err: unknown) {
      const classified = isClassifiedGeminiError(err)
        ? err
        : classifyGeminiError(err, 'AI chat');
      res.status(classified.httpStatus).json({
        error: classified.userMessage,
        retryable: classified.retryable,
      });
    }
  });

  app.post('/api/ai/workout-visual-brief', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid request payload.' });
        return;
      }

      const planValidation = parseImportedPlan(
        JSON.stringify(body.currentPlan ?? null),
      );
      if (!planValidation.ok) {
        res.status(400).json({ error: planValidation.error });
        return;
      }
      const currentPlan = planValidation.plan;

      const rawScope = body.scope;
      const scope: FocusScope =
        typeof rawScope === 'number' &&
        Number.isInteger(rawScope) &&
        rawScope >= 0 &&
        rawScope <= 6
          ? (rawScope as DayIndex)
          : 'week';

      const focus = analyzeWorkoutFocus(currentPlan, scope);
      const cacheKey = [
        scope,
        focus.category,
        focus.focusTitle.toLowerCase(),
        focus.keyExercises.join('|').toLowerCase(),
      ].join('::');

      const forceRefresh = body.forceRefresh === true;
      if (!forceRefresh) {
        const cached = visualBriefCache.get(cacheKey);
        if (cached) {
          res.json({ brief: cached, focus });
          return;
        }
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'AI video & coaching guide is not configured yet. Please check your Gemini API key in Settings > Secrets.',
        });
        return;
      }

      const prompt = buildWorkoutVisualBriefPrompt(focus);
      const systemInstruction =
        'You are an evidence-based strength & conditioning specialist. Use Google Search to locate real, currently accessible YouTube form and workout routine tutorials matching the user plan, and return concise infographic coaching cues as valid JSON.';

      let groundedVideos: YouTubeResource[] = [];

      const { data: rawText } = await runGeminiTextWithResilience({
        models: FREE_TIER_MODELS,
        contextLabel: 'Workout visual & video guide',
        cooldownTracker: modelCooldowns,
        timeoutMs: 25000,
        invokeModel: async (model) => {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });

          const chunks =
            response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          groundedVideos = extractYouTubeLinksFromGrounding(
            chunks,
            response.text ?? '',
            focus.focusTitle,
          );

          return response.text;
        },
      });

      let parsed: Record<string, unknown> = {};
      try {
        parsed = parseJsonLenient<Record<string, unknown>>(rawText);
      } catch {
        parsed = {};
      }

      const parsedVideos: YouTubeResource[] = [];
      const seen = new Set<string>();

      for (const v of groundedVideos) {
        const key = v.videoId ?? v.url;
        if (!seen.has(key)) {
          seen.add(key);
          parsedVideos.push(v);
        }
      }

      if (Array.isArray(parsed.videos)) {
        for (const item of parsed.videos) {
          if (!item || typeof item !== 'object') continue;
          const obj = item as Record<string, unknown>;
          if (typeof obj.url !== 'string') continue;
          const valid = parseYouTubeUrl(obj.url);
          if (!valid.ok) continue;
          const key = valid.videoId ?? valid.url;
          const existing = parsedVideos.find((v) => (v.videoId ?? v.url) === key);
          if (existing) {
            // Enrich grounded video with crisp title/channel if available
            if (typeof obj.title === 'string' && obj.title.trim()) {
              existing.title = obj.title.trim();
            }
            if (typeof obj.channel === 'string' && obj.channel.trim()) {
              existing.channel = obj.channel.trim();
            }
            continue;
          }
          // Only append model-mentioned videos if they have a valid watch ID or search link
          if (valid.videoId) {
            seen.add(key);
            parsedVideos.push({
              title:
                typeof obj.title === 'string' && obj.title.trim()
                  ? obj.title.trim()
                  : focus.focusTitle,
              url: valid.url,
              videoId: valid.videoId,
              channel:
                typeof obj.channel === 'string' && obj.channel.trim()
                  ? obj.channel.trim()
                  : undefined,
              source: 'ai-grounded',
            });
          }
        }
      }

      const formCues = Array.isArray(parsed.formCues)
        ? parsed.formCues
            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim())
            .slice(0, 3)
        : [];

      const targetMuscles = Array.isArray(parsed.targetMuscles)
        ? parsed.targetMuscles
            .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
            .map((m) => m.trim())
            .slice(0, 4)
        : [];

      const brief: WorkoutVisualAiBrief = {
        headline:
          typeof parsed.headline === 'string' && parsed.headline.trim()
            ? parsed.headline.trim()
            : focus.focusTitle,
        intensityNote:
          typeof parsed.intensityNote === 'string' && parsed.intensityNote.trim()
            ? parsed.intensityNote.trim()
            : focus.tempoNote,
        formCues: formCues.length > 0 ? formCues : focus.defaultFormCues,
        targetMuscles:
          targetMuscles.length > 0 ? targetMuscles : focus.targetMuscles,
        videos: parsedVideos.slice(0, 3),
        searchQuery:
          typeof parsed.searchQuery === 'string' && parsed.searchQuery.trim()
            ? parsed.searchQuery.trim()
            : focus.youtubeSearchQuery,
      };

      visualBriefCache.set(cacheKey, brief);
      res.json({ brief, focus });
    } catch (err: unknown) {
      const classified = isClassifiedGeminiError(err)
        ? err
        : classifyGeminiError(err, 'Workout visual & video guide');
      res.status(classified.httpStatus).json({
        error: classified.userMessage,
        retryable: classified.retryable,
      });
    }
  });

  // Always return clean JSON for any unexpected /api/* error (e.g., malformed JSON body)
  app.use(
    '/api',
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        err &&
        typeof err === 'object' &&
        typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 500;
      const message =
        status === 400
          ? 'Invalid JSON request payload.'
          : 'Unexpected server error. Please try again.';
      res.status(status).json({ error: message, retryable: status >= 500 });
    },
  );

  const distDir = path.resolve(__dirname, 'dist');
  const distIndex = path.join(distDir, 'index.html');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    (process.env.VITE_DEV !== 'true' && fs.existsSync(distIndex));

  const httpServer = http.createServer(app);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

startServer();
