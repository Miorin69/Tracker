import type {
  ChecklistItem,
  CustomHolidayPlan,
  DayIndex,
  DayMacroProgress,
  DayMealOverrides,
  DaySchedule,
  MealSlot,
  PrepTimeLimit,
  SavedPreset,
  SplitPresetId,
  StapleMeals,
  WeeklyPlan,
} from '../types/plan';
import type { NutritionGoal, UnitSystem } from './fitnessToolsLogic';
import type { VisualMode } from './workoutFocusLogic';

// Verbatim volumetric limits synchronized with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  ID_MAX: 128,
  DISPLAY_NAME_MAX: 120,
  EMAIL_MAX: 254,
  PHOTO_URL_MAX: 500,
  PLAN_NAME_MAX: 100,
  HOLIDAY_NOTES_MAX: 500,
  CUSTOM_SPLIT_LABEL_MAX: 80,
  MEAL_TEXT_MAX: 300,
  DAY_NAME_MAX: 30,
  SHORT_NAME_MAX: 10,
  WORKOUT_TITLE_MAX: 140,
  WARMUP_MAX: 300,
  EXERCISES_MAX: 600,
  CHECKLIST_ITEMS_MAX: 100,
  CHECKLIST_TEXT_MAX: 240,
  BOOKMARKED_TIPS_MAX: 50,
  BOOKMARK_ID_MAX: 80,
  SAVED_VIDEOS_MAX: 25,
  BMI_FIELD_MAX: 12,
  ISO_DATE_MAX: 64,
  CALORIES_MIN: 800,
  CALORIES_MAX: 10000,
  PROTEIN_MIN: 20,
  PROTEIN_MAX: 500,
  DURATION_MIN: 0,
  DURATION_MAX: 300,
} as const;

export interface StoredBmiState {
  unit: UnitSystem;
  heightCm: string;
  weightKg: string;
  feet: string;
  inches: string;
  weightLbs: string;
  goal: NutritionGoal;
}

export interface SavedCustomVideo {
  url: string;
  videoId?: string;
  label: string;
}

export type SavedVideoMap = Record<string, SavedCustomVideo>;

export interface UserWorkspacePreferences {
  bookmarkedTipIds: string[];
  bmiState: StoredBmiState;
  savedVideos: SavedVideoMap;
  visualMode: VisualMode;
}

export const DEFAULT_BMI_STATE: StoredBmiState = {
  unit: 'metric',
  heightCm: '175',
  weightKg: '72',
  feet: '5',
  inches: '9',
  weightLbs: '159',
  goal: 'maintain',
};

export const DEFAULT_USER_PREFERENCES: UserWorkspacePreferences = {
  bookmarkedTipIds: [],
  bmiState: { ...DEFAULT_BMI_STATE },
  savedVideos: {},
  visualMode: 'infographic',
};

const VALID_SPLITS: readonly SplitPresetId[] = [
  'ppl',
  'upper-lower',
  'full-body',
  'holiday-maintenance',
];

const VALID_PREP_LIMITS: readonly PrepTimeLimit[] = [
  '30 mins',
  '60 mins',
  '90+ mins',
];

