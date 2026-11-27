import type {
  DayIndex,
  DayMacroProgress,
  MealSlot,
  StapleMeals,
  WeeklyPlan,
} from '../types/plan.ts';

export const MEAL_SLOTS: readonly MealSlot[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Pre / Post Snack',
};

const MEAL_SLOT_WEIGHTS: Record<MealSlot, number> = {
  breakfast: 0.24,
  lunch: 0.31,
  dinner: 0.31,
  snack: 0.14,
};

export interface SlotMacroEstimate {
  calories: number;
  protein: number;
}

export interface ComputedDayMacroProgress {
  dayIndex: DayIndex;
  slotMacros: Record<MealSlot, SlotMacroEstimate>;
  completedMeals: MealSlot[];
  extraCalories: number;
  extraProtein: number;
  caloriesConsumed: number;
  caloriesTarget: number;
  caloriesRemaining: number;
  caloriesPercent: number;
  caloriesBarPercent: number;
  caloriesStatus: 'in-progress' | 'on-target' | 'over';
  proteinConsumed: number;
  proteinTarget: number;
  proteinRemaining: number;
  proteinPercent: number;
  proteinBarPercent: number;
  proteinStatus: 'in-progress' | 'hit';
  mealsCompletedCount: number;
  totalMealsCount: number;
  workoutCompleted: boolean;
}

export interface WeeklySnapshotDaySummary {
  dayIndex: DayIndex;
  shortName: string;
  dayName: string;
  caloriesPercent: number;
  caloriesBarPercent: number;
  proteinPercent: number;
  proteinBarPercent: number;
  mealsCompletedCount: number;
  isRestDay: boolean;
  workoutCompleted: boolean;
  hasNutritionLogged: boolean;
}

export interface WeeklySnapshotStats {
  avgCaloriesPercent: number;
  avgCaloriesBarPercent: number;
  avgProteinPercent: number;
  avgProteinBarPercent: number;
  avgCaloriesPerDay: number;
  avgProteinPerDay: number;
  weeklyCaloriesPercent: number;
  weeklyProteinPercent: number;
  loggedDaysCount: number;
  totalMealsCompleted: number;
  totalMealsPossible: number;
  mealsAdherencePercent: number;
  workoutsCompletedCount: number;
  scheduledWorkoutsCount: number;
  trainingAdherencePercent: number;
  adherenceLabel: string;
  adherenceHint: string;
  days: WeeklySnapshotDaySummary[];
}

export interface WeeklyCalorieTrendPoint {
  dayIndex: DayIndex;
  shortName: string;
  dayName: string;
  intake: number;
  target: number;
  delta: number;
  percent: number;
  mealsCompletedCount: number;
  hasLogged: boolean;
}

export interface WeeklyCalorieTrendData {
  points: WeeklyCalorieTrendPoint[];
  loggedDaysCount: number;
  avgIntake: number;
  weeklyTotalIntake: number;
  weeklyTotalTarget: number;
  daysOnTarget: number;
  yAxisMax: number;
}

/**
 * Extracts explicit calorie or protein annotations from a meal description
 * if present (e.g., "550 kcal", "45g protein", "42g P").
 */
export function extractExplicitMealMacros(mealText: string): {
  calories?: number;
  protein?: number;
} {
  const calMatch = /(\d{2,4})\s*(?:kcal|cals?|calories)\b/i.exec(mealText);
  const protMatch =
    /(\d{1,3})\s*g(?:\s*(?:protein|pro|p)\b)/i.exec(mealText) ??
    /(\d{1,3})\s*(?:g\s*)?protein\b/i.exec(mealText);

  const calories = calMatch ? Number(calMatch[1]) : undefined;
  const protein = protMatch ? Number(protMatch[1]) : undefined;

  return {
    calories:
      calories !== undefined && Number.isFinite(calories) && calories >= 30 && calories <= 3000
        ? Math.round(calories)
        : undefined,
    protein:
      protein !== undefined && Number.isFinite(protein) && protein >= 1 && protein <= 200
        ? Math.round(protein)
        : undefined,
  };
}

