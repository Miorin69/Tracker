import { DAY_NAMES, PREP_TIME_LIMITS } from '../data/presets.ts';
import type {
  ChecklistItem,
  DayIndex,
  DayMealOverrides,
  DaySchedule,
  PrepTimeLimit,
  StapleMeals,
  WeeklyPlan,
} from '../types/plan.ts';
import { recommendWarmupForSession } from './warmupLogic.ts';

export type DietMode =
  | 'keep'
  | 'vegetarian'
  | 'flex-vegetarian'
  | 'eggetarian'
  | 'vegan'
  | 'omnivore';

export type AdjustmentScope = 'both' | 'training' | 'food';

export interface AiAdjustRequest {
  currentPlan: WeeklyPlan;
  instruction: string;
  dietMode: DietMode;
  vegetarianDays: DayIndex[];
  scope: AdjustmentScope;
}

export interface AiDayOutput {
  dayIndex?: number | string;
  workoutTitle?: string;
  warmup?: string;
  exercises?: string;
  durationMinutes?: number | string;
  isRestDay?: boolean;
  mealOverrides?: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    snack?: string;
  } | null;
}

export interface AiAdjustPayload {
  summary?: string;
  splitLabel?: string;
  caloriesTarget?: number | string;
  proteinTarget?: number | string;
  prepTimeLimit?: string;
  stapleMeals?: Partial<StapleMeals>;
  days?: AiDayOutput[];
  prepSteps?: string[];
  groceryItems?: string[];
}

export interface MergeAiOptions {
  dietMode?: DietMode;
  vegetarianDays?: DayIndex[];
}

export interface PlanChangeSummary {
  hasChanges: boolean;
  changedDayIndices: DayIndex[];
  highlights: string[];
}

const DIET_LABELS: Record<DietMode, string> = {
  keep: 'Follow any dietary or food preferences mentioned in USER REQUEST; keep other meals high-protein and practical.',
  vegetarian:
    'Strictly 100% Vegetarian (no meat, poultry, fish, seafood, or eggs — replace ALL meat/fish/egg items in stapleMeals with high-protein paneer, tofu, Greek yogurt, whey/plant protein, lentils, chickpeas, edamame, cottage cheese, or soya chunks). Set mealOverrides to empty/null unless specific day menus are requested.',
  'flex-vegetarian':
    'Flexitarian / Mixed Week (vegetarian meals ONLY on the specified vegetarian days via day-level mealOverrides, while keeping standard high-protein staple meals on non-vegetarian days)',
  eggetarian:
    'Vegetarian + Eggs (no meat, poultry, or fish; eggs, dairy, paneer, tofu, legumes, and whey allowed). Replace any meat/fish items in stapleMeals and clear stale mealOverrides.',
  vegan:
    '100% Plant-Based / Vegan (no meat, fish, dairy, or eggs — replace ALL animal items in stapleMeals with tofu, tempeh, seitan, edamame, lentils, pea/soy protein) and clear stale mealOverrides.',
  omnivore:
    'High-Protein Omnivore (lean meats, poultry, fish, eggs, dairy, and plant proteins). Clear stale mealOverrides unless specific day overrides are requested.',
};

const FULL_WEEK_DIET_MODES = new Set<DietMode>([
  'vegetarian',
  'eggetarian',
  'vegan',
  'omnivore',
]);

