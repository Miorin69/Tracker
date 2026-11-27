import {
  DEFAULT_WEEK_TAG,
  GYM_STAPLES_MEALS,
  PREP_TIME_LIMITS,
  QUICK_STAPLES_30M,
  SPLIT_PRESETS,
  buildDaysFromPreset,
  buildDefaultChecklist,
} from '../data/presets.ts';
import type {
  CustomHolidayPlan,
  PrepTimeLimit,
  SplitPresetId,
  WeeklyPlan,
} from '../types/plan.ts';
import { deriveChecklistFromMeals, parseImportedPlan } from './planLogic.ts';

export type HolidayStarterMode = 'current' | 'quick-maintenance';

export interface CreateHolidayPlanInput {
  name: string;
  notes?: string;
  caloriesTarget?: number;
  proteinTarget?: number;
  prepTimeLimit?: PrepTimeLimit;
  starterMode: HolidayStarterMode;
}

export interface UpdateHolidayPlanDetailsPatch {
  name?: string;
  notes?: string;
  caloriesTarget?: number;
  proteinTarget?: number;
  prepTimeLimit?: PrepTimeLimit;
}

function clampCalories(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(800, Math.min(10000, Math.round(value)));
}

function clampProtein(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(30, Math.min(500, Math.round(value)));
}

function cloneDays(days: WeeklyPlan['days']): WeeklyPlan['days'] {
  return days.map((d) => ({
    ...d,
    mealOverrides: d.mealOverrides ? { ...d.mealOverrides } : undefined,
  }));
}

function cloneChecklist(
  checklist: WeeklyPlan['checklist'],
): WeeklyPlan['checklist'] {
  return checklist.map((item) => ({ ...item }));
}

/**
 * Creates a self-contained, editable CustomHolidayPlan from either the user's
 * current weekly schedule or a quick 25-30 min maintenance starter.
 */