function distributeAcrossSlots(
  totalTarget: number,
  explicitValues: Partial<Record<MealSlot, number>>,
): Record<MealSlot, number> {
  const safeTarget = Math.max(0, Math.round(totalTarget));
  const result: Record<MealSlot, number> = {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0,
  };

  let explicitSum = 0;
  const unspecifiedSlots: MealSlot[] = [];

  for (const slot of MEAL_SLOTS) {
    const val = explicitValues[slot];
    if (typeof val === 'number' && Number.isFinite(val)) {
      result[slot] = Math.max(0, Math.round(val));
      explicitSum += result[slot];
    } else {
      unspecifiedSlots.push(slot);
    }
  }

  if (unspecifiedSlots.length === 0) {
    return result;
  }

  const remaining = Math.max(0, safeTarget - explicitSum);
  const weightSum = unspecifiedSlots.reduce(
    (sum, slot) => sum + MEAL_SLOT_WEIGHTS[slot],
    0,
  );

  let allocated = 0;
  unspecifiedSlots.forEach((slot, idx) => {
    if (idx === unspecifiedSlots.length - 1) {
      result[slot] = Math.max(0, remaining - allocated);
    } else {
      const share =
        weightSum > 0
          ? Math.round((remaining * MEAL_SLOT_WEIGHTS[slot]) / weightSum)
          : Math.round(remaining / unspecifiedSlots.length);
      result[slot] = Math.max(0, share);
      allocated += result[slot];
    }
  });

  return result;
}

/**
 * Estimates per-meal calorie and protein shares for a day's 4 meal slots.
 * Honors explicit values in meal text and distributes remaining daily targets
 * proportionally so checking off all 4 planned meals hits 100% of target.
 */
export function estimateDaySlotMacros(
  meals: StapleMeals,
  caloriesTarget: number,
  proteinTarget: number,
): Record<MealSlot, SlotMacroEstimate> {
  const explicitCalories: Partial<Record<MealSlot, number>> = {};
  const explicitProtein: Partial<Record<MealSlot, number>> = {};

  for (const slot of MEAL_SLOTS) {
    const parsed = extractExplicitMealMacros(meals[slot] || '');
    if (parsed.calories !== undefined) explicitCalories[slot] = parsed.calories;
    if (parsed.protein !== undefined) explicitProtein[slot] = parsed.protein;
  }

  const calMap = distributeAcrossSlots(caloriesTarget, explicitCalories);
  const protMap = distributeAcrossSlots(proteinTarget, explicitProtein);

  return {
    breakfast: { calories: calMap.breakfast, protein: protMap.breakfast },
    lunch: { calories: calMap.lunch, protein: protMap.lunch },
    dinner: { calories: calMap.dinner, protein: protMap.dinner },
    snack: { calories: calMap.snack, protein: protMap.snack },
  };
}

export function getDayProgress(
  plan: WeeklyPlan,
  dayIndex: DayIndex,
): DayMacroProgress {
  const entry = plan.dailyProgress?.[dayIndex];
  if (!entry) {
    return {
      completedMeals: [],
      extraCalories: 0,
      extraProtein: 0,
      workoutCompleted: false,
    };
  }
  const validSlots = new Set<string>(MEAL_SLOTS);
  const completedMeals = Array.from(
    new Set(
      (Array.isArray(entry.completedMeals) ? entry.completedMeals : []).filter(
        (slot): slot is MealSlot => validSlots.has(slot),
      ),
    ),
  );
  return {
    completedMeals,
    extraCalories:
      typeof entry.extraCalories === 'number' &&
      Number.isFinite(entry.extraCalories)
        ? Math.max(0, Math.min(5000, Math.round(entry.extraCalories)))
        : 0,
    extraProtein:
      typeof entry.extraProtein === 'number' &&
      Number.isFinite(entry.extraProtein)
        ? Math.max(0, Math.min(400, Math.round(entry.extraProtein)))
        : 0,
    workoutCompleted: Boolean(entry.workoutCompleted),
  };
}

