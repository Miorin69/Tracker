import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultPlan } from './planLogic';
import {
  buildAiAdjustmentPrompt,
  hasCompleteFlexVegOverrides,
  mergeAiAdjustedPlan,
  summarizePlanChanges,
} from './aiPlanMerge';

test('buildAiAdjustmentPrompt includes flexible vegetarian days, holiday notes, and user instructions', () => {
  const plan = createDefaultPlan(new Date(2026, 10, 25));
  plan.holidayTag = 'Summer Trip';
  plan.holidayNotes = '30-min hotel gym workouts';
  const prompt = buildAiAdjustmentPrompt({
    currentPlan: plan,
    instruction: 'Shorten Tuesday session to 30 mins and add paneer dishes',
    dietMode: 'flex-vegetarian',
    vegetarianDays: [1, 3],
    scope: 'both',
  });

  assert.match(prompt, /Tuesday \(dayIndex 1\)/);
  assert.match(prompt, /Thursday \(dayIndex 3\)/);
  assert.match(prompt, /Shorten Tuesday session to 30 mins/);
  assert.match(prompt, /30-min hotel gym workouts/);
  assert.match(prompt, /Adjust BOTH training schedule and food/);
});

test('mergeAiAdjustedPlan respects training-only scope and leaves meals untouched', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  const { plan, changes } = mergeAiAdjustedPlan(
    base,
    {
      summary: 'Updated Monday to kettlebell conditioning.',
      splitLabel: 'Kettlebell Hybrid Split',
      caloriesTarget: 3000,
      stapleMeals: { breakfast: 'Should be ignored' },
      days: [
        {
          dayIndex: 0,
          workoutTitle: 'Kettlebell Power',
          exercises: 'KB Swings 5×15, Goblet Squat 4×10',
          durationMinutes: 35,
          isRestDay: false,
          mealOverrides: { dinner: 'Should be ignored' },
        },
      ],
      groceryItems: ['Ignored grocery'],
    },
    'training',
  );

  assert.equal(plan.days[0].workoutTitle, 'Kettlebell Power');
  assert.equal(plan.days[0].durationMinutes, 35);
  assert.equal(plan.days[0].mealOverrides, undefined);
  assert.equal(plan.customSplitLabel, 'Kettlebell Hybrid Split');
  assert.equal(plan.caloriesTarget, base.caloriesTarget);
  assert.equal(plan.stapleMeals.breakfast, base.stapleMeals.breakfast);
  assert.deepEqual(plan.checklist, base.checklist);
  assert.equal(changes.hasChanges, true);
  assert.deepEqual(changes.changedDayIndices, [0]);
});

test('mergeAiAdjustedPlan respects food-only scope and applies vegetarian day overrides', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  const { plan, summary, changes } = mergeAiAdjustedPlan(
    base,
    {
      summary: 'Swapped Tuesday and Thursday to high-protein vegetarian meals.',
      days: [
        {
          dayIndex: 1,
          workoutTitle: 'Should be ignored',
          durationMinutes: 10,
          mealOverrides: {
            lunch: 'Paneer tikka bowl (200g), quinoa & roasted peppers',
            dinner: 'Tofu & lentil curry (200g) with brown rice',
          },
        },
      ],
      prepSteps: ['Press tofu and marinate paneer cubes (15 mins)'],
      groceryItems: ['Paneer (400g)', 'Firm tofu (400g)', 'Red lentils (500g)'],
    },
    'food',
  );

  assert.equal(
    summary,
    'Swapped Tuesday and Thursday to high-protein vegetarian meals.',
  );
  // Training unchanged
  assert.equal(plan.days[1].workoutTitle, base.days[1].workoutTitle);
  assert.equal(plan.days[1].durationMinutes, base.days[1].durationMinutes);
  // Vegetarian overrides applied
  assert.equal(
    plan.days[1].mealOverrides?.lunch,
    'Paneer tikka bowl (200g), quinoa & roasted peppers',
  );
  // Checklist updated
  assert.equal(plan.checklist.filter((i) => i.category === 'prep').length, 1);
  assert.equal(plan.checklist.filter((i) => i.category === 'grocery').length, 3);
  assert.equal(changes.hasChanges, true);
  assert.deepEqual(changes.changedDayIndices, [1]);
});

test('mergeAiAdjustedPlan normalizes 1-based dayIndex (1..7) and numeric strings cleanly', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  const oneBasedDays = base.days.map((d, idx) => ({
    dayIndex: String(idx + 1), // 1..7 as strings!
    workoutTitle: idx === 0 ? 'Express Dumbbell Upper' : d.workoutTitle,
    warmup: d.warmup,
    exercises: idx === 0 ? 'DB Bench 4×10, DB Row 4×10' : d.exercises,
    durationMinutes: idx === 0 ? '30' : d.durationMinutes,
    isRestDay: d.isRestDay,
  }));

  const { plan, changes } = mergeAiAdjustedPlan(
    base,
    {
      summary: 'Updated Monday to 30-min dumbbell upper.',
      caloriesTarget: '2050',
      proteinTarget: '170',
      days: oneBasedDays,
    },
    'both',
  );

  assert.equal(plan.days[0].workoutTitle, 'Express Dumbbell Upper');
  assert.equal(plan.days[0].durationMinutes, 30);
  assert.equal(plan.caloriesTarget, 2050);
  assert.equal(plan.proteinTarget, 170);
  assert.equal(changes.hasChanges, true);
  assert.ok(changes.changedDayIndices.includes(0));
});

test('mergeAiAdjustedPlan clears stale mealOverrides on full-week vegetarian switch', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  base.days[1].mealOverrides = {
    lunch: 'Old grilled chicken wrap',
  };

  const { plan } = mergeAiAdjustedPlan(
    base,
    {
      summary: 'Switched full week to vegetarian staples.',
      stapleMeals: {
        breakfast: 'Tofu scramble & whole-grain toast',
        lunch: 'Paneer tikka bowl (180g) & basmati rice',
        dinner: 'Red lentil dal & roasted vegetables',
        snack: 'Greek yogurt (250g) & almonds',
      },
      days: base.days.map((d) => ({
        dayIndex: d.dayIndex,
        workoutTitle: d.workoutTitle,
        exercises: d.exercises,
        durationMinutes: d.durationMinutes,
        isRestDay: d.isRestDay,
        // Simulates model echoing back stale Tuesday override unchanged
        mealOverrides: d.mealOverrides,
      })),
    },
    'food',
    { dietMode: 'vegetarian' },
  );

  assert.equal(plan.stapleMeals.lunch, 'Paneer tikka bowl (180g) & basmati rice');
  assert.equal(plan.days[1].mealOverrides, undefined);
});

test('summarizePlanChanges detects no-op payloads accurately', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  const same = structuredClone(base);
  const diff = summarizePlanChanges(base, same);

  assert.equal(diff.hasChanges, false);
  assert.deepEqual(diff.highlights, []);
  assert.deepEqual(diff.changedDayIndices, []);
});

test('hasCompleteFlexVegOverrides rejects flex-vegetarian plans missing any meal slot', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  base.days[1].mealOverrides = {
    breakfast: 'Greek yogurt & oats',
    lunch: 'Paneer tikka bowl',
    snack: 'Whey shake & banana',
    // dinner omitted!
  };
  assert.equal(
    hasCompleteFlexVegOverrides(base, 'flex-vegetarian', [1]),
    false,
  );

  base.days[1].mealOverrides.dinner = 'Tofu & lentil stir-fry with sweet potato';
  assert.equal(
    hasCompleteFlexVegOverrides(base, 'flex-vegetarian', [1]),
    true,
  );
});