export function createCustomHolidayPlan(
  sourcePlan: WeeklyPlan,
  input: CreateHolidayPlanInput,
): CustomHolidayPlan {
  const name = input.name.trim() || 'Custom Holiday Plan';
  const notes = (input.notes ?? '').trim();
  const caloriesTarget = clampCalories(
    input.caloriesTarget,
    sourcePlan.caloriesTarget,
  );
  const proteinTarget = clampProtein(
    input.proteinTarget,
    sourcePlan.proteinTarget,
  );
  const validLimits = new Set<string>(PREP_TIME_LIMITS);
  const prepTimeLimit: PrepTimeLimit =
    input.prepTimeLimit && validLimits.has(input.prepTimeLimit)
      ? input.prepTimeLimit
      : input.starterMode === 'quick-maintenance'
        ? '30 mins'
        : sourcePlan.prepTimeLimit;

  const isQuick = input.starterMode === 'quick-maintenance';
  const splitPreset: SplitPresetId = isQuick
    ? 'holiday-maintenance'
    : sourcePlan.splitPreset;
  const stapleMeals = isQuick
    ? { ...QUICK_STAPLES_30M }
    : { ...sourcePlan.stapleMeals };
  const days = isQuick
    ? buildDaysFromPreset('holiday-maintenance')
    : cloneDays(sourcePlan.days);
  const checklist = isQuick
    ? deriveChecklistFromMeals(stapleMeals, prepTimeLimit)
    : cloneChecklist(sourcePlan.checklist);

  return {
    id: `holiday-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    notes,
    caloriesTarget,
    proteinTarget,
    prepTimeLimit,
    splitPreset,
    customSplitLabel: isQuick ? undefined : sourcePlan.customSplitLabel,
    stapleMeals,
    days,
    checklist,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Applies a saved CustomHolidayPlan onto the active weekly command sheet while
 * preserving the selected weekStartDate.
 */
export function applyHolidayPlanToWeek(
  currentWeek: WeeklyPlan,
  holidayPlan: CustomHolidayPlan,
): WeeklyPlan {
  return {
    ...currentWeek,
    holidayTag: holidayPlan.name,
    holidayNotes: holidayPlan.notes || undefined,
    activeHolidayPlanId: holidayPlan.id,
    caloriesTarget: holidayPlan.caloriesTarget,
    proteinTarget: holidayPlan.proteinTarget,
    prepTimeLimit: holidayPlan.prepTimeLimit,
    splitPreset: holidayPlan.splitPreset,
    customSplitLabel: holidayPlan.customSplitLabel,
    stapleMeals: { ...holidayPlan.stapleMeals },
    days: cloneDays(holidayPlan.days),
    checklist: cloneChecklist(holidayPlan.checklist),
  };
}

/**
 * Updates metadata (name, notes, targets, prep window) on a CustomHolidayPlan.
 */
export function updateHolidayPlanDetails(
  holidayPlan: CustomHolidayPlan,
  patch: UpdateHolidayPlanDetailsPatch,
): CustomHolidayPlan {
  const validLimits = new Set<string>(PREP_TIME_LIMITS);
  const nextName =
    typeof patch.name === 'string' && patch.name.trim()
      ? patch.name.trim()
      : holidayPlan.name;
  const nextNotes =
    typeof patch.notes === 'string' ? patch.notes.trim() : holidayPlan.notes;

  return {
    ...holidayPlan,
    name: nextName,
    notes: nextNotes,
    caloriesTarget: clampCalories(
      patch.caloriesTarget,
      holidayPlan.caloriesTarget,
    ),
    proteinTarget: clampProtein(patch.proteinTarget, holidayPlan.proteinTarget),
    prepTimeLimit:
      patch.prepTimeLimit && validLimits.has(patch.prepTimeLimit)
        ? patch.prepTimeLimit
        : holidayPlan.prepTimeLimit,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Saves the active week's workouts, warm-ups, meals, targets, and checklist
 * back into the active CustomHolidayPlan.
 */
export function syncWeekIntoHolidayPlan(
  holidayPlan: CustomHolidayPlan,
  currentWeek: WeeklyPlan,
): CustomHolidayPlan {
  return {
    ...holidayPlan,
    name:
      currentWeek.holidayTag.trim() &&
      currentWeek.holidayTag.trim() !== DEFAULT_WEEK_TAG
        ? currentWeek.holidayTag.trim()
        : holidayPlan.name,
    notes:
      typeof currentWeek.holidayNotes === 'string'
        ? currentWeek.holidayNotes.trim()
        : holidayPlan.notes,
    caloriesTarget: currentWeek.caloriesTarget,
    proteinTarget: currentWeek.proteinTarget,
    prepTimeLimit: currentWeek.prepTimeLimit,
    splitPreset: currentWeek.splitPreset,
    customSplitLabel: currentWeek.customSplitLabel,
    stapleMeals: { ...currentWeek.stapleMeals },
    days: cloneDays(currentWeek.days),
    checklist: cloneChecklist(currentWeek.checklist),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns true when the active weekly sheet differs from the saved copy of its
 * linked CustomHolidayPlan (workouts, meals, targets, checklist, or notes).
 */
export function hasUnsavedHolidayEdits(
  holidayPlan: CustomHolidayPlan,
  currentWeek: WeeklyPlan,
): boolean {
  if (currentWeek.activeHolidayPlanId !== holidayPlan.id) return false;
  if (currentWeek.caloriesTarget !== holidayPlan.caloriesTarget) return true;
  if (currentWeek.proteinTarget !== holidayPlan.proteinTarget) return true;
  if (currentWeek.prepTimeLimit !== holidayPlan.prepTimeLimit) return true;
  if (currentWeek.splitPreset !== holidayPlan.splitPreset) return true;
  if ((currentWeek.customSplitLabel ?? '') !== (holidayPlan.customSplitLabel ?? '')) {
    return true;
  }
  if ((currentWeek.holidayNotes ?? '').trim() !== holidayPlan.notes.trim()) {
    return true;
  }
  if (
    currentWeek.stapleMeals.breakfast !== holidayPlan.stapleMeals.breakfast ||
    currentWeek.stapleMeals.lunch !== holidayPlan.stapleMeals.lunch ||
    currentWeek.stapleMeals.dinner !== holidayPlan.stapleMeals.dinner ||
    currentWeek.stapleMeals.snack !== holidayPlan.stapleMeals.snack
  ) {
    return true;
  }
  if (
    JSON.stringify(currentWeek.days) !== JSON.stringify(holidayPlan.days)
  ) {
    return true;
  }
  if (
    JSON.stringify(currentWeek.checklist.map((i) => [i.category, i.text])) !==
    JSON.stringify(holidayPlan.checklist.map((i) => [i.category, i.text]))
  ) {
    return true;
  }
  return false;
}

/**
 * Validates and normalizes an array of stored CustomHolidayPlans from localStorage.
 */
export function parseStoredHolidayPlans(raw: unknown): CustomHolidayPlan[] {
  if (!Array.isArray(raw)) return [];
  const validSplitIds = new Set<string>(SPLIT_PRESETS.map((p) => p.id));
  const validLimits = new Set<string>(PREP_TIME_LIMITS);
  const result: CustomHolidayPlan[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    if (typeof obj.id !== 'string' || !obj.id.trim()) continue;
    if (typeof obj.name !== 'string' || !obj.name.trim()) continue;

    // Validate days, meals, and checklist through parseImportedPlan for safety
    const probe = parseImportedPlan(
      JSON.stringify({
        version: 1,
        weekStartDate: '2026-01-05',
        holidayTag: obj.name,
        holidayNotes: typeof obj.notes === 'string' ? obj.notes : '',
        caloriesTarget: obj.caloriesTarget,
        proteinTarget: obj.proteinTarget,
        splitPreset:
          typeof obj.splitPreset === 'string' && validSplitIds.has(obj.splitPreset)
            ? obj.splitPreset
            : 'holiday-maintenance',
        customSplitLabel:
          typeof obj.customSplitLabel === 'string'
            ? obj.customSplitLabel
            : undefined,
        prepTimeLimit:
          typeof obj.prepTimeLimit === 'string' &&
          validLimits.has(obj.prepTimeLimit)
            ? obj.prepTimeLimit
            : '30 mins',
        stapleMeals: obj.stapleMeals ?? GYM_STAPLES_MEALS,
        days: Array.isArray(obj.days)
          ? obj.days
          : buildDaysFromPreset('holiday-maintenance'),
        checklist: Array.isArray(obj.checklist)
          ? obj.checklist
          : buildDefaultChecklist('30 mins'),
      }),
    );

    if (!probe.ok) continue;

    result.push({
      id: obj.id.trim(),
      name: obj.name.trim(),
      notes: typeof obj.notes === 'string' ? obj.notes.trim() : '',
      caloriesTarget: probe.plan.caloriesTarget,
      proteinTarget: probe.plan.proteinTarget,
      prepTimeLimit: probe.plan.prepTimeLimit,
      splitPreset: probe.plan.splitPreset,
      customSplitLabel: probe.plan.customSplitLabel,
      stapleMeals: probe.plan.stapleMeals,
      days: probe.plan.days,
      checklist: probe.plan.checklist,
      updatedAt:
        typeof obj.updatedAt === 'string' && obj.updatedAt.trim()
          ? obj.updatedAt
          : new Date().toISOString(),
    });
  }

  return result;
}