export function computeDayMacroProgress(
  plan: WeeklyPlan,
  dayIndex: DayIndex,
): ComputedDayMacroProgress {
  const day = plan.days[dayIndex] ?? plan.days[0];
  const meals: StapleMeals = {
    breakfast: day.mealOverrides?.breakfast?.trim() || plan.stapleMeals.breakfast,
    lunch: day.mealOverrides?.lunch?.trim() || plan.stapleMeals.lunch,
    dinner: day.mealOverrides?.dinner?.trim() || plan.stapleMeals.dinner,
    snack: day.mealOverrides?.snack?.trim() || plan.stapleMeals.snack,
  };
  const slotMacros = estimateDaySlotMacros(
    meals,
    plan.caloriesTarget,
    plan.proteinTarget,
  );
  const progress = getDayProgress(plan, dayIndex);

  let mealCalories = 0;
  let mealProtein = 0;
  for (const slot of progress.completedMeals) {
    mealCalories += slotMacros[slot].calories;
    mealProtein += slotMacros[slot].protein;
  }

  const caloriesConsumed = mealCalories + progress.extraCalories;
  const proteinConsumed = mealProtein + progress.extraProtein;
  const caloriesTarget = Math.max(1, Math.round(plan.caloriesTarget));
  const proteinTarget = Math.max(1, Math.round(plan.proteinTarget));

  const caloriesPercent = Math.round((caloriesConsumed / caloriesTarget) * 100);
  const proteinPercent = Math.round((proteinConsumed / proteinTarget) * 100);

  const caloriesStatus: ComputedDayMacroProgress['caloriesStatus'] =
    caloriesPercent > 110
      ? 'over'
      : caloriesPercent >= 95
        ? 'on-target'
        : 'in-progress';

  const proteinStatus: ComputedDayMacroProgress['proteinStatus'] =
    proteinPercent >= 95 ? 'hit' : 'in-progress';

  return {
    dayIndex,
    slotMacros,
    completedMeals: progress.completedMeals,
    extraCalories: progress.extraCalories,
    extraProtein: progress.extraProtein,
    caloriesConsumed,
    caloriesTarget,
    caloriesRemaining: caloriesTarget - caloriesConsumed,
    caloriesPercent,
    caloriesBarPercent: Math.min(100, Math.max(0, caloriesPercent)),
    caloriesStatus,
    proteinConsumed,
    proteinTarget,
    proteinRemaining: proteinTarget - proteinConsumed,
    proteinPercent,
    proteinBarPercent: Math.min(100, Math.max(0, proteinPercent)),
    proteinStatus,
    mealsCompletedCount: progress.completedMeals.length,
    totalMealsCount: MEAL_SLOTS.length,
    workoutCompleted: Boolean(progress.workoutCompleted),
  };
}

export function toggleWorkoutCompletion(
  plan: WeeklyPlan,
  dayIndex: DayIndex,
): WeeklyPlan {
  const current = getDayProgress(plan, dayIndex);
  return {
    ...plan,
    dailyProgress: {
      ...(plan.dailyProgress ?? {}),
      [dayIndex]: {
        ...current,
        workoutCompleted: !current.workoutCompleted,
      },
    },
  };
}

/**
 * Computes weekly adherence snapshot metrics for the top-of-dashboard
 * Weekly Snapshot widget across all 7 days of the active plan.
 */