export function buildAiAdjustmentPrompt(req: AiAdjustRequest): string {
  const vegDayNames = req.vegetarianDays
    .filter((d) => d >= 0 && d <= 6)
    .map((d) => `${DAY_NAMES[d].full} (dayIndex ${d})`);

  const scopeDirective =
    req.scope === 'training'
      ? 'ONLY adjust training workouts, warmups, exercises, durations, and rest days. Keep stapleMeals, day mealOverrides, prepSteps, and groceryItems aligned with the existing food plan.'
      : req.scope === 'food'
        ? 'ONLY adjust meals (stapleMeals, day mealOverrides), calorie/protein targets if requested, prepSteps, and groceryItems to hit the dietary rules. Keep all 7 training workouts, exercises, durations, and rest days identical to the current plan.'
        : 'Adjust BOTH training schedule and food/meal prep + grocery list cohesively so training days and nutrition support each other.';

  const vegLine =
    req.dietMode === 'flex-vegetarian'
      ? vegDayNames.length > 0
        ? `Vegetarian days requested: ${vegDayNames.join(', ')}. MANDATORY: For EVERY ONE of these vegetarian dayIndex entries, you MUST populate ALL FOUR fields (breakfast, lunch, dinner, AND snack) inside mealOverrides with 100% vegetarian, meat-free, poultry-free, fish-free high-protein dishes (do NOT skip dinner even if the current dinner mentions paneer). Keep non-vegetarian stapleMeals for the other days, and include both vegetarian and regular ingredients in groceryItems and prepSteps.`
        : 'User chose flexible vegetarian mode — make 2–3 days 100% high-protein vegetarian by populating ALL FOUR fields (breakfast, lunch, dinner, snack) in mealOverrides on those days.'
      : DIET_LABELS[req.dietMode];

  const userGoal =
    req.instruction.trim() ||
    'Optimize training and meals to concretely fulfill the selected dietary preference.';

  return [
    'Update the user weekly training and meal prep plan according to their preferences.',
    '',
    `ADJUSTMENT SCOPE: ${scopeDirective}`,
    `DIETARY PREFERENCE: ${vegLine}`,
    `USER REQUEST: ${userGoal}`,
    '',
    'CURRENT PLAN (JSON):',
    JSON.stringify({
      weekStartDate: req.currentPlan.weekStartDate,
      holidayTag: req.currentPlan.holidayTag,
      holidayNotes: req.currentPlan.holidayNotes ?? '',
      caloriesTarget: req.currentPlan.caloriesTarget,
      proteinTarget: req.currentPlan.proteinTarget,
      prepTimeLimit: req.currentPlan.prepTimeLimit,
      stapleMeals: req.currentPlan.stapleMeals,
      days: req.currentPlan.days.map((d) => ({
        dayIndex: d.dayIndex,
        dayName: d.dayName,
        workoutTitle: d.workoutTitle,
        warmup: d.warmup ?? '',
        exercises: d.exercises,
        durationMinutes: d.durationMinutes,
        isRestDay: d.isRestDay,
        mealOverrides: d.mealOverrides ?? null,
      })),
    }),
    '',
    'CRITICAL REQUIREMENTS:',
    '- You MUST make concrete, visible modifications to the relevant fields (workoutTitle, warmup, exercises, durationMinutes, stapleMeals, mealOverrides, caloriesTarget, proteinTarget, prepSteps, groceryItems) that directly satisfy the USER REQUEST and DIETARY PREFERENCE. Never return the CURRENT PLAN unchanged.',
    '- Return exactly 7 days with 0-based dayIndex 0 (Monday) through 6 (Sunday).',
    '- If you significantly change the overall training split structure (e.g., to a 4-day Upper/Lower, 3-day Full Body, home dumbbell split, or custom routine), set splitLabel to a crisp 2-5 word name describing the new split.',
    '- For every training day (isRestDay: false), include a brief, muscle-group-specific warmup string (5-6 mins, 3-4 specific mobility/activation movements matched to that session). Use an empty string "" for rest days.',
    '- Keep workout exercises crisp, practical, and concise (sets x reps format) so the 7-day sheet prints cleanly on one page.',
    '- Keep meal descriptions realistic, concise, with rough gram portions that realistically approach the daily calorie and protein targets.',
    '- Provide 3–6 concise prepSteps matching the prepTimeLimit and 6–12 consolidated groceryItems covering all meals (including vegetarian proteins if any day is vegetarian).',
    '- Provide a clear 1-2 sentence summary describing the exact changes you applied.',
  ].join('\n');
}

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function cleanMealOverrides(
  raw?: AiDayOutput['mealOverrides'],
): DayMealOverrides | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const cleaned: DayMealOverrides = {};
  if (typeof raw.breakfast === 'string' && raw.breakfast.trim()) {
    cleaned.breakfast = raw.breakfast.trim();
  }
  if (typeof raw.lunch === 'string' && raw.lunch.trim()) {
    cleaned.lunch = raw.lunch.trim();
  }
  if (typeof raw.dinner === 'string' && raw.dinner.trim()) {
    cleaned.dinner = raw.dinner.trim();
  }
  if (typeof raw.snack === 'string' && raw.snack.trim()) {
    cleaned.snack = raw.snack.trim();
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function mealOverridesEqual(
  a?: DayMealOverrides,
  b?: DayMealOverrides,
): boolean {
  const norm = (m?: DayMealOverrides) => ({
    breakfast: (m?.breakfast ?? '').trim(),
    lunch: (m?.lunch ?? '').trim(),
    dinner: (m?.dinner ?? '').trim(),
    snack: (m?.snack ?? '').trim(),
  });
  const na = norm(a);
  const nb = norm(b);
  return (
    na.breakfast === nb.breakfast &&
    na.lunch === nb.lunch &&
    na.dinner === nb.dinner &&
    na.snack === nb.snack
  );
}

/**
 * Maps AI-returned day objects onto 0..6 day indices, resiliently handling:
 * - Standard 0..6 integer or numeric-string dayIndex values
 * - Accidental 1..7 (1-based) dayIndex values from LLMs
 * - Missing/corrupt dayIndex values when exactly 7 ordered days are returned
 */
function normalizeAiDayMap(days?: AiDayOutput[]): Map<number, AiDayOutput> {
  const aiDayMap = new Map<number, AiDayOutput>();
  if (!Array.isArray(days) || days.length === 0) {
    return aiDayMap;
  }

  const parsedIndices = days.map((d) =>
    d && typeof d === 'object' ? toFiniteNumber(d.dayIndex) : null,
  );
  const validInts = parsedIndices.filter(
    (n): n is number => n !== null && Number.isInteger(n),
  );

  // Detect 1-based indexing (e.g., 1..7 with no 0)
  const isOneBased =
    validInts.length > 0 &&
    !validInts.includes(0) &&
    validInts.every((n) => n >= 1 && n <= 7) &&
    (validInts.includes(7) ||
      (days.length === 7 && new Set(validInts).size === 7));

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!d || typeof d !== 'object') continue;
    const rawIdx = parsedIndices[i];
    let normalizedIdx: number | null = null;

    if (rawIdx !== null && Number.isInteger(rawIdx)) {
      const candidate = isOneBased ? rawIdx - 1 : rawIdx;
      if (candidate >= 0 && candidate <= 6) {
        normalizedIdx = candidate;
      }
    } else if (days.length === 7) {
      normalizedIdx = i;
    }

    if (normalizedIdx !== null && !aiDayMap.has(normalizedIdx)) {
      aiDayMap.set(normalizedIdx, d);
    }
  }

  // Fallback if all indices were invalid/duplicate but exactly 7 days were provided
  if (aiDayMap.size === 0 && days.length === 7) {
    for (let i = 0; i < 7; i++) {
      if (days[i] && typeof days[i] === 'object') {
        aiDayMap.set(i, days[i]);
      }
    }
  }

  return aiDayMap;
}