const VALID_MEAL_SLOTS: readonly MealSlot[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampString(value: unknown, maxLen: number, fallback = ''): string {
  const str = typeof value === 'string' ? value : fallback;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

export function sanitizeFirestoreId(raw: string, fallbackPrefix = 'item'): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BLUEPRINT_LIMITS.ID_MAX);

  if (cleaned.length >= 1 && BLUEPRINT_LIMITS.ID_PATTERN.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now()}`;
}

export function sanitizeStapleMeals(meals: StapleMeals): StapleMeals {
  return {
    breakfast: clampString(meals.breakfast, BLUEPRINT_LIMITS.MEAL_TEXT_MAX),
    lunch: clampString(meals.lunch, BLUEPRINT_LIMITS.MEAL_TEXT_MAX),
    dinner: clampString(meals.dinner, BLUEPRINT_LIMITS.MEAL_TEXT_MAX),
    snack: clampString(meals.snack, BLUEPRINT_LIMITS.MEAL_TEXT_MAX),
  };
}

function sanitizeMealOverrides(
  overrides: DayMealOverrides | undefined,
): DayMealOverrides | undefined {
  if (!overrides || typeof overrides !== 'object') return undefined;
  const clean: DayMealOverrides = {};
  if (typeof overrides.breakfast === 'string' && overrides.breakfast.length > 0) {
    clean.breakfast = clampString(overrides.breakfast, BLUEPRINT_LIMITS.MEAL_TEXT_MAX);
  }
  if (typeof overrides.lunch === 'string' && overrides.lunch.length > 0) {
    clean.lunch = clampString(overrides.lunch, BLUEPRINT_LIMITS.MEAL_TEXT_MAX);
  }
  if (typeof overrides.dinner === 'string' && overrides.dinner.length > 0) {
    clean.dinner = clampString(overrides.dinner, BLUEPRINT_LIMITS.MEAL_TEXT_MAX);
  }
  if (typeof overrides.snack === 'string' && overrides.snack.length > 0) {
    clean.snack = clampString(overrides.snack, BLUEPRINT_LIMITS.MEAL_TEXT_MAX);
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export function sanitizeDaySchedule(day: DaySchedule, index: number): DaySchedule {
  const safeIndex = Math.min(6, Math.max(0, Math.round(index))) as DayIndex;
  const sanitized: DaySchedule = {
    dayIndex: safeIndex,
    dayName: clampString(day.dayName, BLUEPRINT_LIMITS.DAY_NAME_MAX, `Day ${safeIndex + 1}`) || `Day ${safeIndex + 1}`,
    shortName: clampString(day.shortName, BLUEPRINT_LIMITS.SHORT_NAME_MAX, `D${safeIndex + 1}`) || `D${safeIndex + 1}`,
    workoutTitle: clampString(day.workoutTitle, BLUEPRINT_LIMITS.WORKOUT_TITLE_MAX),
    exercises: clampString(day.exercises, BLUEPRINT_LIMITS.EXERCISES_MAX),
    durationMinutes: clampNumber(
      day.durationMinutes,
      BLUEPRINT_LIMITS.DURATION_MIN,
      BLUEPRINT_LIMITS.DURATION_MAX,
      0,
    ),
    isRestDay: Boolean(day.isRestDay),
  };

  if (typeof day.warmup === 'string' && day.warmup.length > 0) {
    sanitized.warmup = clampString(day.warmup, BLUEPRINT_LIMITS.WARMUP_MAX);
  }

  const overrides = sanitizeMealOverrides(day.mealOverrides);
  if (overrides) {
    sanitized.mealOverrides = overrides;
  }

  return sanitized;
}

export function sanitizeChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.slice(0, BLUEPRINT_LIMITS.CHECKLIST_ITEMS_MAX).map((item, idx) => ({
    id: sanitizeFirestoreId(item.id || `item-${idx}`, `chk-${idx}`),
    category: item.category === 'grocery' ? 'grocery' : 'prep',
    text: clampString(item.text, BLUEPRINT_LIMITS.CHECKLIST_TEXT_MAX),
    checked: Boolean(item.checked),
  }));
}

function sanitizeDailyProgress(
  progress: WeeklyPlan['dailyProgress'],
): Record<string, DayMacroProgress> | undefined {
  if (!progress || typeof progress !== 'object') return undefined;
  const result: Record<string, DayMacroProgress> = {};
  for (let i = 0; i < 7; i += 1) {
    const key = String(i);
    const entry =
      (progress as Record<string, DayMacroProgress | undefined>)[key] ??
      progress[i as DayIndex];
    if (!entry || typeof entry !== 'object') continue;
    const completedMeals = Array.isArray(entry.completedMeals)
      ? Array.from(
          new Set(
            entry.completedMeals.filter((slot): slot is MealSlot =>
              VALID_MEAL_SLOTS.includes(slot),
            ),
          ),
        )
      : [];
    const cleanEntry: DayMacroProgress = {
      completedMeals,
      extraCalories: clampNumber(entry.extraCalories, 0, 10000, 0),
      extraProtein: clampNumber(entry.extraProtein, 0, 500, 0),
    };
    if (typeof entry.workoutCompleted === 'boolean') {
      cleanEntry.workoutCompleted = entry.workoutCompleted;
    }
    result[key] = cleanEntry;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function sanitizeWeeklyPlanForFirestore(plan: WeeklyPlan): Record<string, unknown> {
  const safeWeekStart =
    typeof plan.weekStartDate === 'string' && DATE_PATTERN.test(plan.weekStartDate)
      ? plan.weekStartDate
      : new Date().toISOString().slice(0, 10);

  const safeSplit: SplitPresetId = VALID_SPLITS.includes(plan.splitPreset)
    ? plan.splitPreset
    : 'ppl';
  const safePrep: PrepTimeLimit = VALID_PREP_LIMITS.includes(plan.prepTimeLimit)
    ? plan.prepTimeLimit
    : '60 mins';

  const days = Array.from({ length: 7 }, (_, i) => {
    const existing = plan.days[i];
    if (existing) return sanitizeDaySchedule(existing, i);
    return sanitizeDaySchedule(
      {
        dayIndex: i as DayIndex,
        dayName: `Day ${i + 1}`,
        shortName: `D${i + 1}`,
        workoutTitle: 'Rest Day',
        exercises: '',
        durationMinutes: 0,
        isRestDay: true,
      },
      i,
    );
  });

  const payload: Record<string, unknown> = {
    version: clampNumber(plan.version || 1, 1, 100, 1),
    weekStartDate: safeWeekStart,
    holidayTag: clampString(plan.holidayTag, BLUEPRINT_LIMITS.PLAN_NAME_MAX, 'Normal Week').trim() || 'Normal Week',
    caloriesTarget: clampNumber(
      plan.caloriesTarget,
      BLUEPRINT_LIMITS.CALORIES_MIN,
      BLUEPRINT_LIMITS.CALORIES_MAX,
      2500,
    ),
    proteinTarget: clampNumber(
      plan.proteinTarget,
      BLUEPRINT_LIMITS.PROTEIN_MIN,
      BLUEPRINT_LIMITS.PROTEIN_MAX,
      180,
    ),
    splitPreset: safeSplit,
    prepTimeLimit: safePrep,
    stapleMeals: sanitizeStapleMeals(plan.stapleMeals),
    days,
    checklist: sanitizeChecklist(plan.checklist),
  };

  if (typeof plan.holidayNotes === 'string' && plan.holidayNotes.trim().length > 0) {
    payload.holidayNotes = clampString(
      plan.holidayNotes.trim(),
      BLUEPRINT_LIMITS.HOLIDAY_NOTES_MAX,
    );
  }

  if (
    typeof plan.activeHolidayPlanId === 'string' &&
    plan.activeHolidayPlanId.trim().length > 0
  ) {
    payload.activeHolidayPlanId = sanitizeFirestoreId(
      plan.activeHolidayPlanId,
      'holiday',
    );
  }

  if (
    typeof plan.customSplitLabel === 'string' &&
    plan.customSplitLabel.trim().length > 0
  ) {
    payload.customSplitLabel = clampString(
      plan.customSplitLabel.trim(),
      BLUEPRINT_LIMITS.CUSTOM_SPLIT_LABEL_MAX,
    );
  }

  const dailyProgress = sanitizeDailyProgress(plan.dailyProgress);
  if (dailyProgress) {
    payload.dailyProgress = dailyProgress;
  }

  return payload;
}

export function sanitizeBmiState(bmi: Partial<StoredBmiState> | undefined): StoredBmiState {
  const src = bmi ?? DEFAULT_BMI_STATE;
  return {
    unit: src.unit === 'imperial' ? 'imperial' : 'metric',
    heightCm: clampString(src.heightCm, BLUEPRINT_LIMITS.BMI_FIELD_MAX, DEFAULT_BMI_STATE.heightCm),
    weightKg: clampString(src.weightKg, BLUEPRINT_LIMITS.BMI_FIELD_MAX, DEFAULT_BMI_STATE.weightKg),
    feet: clampString(src.feet, BLUEPRINT_LIMITS.BMI_FIELD_MAX, DEFAULT_BMI_STATE.feet),
    inches: clampString(src.inches, BLUEPRINT_LIMITS.BMI_FIELD_MAX, DEFAULT_BMI_STATE.inches),
    weightLbs: clampString(src.weightLbs, BLUEPRINT_LIMITS.BMI_FIELD_MAX, DEFAULT_BMI_STATE.weightLbs),
    goal:
      src.goal === 'fat-loss' || src.goal === 'lean-bulk' || src.goal === 'maintain'
        ? src.goal
        : 'maintain',
  };
}

export function sanitizeBookmarkedTipIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const clean: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, BLUEPRINT_LIMITS.BOOKMARK_ID_MAX);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    clean.push(trimmed);
    if (clean.length >= BLUEPRINT_LIMITS.BOOKMARKED_TIPS_MAX) break;
  }
  return clean;
}

export function sanitizeSavedVideos(videos: unknown): SavedVideoMap {
  if (!videos || typeof videos !== 'object') return {};
  const result: SavedVideoMap = {};
  const entries = Object.entries(videos as Record<string, unknown>);
  for (const [key, val] of entries) {
    if (Object.keys(result).length >= BLUEPRINT_LIMITS.SAVED_VIDEOS_MAX) break;
    if (!key || key.length > 80 || !val || typeof val !== 'object') continue;
    const obj = val as Record<string, unknown>;
    if (typeof obj.url !== 'string' || obj.url.trim().length === 0) continue;
    const entry: SavedCustomVideo = {
      url: clampString(obj.url.trim(), 400),
      label: clampString(
        typeof obj.label === 'string' && obj.label.trim().length > 0
          ? obj.label.trim()
          : 'Saved YouTube Video',
        140,
      ),
    };
    if (typeof obj.videoId === 'string' && obj.videoId.trim().length > 0) {
      entry.videoId = clampString(obj.videoId.trim(), 32);
    }
    result[key] = entry;
  }
  return result;
}

export function sanitizeHolidayPlanForFirestore(
  ownerId: string,
  holidayPlan: CustomHolidayPlan,
): Record<string, unknown> {
  const safeId = sanitizeFirestoreId(holidayPlan.id, 'holiday');
  const safeSplit: SplitPresetId = VALID_SPLITS.includes(holidayPlan.splitPreset)
    ? holidayPlan.splitPreset
    : 'holiday-maintenance';
  const safePrep: PrepTimeLimit = VALID_PREP_LIMITS.includes(holidayPlan.prepTimeLimit)
    ? holidayPlan.prepTimeLimit
    : '30 mins';

  const days = Array.from({ length: 7 }, (_, i) => {
    const existing = holidayPlan.days[i];
    if (existing) return sanitizeDaySchedule(existing, i);
    return sanitizeDaySchedule(
      {
        dayIndex: i as DayIndex,
        dayName: `Day ${i + 1}`,
        shortName: `D${i + 1}`,
        workoutTitle: 'Rest Day',
        exercises: '',
        durationMinutes: 0,
        isRestDay: true,
      },
      i,
    );
  });

  const payload: Record<string, unknown> = {
    ownerId: sanitizeFirestoreId(ownerId, 'user'),
    id: safeId,
    name: clampString(holidayPlan.name.trim(), BLUEPRINT_LIMITS.PLAN_NAME_MAX, 'Holiday Plan') || 'Holiday Plan',
    notes: clampString(holidayPlan.notes ?? '', BLUEPRINT_LIMITS.HOLIDAY_NOTES_MAX),
    caloriesTarget: clampNumber(
      holidayPlan.caloriesTarget,
      BLUEPRINT_LIMITS.CALORIES_MIN,
      BLUEPRINT_LIMITS.CALORIES_MAX,
      2200,
    ),
    proteinTarget: clampNumber(
      holidayPlan.proteinTarget,
      BLUEPRINT_LIMITS.PROTEIN_MIN,
      BLUEPRINT_LIMITS.PROTEIN_MAX,
      160,
    ),
    prepTimeLimit: safePrep,
    splitPreset: safeSplit,
    stapleMeals: sanitizeStapleMeals(holidayPlan.stapleMeals),
    days,
    checklist: sanitizeChecklist(holidayPlan.checklist),
    updatedAtIso:
      clampString(holidayPlan.updatedAt, BLUEPRINT_LIMITS.ISO_DATE_MAX) ||
      new Date().toISOString(),
  };

  if (
    typeof holidayPlan.customSplitLabel === 'string' &&
    holidayPlan.customSplitLabel.trim().length > 0
  ) {
    payload.customSplitLabel = clampString(
      holidayPlan.customSplitLabel.trim(),
      BLUEPRINT_LIMITS.CUSTOM_SPLIT_LABEL_MAX,
    );
  }

  return payload;
}

export function sanitizeSavedPresetForFirestore(
  ownerId: string,
  preset: SavedPreset,
): Record<string, unknown> {
  return {
    ownerId: sanitizeFirestoreId(ownerId, 'user'),
    id: sanitizeFirestoreId(preset.id, 'preset'),
    name: clampString(preset.name.trim(), BLUEPRINT_LIMITS.PLAN_NAME_MAX, 'Saved Plan') || 'Saved Plan',
    savedAt:
      clampString(preset.savedAt, BLUEPRINT_LIMITS.ISO_DATE_MAX) ||
      new Date().toISOString(),
    plan: sanitizeWeeklyPlanForFirestore(preset.plan),
  };
}

export function sanitizeUserProfileForFirestore(
  ownerId: string,
  displayName: string | null | undefined,
  email: string | null | undefined,
  photoURL: string | null | undefined,
): Record<string, unknown> {
  const safeEmail =
    clampString(email?.trim(), BLUEPRINT_LIMITS.EMAIL_MAX, 'user@example.com') ||
    'user@example.com';
  const fallbackName = safeEmail.split('@')[0] || 'Athlete';
  const safeDisplayName =
    clampString(displayName?.trim(), BLUEPRINT_LIMITS.DISPLAY_NAME_MAX, fallbackName) ||
    fallbackName;

  const payload: Record<string, unknown> = {
    ownerId: sanitizeFirestoreId(ownerId, 'user'),
    displayName: safeDisplayName,
    email: safeEmail,
  };

  if (typeof photoURL === 'string' && photoURL.trim().length > 0) {
    payload.photoURL = clampString(photoURL.trim(), BLUEPRINT_LIMITS.PHOTO_URL_MAX);
  }

  return payload;
}

export function hydrateWeeklyPlanFromFirestore(raw: unknown): WeeklyPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.days) || obj.days.length !== 7) return null;
  if (!obj.stapleMeals || typeof obj.stapleMeals !== 'object') return null;

  const dailyProgressRaw = obj.dailyProgress;
  let dailyProgress: Partial<Record<DayIndex, DayMacroProgress>> | undefined;
  if (dailyProgressRaw && typeof dailyProgressRaw === 'object') {
    const hydrated: Partial<Record<DayIndex, DayMacroProgress>> = {};
    for (let i = 0; i < 7; i += 1) {
      const entry = (dailyProgressRaw as Record<string, unknown>)[String(i)];
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      hydrated[i as DayIndex] = {
        completedMeals: Array.isArray(e.completedMeals)
          ? e.completedMeals.filter(
              (m): m is MealSlot =>
                typeof m === 'string' &&
                VALID_MEAL_SLOTS.includes(m as MealSlot),
            )
          : [],
        extraCalories:
          typeof e.extraCalories === 'number' && Number.isFinite(e.extraCalories)
            ? e.extraCalories
            : 0,
        extraProtein:
          typeof e.extraProtein === 'number' && Number.isFinite(e.extraProtein)
            ? e.extraProtein
            : 0,
        ...(typeof e.workoutCompleted === 'boolean'
          ? { workoutCompleted: e.workoutCompleted }
          : {}),
      };
    }
    if (Object.keys(hydrated).length > 0) {
      dailyProgress = hydrated;
    }
  }

  const plan: WeeklyPlan = {
    version: typeof obj.version === 'number' ? obj.version : 1,
    weekStartDate:
      typeof obj.weekStartDate === 'string' && DATE_PATTERN.test(obj.weekStartDate)
        ? obj.weekStartDate
        : new Date().toISOString().slice(0, 10),
    holidayTag:
      typeof obj.holidayTag === 'string' && obj.holidayTag.trim().length > 0
        ? obj.holidayTag
        : 'Normal Week',
    caloriesTarget:
      typeof obj.caloriesTarget === 'number' ? obj.caloriesTarget : 2500,
    proteinTarget:
      typeof obj.proteinTarget === 'number' ? obj.proteinTarget : 180,
    splitPreset: VALID_SPLITS.includes(obj.splitPreset as SplitPresetId)
      ? (obj.splitPreset as SplitPresetId)
      : 'ppl',
    prepTimeLimit: VALID_PREP_LIMITS.includes(obj.prepTimeLimit as PrepTimeLimit)
      ? (obj.prepTimeLimit as PrepTimeLimit)
      : '60 mins',
    stapleMeals: sanitizeStapleMeals(obj.stapleMeals as StapleMeals),
    days: (obj.days as DaySchedule[]).map((d, i) => sanitizeDaySchedule(d, i)),
    checklist: Array.isArray(obj.checklist)
      ? sanitizeChecklist(obj.checklist as ChecklistItem[])
      : [],
  };

  if (typeof obj.holidayNotes === 'string' && obj.holidayNotes.trim().length > 0) {
    plan.holidayNotes = obj.holidayNotes;
  }
  if (
    typeof obj.activeHolidayPlanId === 'string' &&
    obj.activeHolidayPlanId.trim().length > 0
  ) {
    plan.activeHolidayPlanId = obj.activeHolidayPlanId;
  }
  if (
    typeof obj.customSplitLabel === 'string' &&
    obj.customSplitLabel.trim().length > 0
  ) {
    plan.customSplitLabel = obj.customSplitLabel;
  }
  if (dailyProgress) {
    plan.dailyProgress = dailyProgress;
  }

  return plan;
}

export function hydrateHolidayPlanFromFirestore(
  raw: unknown,
): CustomHolidayPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.name !== 'string' ||
    !Array.isArray(obj.days) ||
    obj.days.length !== 7 ||
    !obj.stapleMeals ||
    typeof obj.stapleMeals !== 'object'
  ) {
    return null;
  }

  const holidayPlan: CustomHolidayPlan = {
    id: obj.id,
    name: obj.name,
    notes: typeof obj.notes === 'string' ? obj.notes : '',
    caloriesTarget:
      typeof obj.caloriesTarget === 'number' ? obj.caloriesTarget : 2200,
    proteinTarget:
      typeof obj.proteinTarget === 'number' ? obj.proteinTarget : 160,
    prepTimeLimit: VALID_PREP_LIMITS.includes(obj.prepTimeLimit as PrepTimeLimit)
      ? (obj.prepTimeLimit as PrepTimeLimit)
      : '30 mins',
    splitPreset: VALID_SPLITS.includes(obj.splitPreset as SplitPresetId)
      ? (obj.splitPreset as SplitPresetId)
      : 'holiday-maintenance',
    stapleMeals: sanitizeStapleMeals(obj.stapleMeals as StapleMeals),
    days: (obj.days as DaySchedule[]).map((d, i) => sanitizeDaySchedule(d, i)),
    checklist: Array.isArray(obj.checklist)
      ? sanitizeChecklist(obj.checklist as ChecklistItem[])
      : [],
    updatedAt:
      typeof obj.updatedAtIso === 'string'
        ? obj.updatedAtIso
        : new Date().toISOString(),
  };

  if (
    typeof obj.customSplitLabel === 'string' &&
    obj.customSplitLabel.trim().length > 0
  ) {
    holidayPlan.customSplitLabel = obj.customSplitLabel;
  }

  return holidayPlan;
}

export function hydrateSavedPresetFromFirestore(
  raw: unknown,
): SavedPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.name !== 'string') return null;
  const plan = hydrateWeeklyPlanFromFirestore(obj.plan);
  if (!plan) return null;

  return {
    id: obj.id,
    name: obj.name,
    savedAt:
      typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    plan,
  };
}

export function buildWorkspaceFingerprint(
  plan: WeeklyPlan,
  normalWeekBackup: WeeklyPlan | null,
  prefs: UserWorkspacePreferences,
): string {
  return JSON.stringify({
    activePlan: sanitizeWeeklyPlanForFirestore(plan),
    normalWeekBackup: normalWeekBackup
      ? sanitizeWeeklyPlanForFirestore(normalWeekBackup)
      : null,
    bookmarkedTipIds: sanitizeBookmarkedTipIds(prefs.bookmarkedTipIds),
    bmiState: sanitizeBmiState(prefs.bmiState),
    savedVideos: sanitizeSavedVideos(prefs.savedVideos),
    visualMode: prefs.visualMode === 'illustration' ? 'illustration' : 'infographic',
  });
}