export function computeWeeklySnapshot(plan: WeeklyPlan): WeeklySnapshotStats {
  let loggedDaysCount = 0;
  let loggedCalPctSum = 0;
  let loggedProtPctSum = 0;
  let loggedCalSum = 0;
  let loggedProtSum = 0;
  let totalMealsCompleted = 0;
  let scheduledWorkoutsCount = 0;
  let workoutsCompletedCount = 0;

  const days: WeeklySnapshotDaySummary[] = plan.days.map((day) => {
    const stats = computeDayMacroProgress(plan, day.dayIndex);
    const hasNutritionLogged =
      stats.mealsCompletedCount > 0 ||
      stats.extraCalories > 0 ||
      stats.extraProtein > 0;
    const isTrainingDay = !day.isRestDay && day.durationMinutes > 0;

    if (hasNutritionLogged) {
      loggedDaysCount += 1;
      loggedCalPctSum += stats.caloriesPercent;
      loggedProtPctSum += stats.proteinPercent;
      loggedCalSum += stats.caloriesConsumed;
      loggedProtSum += stats.proteinConsumed;
    }

    totalMealsCompleted += stats.mealsCompletedCount;

    if (isTrainingDay) {
      scheduledWorkoutsCount += 1;
      if (stats.workoutCompleted) {
        workoutsCompletedCount += 1;
      }
    }

    return {
      dayIndex: day.dayIndex,
      shortName: day.shortName,
      dayName: day.dayName,
      caloriesPercent: stats.caloriesPercent,
      caloriesBarPercent: stats.caloriesBarPercent,
      proteinPercent: stats.proteinPercent,
      proteinBarPercent: stats.proteinBarPercent,
      mealsCompletedCount: stats.mealsCompletedCount,
      isRestDay: !isTrainingDay,
      workoutCompleted: stats.workoutCompleted,
      hasNutritionLogged,
    };
  });

  const avgCaloriesPercent =
    loggedDaysCount > 0 ? Math.round(loggedCalPctSum / loggedDaysCount) : 0;
  const avgProteinPercent =
    loggedDaysCount > 0 ? Math.round(loggedProtPctSum / loggedDaysCount) : 0;
  const avgCaloriesPerDay =
    loggedDaysCount > 0 ? Math.round(loggedCalSum / loggedDaysCount) : 0;
  const avgProteinPerDay =
    loggedDaysCount > 0 ? Math.round(loggedProtSum / loggedDaysCount) : 0;

  const totalWeekCalTarget = Math.max(1, plan.caloriesTarget * 7);
  const totalWeekProtTarget = Math.max(1, plan.proteinTarget * 7);
  const weeklyCaloriesPercent = Math.round(
    (loggedCalSum / totalWeekCalTarget) * 100,
  );
  const weeklyProteinPercent = Math.round(
    (loggedProtSum / totalWeekProtTarget) * 100,
  );

  const totalMealsPossible = plan.days.length * MEAL_SLOTS.length;
  const mealsAdherencePercent =
    totalMealsPossible > 0
      ? Math.round((totalMealsCompleted / totalMealsPossible) * 100)
      : 0;

  const trainingAdherencePercent =
    scheduledWorkoutsCount > 0
      ? Math.round((workoutsCompletedCount / scheduledWorkoutsCount) * 100)
      : 100;

  let adherenceLabel = 'Ready to track';
  let adherenceHint =
    'Check off meals or workouts in the sheet below to see weekly averages live.';

  if (loggedDaysCount > 0 || workoutsCompletedCount > 0) {
    if (avgProteinPercent >= 90 && avgCaloriesPercent >= 85 && avgCaloriesPercent <= 110) {
      adherenceLabel = 'Dialed in';
      adherenceHint =
        workoutsCompletedCount > 0
          ? `Strong nutrition & ${workoutsCompletedCount}/${scheduledWorkoutsCount} sessions completed.`
          : 'Nutrition targets are right on pace across logged days.';
    } else if (avgProteinPercent < 80 && loggedDaysCount > 0) {
      adherenceLabel = 'Boost protein';
      adherenceHint = `Protein is averaging ${avgProteinPercent}% on logged days — prioritize lean protein next meal.`;
    } else if (avgCaloriesPercent > 110) {
      adherenceLabel = 'Above calorie target';
      adherenceHint = `Averaging ${avgCaloriesPercent}% of daily calories across logged days.`;
    } else {
      adherenceLabel = 'Building momentum';
      adherenceHint = `${loggedDaysCount} of 7 days logged with ${totalMealsCompleted}/${totalMealsPossible} meals checked off.`;
    }
  }

  return {
    avgCaloriesPercent,
    avgCaloriesBarPercent: Math.min(100, Math.max(0, avgCaloriesPercent)),
    avgProteinPercent,
    avgProteinBarPercent: Math.min(100, Math.max(0, avgProteinPercent)),
    avgCaloriesPerDay,
    avgProteinPerDay,
    weeklyCaloriesPercent,
    weeklyProteinPercent,
    loggedDaysCount,
    totalMealsCompleted,
    totalMealsPossible,
    mealsAdherencePercent,
    workoutsCompletedCount,
    scheduledWorkoutsCount,
    trainingAdherencePercent,
    adherenceLabel,
    adherenceHint,
    days,
  };
}