function formatDayList(indices: DayIndex[]): string {
  if (indices.length === 7) return 'all 7 days';
  return indices.map((i) => DAY_NAMES[i].short).join(', ');
}

export function summarizePlanChanges(
  before: WeeklyPlan,
  after: WeeklyPlan,
): PlanChangeSummary {
  const highlights: string[] = [];
  const changedDaysSet = new Set<DayIndex>();

  // 1. Macro targets & prep window
  const targetParts: string[] = [];
  if (before.caloriesTarget !== after.caloriesTarget) {
    targetParts.push(`${after.caloriesTarget.toLocaleString('en-US')} kcal`);
  }
  if (before.proteinTarget !== after.proteinTarget) {
    targetParts.push(`${after.proteinTarget}g protein`);
  }
  if (before.prepTimeLimit !== after.prepTimeLimit) {
    targetParts.push(`${after.prepTimeLimit} prep`);
  }
  if (targetParts.length > 0) {
    highlights.push(`Targets updated (${targetParts.join(' · ')})`);
  }

  // 2. Staple meals
  const changedMealSlots: Array<keyof StapleMeals> = [];
  const slotLabels: Record<keyof StapleMeals, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
  };
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
    if (before.stapleMeals[slot].trim() !== after.stapleMeals[slot].trim()) {
      changedMealSlots.push(slot);
    }
  }
  if (changedMealSlots.length > 0) {
    highlights.push(
      changedMealSlots.length === 4
        ? 'Updated all 4 staple meals'
        : `Updated staple ${changedMealSlots.map((s) => slotLabels[s]).join(', ')}`,
    );
  }

  // 3. Per-day training & custom meal overrides
  const workoutChangedDays: DayIndex[] = [];
  const mealOverrideChangedDays: DayIndex[] = [];

  for (let i = 0; i < 7; i++) {
    const prevDay = before.days[i];
    const nextDay = after.days[i];
    if (!prevDay || !nextDay) continue;
    const dayIdx = nextDay.dayIndex;

    const trainingChanged =
      prevDay.workoutTitle.trim() !== nextDay.workoutTitle.trim() ||
      (prevDay.warmup ?? '').trim() !== (nextDay.warmup ?? '').trim() ||
      prevDay.exercises.trim() !== nextDay.exercises.trim() ||
      prevDay.durationMinutes !== nextDay.durationMinutes ||
      prevDay.isRestDay !== nextDay.isRestDay;

    if (trainingChanged) {
      workoutChangedDays.push(dayIdx);
      changedDaysSet.add(dayIdx);
    }

    const overridesChanged = !mealOverridesEqual(
      prevDay.mealOverrides,
      nextDay.mealOverrides,
    );
    if (overridesChanged) {
      mealOverrideChangedDays.push(dayIdx);
      changedDaysSet.add(dayIdx);
    }

    // If a staple meal changed and this day inherits that slot, highlight it too
    if (
      changedMealSlots.some((slot) => !nextDay.mealOverrides?.[slot]?.trim())
    ) {
      changedDaysSet.add(dayIdx);
    }
  }

  if (workoutChangedDays.length > 0) {
    highlights.push(`Updated workouts on ${formatDayList(workoutChangedDays)}`);
  }
  if (mealOverrideChangedDays.length > 0) {
    highlights.push(
      `Updated custom menus on ${formatDayList(mealOverrideChangedDays)}`,
    );
  }

  // 4. Checklist
  const prevChecklistSig = JSON.stringify(
    before.checklist.map((i) => [i.category, i.text.trim()]),
  );
  const nextChecklistSig = JSON.stringify(
    after.checklist.map((i) => [i.category, i.text.trim()]),
  );
  if (prevChecklistSig !== nextChecklistSig) {
    highlights.push('Refreshed prep & grocery checklist');
  }

  const changedDayIndices = Array.from(changedDaysSet).sort((a, b) => a - b);

  return {
    hasChanges: highlights.length > 0,
    changedDayIndices,
    highlights,
  };
}

