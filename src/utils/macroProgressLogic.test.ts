import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultPlan, parseImportedPlan } from './planLogic';
import {
  applySampleWeekIntake,
  clearWeekProgress,
  computeDayMacroProgress,
  computeWeeklyCalorieTrend,
  computeWeeklySnapshot,
  estimateDaySlotMacros,
  extractExplicitMealMacros,
  resetDayProgress,
  sanitizeDailyProgress,
  toggleMealCompletion,
  toggleWorkoutCompletion,
  updateDayExtraIntake,
} from './macroProgressLogic';

test('estimateDaySlotMacros sums to daily targets when meals have no explicit macros', () => {
  const plan = createDefaultPlan();
  const slots = estimateDaySlotMacros(plan.stapleMeals, 2200, 160);
  const totalCal =
    slots.breakfast.calories +
    slots.lunch.calories +
    slots.dinner.calories +
    slots.snack.calories;
  const totalProt =
    slots.breakfast.protein +
    slots.lunch.protein +
    slots.dinner.protein +
    slots.snack.protein;

  assert.equal(totalCal, 2200);
  assert.equal(totalProt, 160);
});

test('extractExplicitMealMacros parses explicit kcal and protein values', () => {
  assert.deepEqual(
    extractExplicitMealMacros('Paneer Bhurji Bowl (580 kcal, 46g protein)'),
    { calories: 580, protein: 46 },
  );
  assert.deepEqual(
    extractExplicitMealMacros('Whey shake 30g P & banana 250 cal'),
    { calories: 250, protein: 30 },
  );
  assert.deepEqual(extractExplicitMealMacros('Oats with berries'), {
    calories: undefined,
    protein: undefined,
  });
});

test('toggling meals, adding extra intake, and resetting day updates progress accurately', () => {
  let plan = createDefaultPlan();
  plan = toggleMealCompletion(plan, 0, 'breakfast');
  plan = toggleMealCompletion(plan, 0, 'lunch');

  let stats = computeDayMacroProgress(plan, 0);
  assert.equal(stats.mealsCompletedCount, 2);
  assert.equal(stats.caloriesPercent, 55);
  assert.equal(stats.proteinPercent, 55);
  assert.equal(stats.caloriesStatus, 'in-progress');
  assert.equal(stats.proteinStatus, 'in-progress');

  // Complete remaining 2 meals -> hits 100% target
  plan = toggleMealCompletion(plan, 0, 'dinner');
  plan = toggleMealCompletion(plan, 0, 'snack');
  stats = computeDayMacroProgress(plan, 0);
  assert.equal(stats.mealsCompletedCount, 4);
  assert.equal(stats.caloriesConsumed, 2200);
  assert.equal(stats.proteinConsumed, 160);
  assert.equal(stats.caloriesStatus, 'on-target');
  assert.equal(stats.proteinStatus, 'hit');

  // Add extra intake -> pushes calories over 110% while capping bar at 100
  plan = updateDayExtraIntake(plan, 0, 350, 25);
  stats = computeDayMacroProgress(plan, 0);
  assert.equal(stats.caloriesConsumed, 2550);
  assert.equal(stats.proteinConsumed, 185);
  assert.equal(stats.caloriesStatus, 'over');
  assert.equal(stats.caloriesBarPercent, 100);

  // Reset day clears back to 0
  plan = resetDayProgress(plan, 0);
  stats = computeDayMacroProgress(plan, 0);
  assert.equal(stats.mealsCompletedCount, 0);
  assert.equal(stats.caloriesConsumed, 0);
  assert.equal(stats.proteinConsumed, 0);
});

test('sanitizeDailyProgress and parseImportedPlan round-trip daily progress safely', () => {
  let plan = createDefaultPlan();
  plan = toggleMealCompletion(plan, 2, 'breakfast');
  plan = updateDayExtraIntake(plan, 2, 200, 30);

  const imported = parseImportedPlan(JSON.stringify(plan));
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.deepEqual(imported.plan.dailyProgress?.[2], {
      completedMeals: ['breakfast'],
      extraCalories: 200,
      extraProtein: 30,
    });
  }

  const sanitized = sanitizeDailyProgress({
    0: { completedMeals: ['breakfast', 'invalid'], extraCalories: -20, extraProtein: 25 },
    99: { completedMeals: ['lunch'], extraCalories: 100, extraProtein: 10 },
  });
  assert.deepEqual(sanitized, {
    0: { completedMeals: ['breakfast'], extraCalories: 0, extraProtein: 25 },
  });
});