/**
 * Computes the 7-day caloric intake vs. daily target series for the
 * Recharts line graph at the top of the Weekly Command Sheet.
 */
export function computeWeeklyCalorieTrend(
  plan: WeeklyPlan,
): WeeklyCalorieTrendData {
  const safeTarget = Math.max(1, Math.round(plan.caloriesTarget));
  let loggedDaysCount = 0;
  let loggedIntakeSum = 0;
  let weeklyTotalIntake = 0;
  let daysOnTarget = 0;
  let maxIntake = 0;

  const points: WeeklyCalorieTrendPoint[] = plan.days.map((day) => {
    const stats = computeDayMacroProgress(plan, day.dayIndex);
    const hasLogged =
      stats.mealsCompletedCount > 0 ||
      stats.extraCalories > 0 ||
      stats.extraProtein > 0;

    if (hasLogged) {
      loggedDaysCount += 1;
      loggedIntakeSum += stats.caloriesConsumed;
      if (stats.caloriesPercent >= 90 && stats.caloriesPercent <= 110) {
        daysOnTarget += 1;
      }
    }

    weeklyTotalIntake += stats.caloriesConsumed;
    if (stats.caloriesConsumed > maxIntake) {
      maxIntake = stats.caloriesConsumed;
    }

    return {
      dayIndex: day.dayIndex,
      shortName: day.shortName,
      dayName: day.dayName,
      intake: stats.caloriesConsumed,
      target: safeTarget,
      delta: stats.caloriesConsumed - safeTarget,
      percent: stats.caloriesPercent,
      mealsCompletedCount: stats.mealsCompletedCount,
      hasLogged,
    };
  });

  const avgIntake =
    loggedDaysCount > 0 ? Math.round(loggedIntakeSum / loggedDaysCount) : 0;
  const rawCeiling = Math.max(safeTarget * 1.25, maxIntake * 1.15, 500);
  const yAxisMax = Math.ceil(rawCeiling / 250) * 250;

  return {
    points,
    loggedDaysCount,
    avgIntake,
    weeklyTotalIntake,
    weeklyTotalTarget: safeTarget * plan.days.length,
    daysOnTarget,
    yAxisMax,
  };
}

/**
 * Populates a realistic 7-day sample intake log across the current week
 * so users can immediately preview the Recharts trend curve and clear or edit it.
 */
export function applySampleWeekIntake(plan: WeeklyPlan): WeeklyPlan {
  const samplePattern: ReadonlyArray<{
    completedMeals: MealSlot[];
    extraCalories: number;
    extraProtein: number;
    workoutCompleted: boolean;
  }> = [
    {
      completedMeals: ['breakfast', 'lunch', 'dinner', 'snack'],
      extraCalories: 0,
      extraProtein: 0,
      workoutCompleted: true,
    },
    {
      completedMeals: ['breakfast', 'lunch', 'dinner'],
      extraCalories: 120,
      extraProtein: 25,
      workoutCompleted: true,
    },
    {
      completedMeals: ['breakfast', 'lunch', 'dinner', 'snack'],
      extraCalories: 180,
      extraProtein: 15,
      workoutCompleted: true,
    },
    {
      completedMeals: ['breakfast', 'lunch', 'dinner'],
      extraCalories: 0,
      extraProtein: 0,
      workoutCompleted: true,
    },
    {
      completedMeals: ['breakfast', 'lunch', 'dinner', 'snack'],
      extraCalories: 120,
      extraProtein: 25,
      workoutCompleted: true,
    },
    {
      completedMeals: ['breakfast', 'lunch', 'dinner', 'snack'],
      extraCalories: 260,
      extraProtein: 10,
      workoutCompleted: false,
    },
    {
      completedMeals: ['breakfast', 'lunch', 'dinner'],
      extraCalories: 150,
      extraProtein: 20,
      workoutCompleted: false,
    },
  ];

  const nextDailyProgress: Partial<Record<DayIndex, DayMacroProgress>> = {};
  plan.days.forEach((day, idx) => {
    const template = samplePattern[idx % samplePattern.length];
    const isTrainingDay = !day.isRestDay && day.durationMinutes > 0;
    nextDailyProgress[day.dayIndex] = {
      completedMeals: [...template.completedMeals],
      extraCalories: template.extraCalories,
      extraProtein: template.extraProtein,
      ...(isTrainingDay && template.workoutCompleted
        ? { workoutCompleted: true }
        : {}),
    };
  });

  return {
    ...plan,
    dailyProgress: nextDailyProgress,
  };
}

