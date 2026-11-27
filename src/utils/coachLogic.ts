import type { WeeklyPlan } from '../types/plan.ts';

export type CoachItemKind = 'exercise' | 'meal';

export type MealSlotKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface CoachSelection {
  kind: CoachItemKind;
  dayIndex: number;
  dayName: string;
  title: string;
  mealSlot?: MealSlotKey;
  workoutContext?: string;
}

export interface EstimatedMacros {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface CoachBrief {
  kind: CoachItemKind;
  headline: string;
  coachNote: string;
  // Exercise fields
  targetMuscles?: string[];
  formCues?: string[];
  commonMistakes?: string[];
  progressionTip?: string;
  alternatives?: string[];
  // Meal fields
  estimatedMacros?: EstimatedMacros;
  goalFitNote?: string;
  timingAndMicros?: string;
  prepTips?: string[];
  smartSwaps?: string[];
  // Optional follow-up Q&A answer
  followUpAnswer?: string;
}

export interface CoachBriefRequest {
  selection: CoachSelection;
  planContext: Pick<
    WeeklyPlan,
    'caloriesTarget' | 'proteinTarget' | 'prepTimeLimit' | 'holidayTag'
  >;
  followUpQuestion?: string;
}

/**
 * Splits a workout's exercise string into selectable individual items
 * without breaking numeric commas like "8,000-10,000 steps".
 */
export function parseExercisesFromText(exercisesText: string): string[] {
  const trimmed = exercisesText.trim();
  if (!trimmed) return [];

  // Split on semicolons or commas not immediately followed by a digit (preserves 8,000)
  const parts = trimmed
    .split(/,(?!\d)|;/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts : [trimmed];
}

export function buildCoachCacheKey(selection: CoachSelection): string {
  return `${selection.kind}:${selection.dayIndex}:${selection.mealSlot ?? ''}:${selection.title.trim().toLowerCase()}`;
}

export function buildCoachBriefPrompt(req: CoachBriefRequest): string {
  const { selection, planContext, followUpQuestion } = req;

  const baseLines = [
    `USER CONTEXT:`,
    `- Day: ${selection.dayName}`,
    `- Daily Targets: ${planContext.caloriesTarget} kcal / ${planContext.proteinTarget}g protein`,
    `- Weekly Prep Limit: ${planContext.prepTimeLimit}`,
    `- Week Theme: ${planContext.holidayTag || 'Normal Week'}`,
  ];

  if (selection.workoutContext) {
    baseLines.push(`- Day Workout: ${selection.workoutContext}`);
  }

  if (selection.kind === 'exercise') {
    baseLines.push(
      '',
      `SELECTED EXERCISE: "${selection.title}"`,
      '',
      'As Coach Hishay (CSCS certified strength coach), provide practical, concise guidance:',
      '- headline: Short athletic summary (max 10 words).',
      '- coachNote: 2 crisp sentences explaining why this movement earns its spot in this session.',
      '- targetMuscles: 2-4 primary & secondary muscle groups.',
      '- formCues: 3-4 actionable coaching cues (setup, tempo, range of motion, breathing).',
      '- commonMistakes: 2 concise form mistakes to avoid.',
      '- progressionTip: 1 practical sentence on how to progress weight/reps safely.',
      '- alternatives: 2 smart exercise swaps (e.g., joint-friendly or dumbbell/home alternative).',
    );
  } else {
    const slotLabel = selection.mealSlot
      ? selection.mealSlot.charAt(0).toUpperCase() + selection.mealSlot.slice(1)
      : 'Meal';
    baseLines.push(
      '',
      `SELECTED MEAL (${slotLabel}): "${selection.title}"`,
      '',
      'As Coach Hishay (sports nutritionist), analyze this meal concisely:',
      '- headline: Short nutritional summary (max 10 words).',
      '- coachNote: 2 crisp sentences evaluating protein quality, satiety, and recovery value.',
      '- estimatedMacros: Realistic integer estimates for calories, proteinGrams, carbsGrams, fatGrams based on the listed portions.',
      '- goalFitNote: 1-2 sentences showing how it fits their daily calorie and protein targets.',
      '- timingAndMicros: 1-2 sentences on ideal workout timing and notable micronutrients/fiber.',
      '- prepTips: 2 concise tips to prep or season it quickly.',
      '- smartSwaps: 2 practical swaps (always include at least one high-protein vegetarian swap if the meal contains meat, or a protein-boost idea if already vegetarian).',
    );
  }

  if (followUpQuestion && followUpQuestion.trim()) {
    baseLines.push(
      '',
      `USER FOLLOW-UP QUESTION: "${followUpQuestion.trim()}"`,
      'Answer this specific follow-up question directly, warmly, and practically in 2-4 concise sentences inside the followUpAnswer field.',
    );
  }

  return baseLines.join('\n');
}

function cleanStringList(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max);
}

function toSafeNonNegInt(val: unknown, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(0, Math.round(val));
}

export function sanitizeCoachBrief(
  raw: Record<string, unknown>,
  kind: CoachItemKind,
): CoachBrief {
  const headline =
    typeof raw.headline === 'string' && raw.headline.trim()
      ? raw.headline.trim()
      : kind === 'exercise'
        ? 'Strength Coaching Breakdown'
        : 'Sports Nutrition Breakdown';

  const coachNote =
    typeof raw.coachNote === 'string' && raw.coachNote.trim()
      ? raw.coachNote.trim()
      : 'Focus on consistent execution and steady progression across the week.';

  const followUpAnswer =
    typeof raw.followUpAnswer === 'string' && raw.followUpAnswer.trim()
      ? raw.followUpAnswer.trim()
      : undefined;

  if (kind === 'exercise') {
    return {
      kind,
      headline,
      coachNote,
      targetMuscles: cleanStringList(raw.targetMuscles, 6),
      formCues: cleanStringList(raw.formCues, 5),
      commonMistakes: cleanStringList(raw.commonMistakes, 4),
      progressionTip:
        typeof raw.progressionTip === 'string' && raw.progressionTip.trim()
          ? raw.progressionTip.trim()
          : undefined,
      alternatives: cleanStringList(raw.alternatives, 4),
      followUpAnswer,
    };
  }

  const rawMacros =
    raw.estimatedMacros && typeof raw.estimatedMacros === 'object'
      ? (raw.estimatedMacros as Record<string, unknown>)
      : null;

  const estimatedMacros: EstimatedMacros | undefined = rawMacros
    ? {
        calories: toSafeNonNegInt(rawMacros.calories, 0),
        proteinGrams: toSafeNonNegInt(rawMacros.proteinGrams, 0),
        carbsGrams: toSafeNonNegInt(rawMacros.carbsGrams, 0),
        fatGrams: toSafeNonNegInt(rawMacros.fatGrams, 0),
      }
    : undefined;

  return {
    kind,
    headline,
    coachNote,
    estimatedMacros,
    goalFitNote:
      typeof raw.goalFitNote === 'string' && raw.goalFitNote.trim()
        ? raw.goalFitNote.trim()
        : undefined,
    timingAndMicros:
      typeof raw.timingAndMicros === 'string' && raw.timingAndMicros.trim()
        ? raw.timingAndMicros.trim()
        : undefined,
    prepTips: cleanStringList(raw.prepTips, 4),
    smartSwaps: cleanStringList(raw.smartSwaps, 4),
    followUpAnswer,
  };
}