test('computeWeeklySnapshot reports empty state, logged-day intake averages, and training adherence accurately', () => {
  let plan = createDefaultPlan();

  // Empty week
  let snap = computeWeeklySnapshot(plan);
  assert.equal(snap.avgCaloriesPercent, 0);
  assert.equal(snap.avgProteinPercent, 0);
  assert.equal(snap.loggedDaysCount, 0);
  assert.equal(snap.workoutsCompletedCount, 0);
  assert.equal(snap.scheduledWorkoutsCount, 6); // PPL has 6 training days + 1 rest day
  assert.equal(snap.trainingAdherencePercent, 0);
  assert.equal(snap.totalMealsCompleted, 0);
  assert.equal(snap.totalMealsPossible, 28);

  // Monday: all 4 meals (100% cal/prot) + workout completed
  plan = toggleMealCompletion(plan, 0, 'breakfast');
  plan = toggleMealCompletion(plan, 0, 'lunch');
  plan = toggleMealCompletion(plan, 0, 'dinner');
  plan = toggleMealCompletion(plan, 0, 'snack');
  plan = toggleWorkoutCompletion(plan, 0);

  // Tuesday: breakfast + lunch (~55% cal/prot)
  plan = toggleMealCompletion(plan, 1, 'breakfast');
  plan = toggleMealCompletion(plan, 1, 'lunch');

  snap = computeWeeklySnapshot(plan);
  assert.equal(snap.loggedDaysCount, 2);
  assert.equal(snap.avgCaloriesPercent, 78); // round((100 + 55) / 2)
  assert.equal(snap.avgProteinPercent, 78);
  assert.equal(snap.totalMealsCompleted, 6);
  assert.equal(snap.workoutsCompletedCount, 1);
  assert.equal(snap.trainingAdherencePercent, 17); // round(1/6 * 100)
  assert.equal(snap.days[0].workoutCompleted, true);
  assert.equal(snap.days[1].workoutCompleted, false);

  // Round-trip persistence preserves workoutCompleted
  const imported = parseImportedPlan(JSON.stringify(plan));
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.plan.dailyProgress?.[0]?.workoutCompleted, true);
  }
});

test('computeWeeklyCalorieTrend tracks 7-day intake vs target, sample week, and clearing', () => {
  let plan = createDefaultPlan();

  // Empty week
  let trend = computeWeeklyCalorieTrend(plan);
  assert.equal(trend.points.length, 7);
  assert.equal(trend.loggedDaysCount, 0);
  assert.equal(trend.avgIntake, 0);
  assert.equal(trend.weeklyTotalIntake, 0);
  assert.equal(trend.weeklyTotalTarget, plan.caloriesTarget * 7);
  assert.equal(trend.daysOnTarget, 0);
  assert.ok(trend.yAxisMax >= plan.caloriesTarget);

  // Sample 7-day log populates all 7 days with realistic variance around target
  plan = applySampleWeekIntake(plan);
  trend = computeWeeklyCalorieTrend(plan);
  assert.equal(trend.loggedDaysCount, 7);
  assert.ok(trend.avgIntake > 1500);
  assert.ok(trend.daysOnTarget >= 4);
  assert.equal(trend.points[0].intake, plan.caloriesTarget);
  assert.equal(trend.points[0].delta, 0);
  assert.ok(trend.points[5].intake > plan.caloriesTarget);
  assert.ok(trend.yAxisMax >= trend.points[5].intake);

  // Clearing week resets back to 0 logged days
  plan = clearWeekProgress(plan);
  trend = computeWeeklyCalorieTrend(plan);
  assert.equal(trend.loggedDaysCount, 0);
  assert.equal(trend.weeklyTotalIntake, 0);
});