export function toggleMealCompletion(
  plan: WeeklyPlan,
  dayIndex: DayIndex,
  slot: MealSlot,
): WeeklyPlan {
  const current = getDayProgress(plan, dayIndex);
  const exists = current.completedMeals.includes(slot);
  const nextCompleted = exists
    ? current.completedMeals.filter((s) => s !== slot)
    : [...current.completedMeals, slot];

  return {
    ...plan,
    dailyProgress: {
      ...(plan.dailyProgress ?? {}),
      [dayIndex]: {
        ...current,
        completedMeals: nextCompleted,
      },
    },
  };
}

export function updateDayExtraIntake(
  plan: WeeklyPlan,
  dayIndex: DayIndex,
  extraCalories: number,
  extraProtein: number,
): WeeklyPlan {
  const current = getDayProgress(plan, dayIndex);
  const safeCal = Number.isFinite(extraCalories)
    ? Math.max(0, Math.min(5000, Math.round(extraCalories)))
    : current.extraCalories;
  const safeProt = Number.isFinite(extraProtein)
    ? Math.max(0, Math.min(400, Math.round(extraProtein)))
    : current.extraProtein;

  return {
    ...plan,
    dailyProgress: {
      ...(plan.dailyProgress ?? {}),
      [dayIndex]: {
        ...current,
        extraCalories: safeCal,
        extraProtein: safeProt,
      },
    },
  };
}

export function resetDayProgress(
  plan: WeeklyPlan,
  dayIndex: DayIndex,
): WeeklyPlan {
  if (!plan.dailyProgress || !plan.dailyProgress[dayIndex]) {
    return plan;
  }
  const nextProgress = { ...plan.dailyProgress };
  delete nextProgress[dayIndex];
  return {
    ...plan,
    dailyProgress:
      Object.keys(nextProgress).length > 0 ? nextProgress : undefined,
  };
}

export function clearWeekProgress(plan: WeeklyPlan): WeeklyPlan {
  if (!plan.dailyProgress) return plan;
  return {
    ...plan,
    dailyProgress: undefined,
  };
}

export function sanitizeDailyProgress(
  raw: unknown,
): Partial<Record<DayIndex, DayMacroProgress>> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;

  const validSlots = new Set<string>(MEAL_SLOTS);
  const result: Partial<Record<DayIndex, DayMacroProgress>> = {};
  let hasAny = false;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx > 6) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    const entry = value as Record<string, unknown>;
    const completedMeals = Array.from(
      new Set(
        (Array.isArray(entry.completedMeals) ? entry.completedMeals : []).filter(
          (slot): slot is MealSlot =>
            typeof slot === 'string' && validSlots.has(slot),
        ),
      ),
    );
    const extraCalories =
      typeof entry.extraCalories === 'number' &&
      Number.isFinite(entry.extraCalories)
        ? Math.max(0, Math.min(5000, Math.round(entry.extraCalories)))
        : 0;
    const extraProtein =
      typeof entry.extraProtein === 'number' &&
      Number.isFinite(entry.extraProtein)
        ? Math.max(0, Math.min(400, Math.round(entry.extraProtein)))
        : 0;

    const workoutCompleted = Boolean(entry.workoutCompleted);

    if (
      completedMeals.length > 0 ||
      extraCalories > 0 ||
      extraProtein > 0 ||
      workoutCompleted
    ) {
      result[idx as DayIndex] = {
        completedMeals,
        extraCalories,
        extraProtein,
        ...(workoutCompleted ? { workoutCompleted: true } : {}),
      };
      hasAny = true;
    }
  }

  return hasAny ? result : undefined;
}