/**
 * Checks that when flex-vegetarian mode targets specific days, every requested
 * vegetarian day populates all 4 meal override slots so non-veg staple meals
 * cannot leak through.
 */
export function hasCompleteFlexVegOverrides(
  plan: WeeklyPlan,
  dietMode: DietMode,
  vegetarianDays: DayIndex[],
): boolean {
  if (dietMode !== 'flex-vegetarian' || vegetarianDays.length === 0) {
    return true;
  }
  for (const dayIdx of vegetarianDays) {
    const day = plan.days[dayIdx];
    if (!day?.mealOverrides) return false;
    const { breakfast, lunch, dinner, snack } = day.mealOverrides;
    if (
      !breakfast?.trim() ||
      !lunch?.trim() ||
      !dinner?.trim() ||
      !snack?.trim()
    ) {
      return false;
    }
  }
  return true;
}

export function mergeAiAdjustedPlan(
  currentPlan: WeeklyPlan,
  payload: AiAdjustPayload,
  scope: AdjustmentScope,
  options?: MergeAiOptions,
): { plan: WeeklyPlan; summary: string; changes: PlanChangeSummary } {
  const validPrepLimits = new Set<string>(PREP_TIME_LIMITS);
  const nextPrepTimeLimit: PrepTimeLimit =
    scope !== 'training' &&
    typeof payload.prepTimeLimit === 'string' &&
    validPrepLimits.has(payload.prepTimeLimit)
      ? (payload.prepTimeLimit as PrepTimeLimit)
      : currentPlan.prepTimeLimit;

  const parsedCal = toFiniteNumber(payload.caloriesTarget);
  const nextCalories =
    scope !== 'training' &&
    parsedCal !== null &&
    parsedCal >= 800 &&
    parsedCal <= 10000
      ? Math.round(parsedCal)
      : currentPlan.caloriesTarget;

  const parsedProt = toFiniteNumber(payload.proteinTarget);
  const nextProtein =
    scope !== 'training' &&
    parsedProt !== null &&
    parsedProt >= 30 &&
    parsedProt <= 500
      ? Math.round(parsedProt)
      : currentPlan.proteinTarget;

  const nextStapleMeals: StapleMeals =
    scope === 'training'
      ? { ...currentPlan.stapleMeals }
      : {
          breakfast:
            typeof payload.stapleMeals?.breakfast === 'string' &&
            payload.stapleMeals.breakfast.trim()
              ? payload.stapleMeals.breakfast.trim()
              : currentPlan.stapleMeals.breakfast,
          lunch:
            typeof payload.stapleMeals?.lunch === 'string' &&
            payload.stapleMeals.lunch.trim()
              ? payload.stapleMeals.lunch.trim()
              : currentPlan.stapleMeals.lunch,
          dinner:
            typeof payload.stapleMeals?.dinner === 'string' &&
            payload.stapleMeals.dinner.trim()
              ? payload.stapleMeals.dinner.trim()
              : currentPlan.stapleMeals.dinner,
          snack:
            typeof payload.stapleMeals?.snack === 'string' &&
            payload.stapleMeals.snack.trim()
              ? payload.stapleMeals.snack.trim()
              : currentPlan.stapleMeals.snack,
        };

  const staplesChanged =
    nextStapleMeals.breakfast !== currentPlan.stapleMeals.breakfast ||
    nextStapleMeals.lunch !== currentPlan.stapleMeals.lunch ||
    nextStapleMeals.dinner !== currentPlan.stapleMeals.dinner ||
    nextStapleMeals.snack !== currentPlan.stapleMeals.snack;

  const isFullWeekDietSwitch =
    scope !== 'training' &&
    Boolean(options?.dietMode && FULL_WEEK_DIET_MODES.has(options.dietMode));

  const aiDayMap = normalizeAiDayMap(payload.days);

  const nextDays: DaySchedule[] = currentPlan.days.map((existingDay) => {
    const aiDay = aiDayMap.get(existingDay.dayIndex);
    const updateTraining = scope === 'both' || scope === 'training';
    const updateFood = scope === 'both' || scope === 'food';

    if (!aiDay) {
      // If full-week diet switch changed staples and this day had stale overrides, clear them
      if (isFullWeekDietSwitch && staplesChanged && existingDay.mealOverrides) {
        return { ...existingDay, mealOverrides: undefined };
      }
      return existingDay;
    }

    const parsedDuration = toFiniteNumber(aiDay.durationMinutes);
    const durationMinutes =
      updateTraining && parsedDuration !== null
        ? Math.max(0, Math.min(240, Math.round(parsedDuration)))
        : existingDay.durationMinutes;

    const isRestDay = updateTraining
      ? typeof aiDay.isRestDay === 'boolean'
        ? aiDay.isRestDay
        : durationMinutes === 0
      : existingDay.isRestDay;

    const nextWorkoutTitle =
      updateTraining &&
      typeof aiDay.workoutTitle === 'string' &&
      aiDay.workoutTitle.trim()
        ? aiDay.workoutTitle.trim()
        : existingDay.workoutTitle;

    const nextExercises =
      updateTraining && typeof aiDay.exercises === 'string'
        ? aiDay.exercises.trim()
        : existingDay.exercises;

    const nextWarmup = updateTraining
      ? isRestDay || durationMinutes === 0
        ? ''
        : typeof aiDay.warmup === 'string' && aiDay.warmup.trim()
          ? aiDay.warmup.trim()
          : recommendWarmupForSession(nextWorkoutTitle, nextExercises, isRestDay)
      : existingDay.warmup;

    let nextMealOverrides = existingDay.mealOverrides;
    if (updateFood) {
      const cleaned = cleanMealOverrides(aiDay.mealOverrides);
      // On full-week diet switches, drop stale overrides echoed unchanged from before
      if (
        isFullWeekDietSwitch &&
        staplesChanged &&
        cleaned &&
        existingDay.mealOverrides &&
        mealOverridesEqual(cleaned, existingDay.mealOverrides)
      ) {
        nextMealOverrides = undefined;
      } else {
        nextMealOverrides = cleaned;
      }
    }

    return {
      ...existingDay,
      workoutTitle: nextWorkoutTitle,
      warmup: nextWarmup,
      exercises: nextExercises,
      durationMinutes,
      isRestDay,
      mealOverrides: nextMealOverrides,
    };
  });

  let nextChecklist: ChecklistItem[] = currentPlan.checklist;
  if (scope === 'both' || scope === 'food') {
    const timestamp = Date.now();
    const prepList = Array.isArray(payload.prepSteps)
      ? payload.prepSteps
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 8)
          .map(
            (text, idx): ChecklistItem => ({
              id: `ai-prep-${timestamp}-${idx}`,
              category: 'prep',
              text: text.trim(),
              checked: false,
            }),
          )
      : [];

    const groceryList = Array.isArray(payload.groceryItems)
      ? payload.groceryItems
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 16)
          .map(
            (text, idx): ChecklistItem => ({
              id: `ai-grocery-${timestamp}-${idx}`,
              category: 'grocery',
              text: text.trim(),
              checked: false,
            }),
          )
      : [];

    if (prepList.length > 0 || groceryList.length > 0) {
      const preservedPrep =
        prepList.length > 0
          ? prepList
          : currentPlan.checklist.filter((i) => i.category === 'prep');
      const preservedGrocery =
        groceryList.length > 0
          ? groceryList
          : currentPlan.checklist.filter((i) => i.category === 'grocery');
      nextChecklist = [...preservedPrep, ...preservedGrocery];
    }
  }

  const nextCustomSplitLabel =
    scope !== 'food' &&
    typeof payload.splitLabel === 'string' &&
    payload.splitLabel.trim()
      ? payload.splitLabel.trim()
      : currentPlan.customSplitLabel;

  const nextPlan: WeeklyPlan = {
    ...currentPlan,
    caloriesTarget: nextCalories,
    proteinTarget: nextProtein,
    prepTimeLimit: nextPrepTimeLimit,
    customSplitLabel: nextCustomSplitLabel,
    stapleMeals: nextStapleMeals,
    days: nextDays,
    checklist: nextChecklist,
  };

  const changes = summarizePlanChanges(currentPlan, nextPlan);

  const summary =
    typeof payload.summary === 'string' && payload.summary.trim()
      ? payload.summary.trim()
      : 'Updated your weekly plan based on your preferences.';

  return {
    plan: nextPlan,
    summary,
    changes,
  };
}
