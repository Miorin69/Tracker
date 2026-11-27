import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoachBriefPrompt,
  buildCoachCacheKey,
  parseExercisesFromText,
  sanitizeCoachBrief,
} from './coachLogic.ts';

test('parseExercisesFromText splits exercise lists cleanly while preserving numeric commas', () => {
  assert.deepEqual(
    parseExercisesFromText('Back Squat 4×6, Romanian Deadlift 3×8, Plank 3×60s'),
    ['Back Squat 4×6', 'Romanian Deadlift 3×8', 'Plank 3×60s'],
  );

  assert.deepEqual(
    parseExercisesFromText('8,000–10,000 steps outdoor walk, 10-min shoulder mobility'),
    ['8,000–10,000 steps outdoor walk', '10-min shoulder mobility'],
  );

  assert.deepEqual(parseExercisesFromText('   '), []);
});

test('buildCoachBriefPrompt builds exercise and meal prompts with follow-up questions', () => {
  const exPrompt = buildCoachBriefPrompt({
    selection: {
      kind: 'exercise',
      dayIndex: 0,
      dayName: 'Monday',
      title: 'Flat Bench 4×6',
      workoutContext: 'Push A — Chest & Shoulders',
    },
    planContext: {
      caloriesTarget: 2200,
      proteinTarget: 160,
      prepTimeLimit: '60 mins',
      holidayTag: 'Normal Week',
    },
    followUpQuestion: 'How wide should my grip be?',
  });

  assert.match(exPrompt, /SELECTED EXERCISE: "Flat Bench 4×6"/);
  assert.match(exPrompt, /How wide should my grip be\?/);

  const mealPrompt = buildCoachBriefPrompt({
    selection: {
      kind: 'meal',
      dayIndex: 1,
      dayName: 'Tuesday',
      mealSlot: 'lunch',
      title: 'Grilled chicken breast (180g), jasmine rice',
    },
    planContext: {
      caloriesTarget: 2200,
      proteinTarget: 160,
      prepTimeLimit: '60 mins',
      holidayTag: 'Normal Week',
    },
  });

  assert.match(mealPrompt, /SELECTED MEAL \(Lunch\)/);
  assert.match(mealPrompt, /vegetarian swap/i);
});

test('sanitizeCoachBrief normalizes exercise and meal outputs safely', () => {
  const ex = sanitizeCoachBrief(
    {
      headline: 'Foundational Horizontal Press',
      coachNote: 'Builds chest and anterior deltoid strength.',
      targetMuscles: ['Pectoralis Major', 'Triceps', ''],
      formCues: ['Retract shoulder blades', 'Drive feet into floor'],
      commonMistakes: ['Flaring elbows to 90 degrees'],
      progressionTip: 'Add 2.5kg once all 4×6 reps move cleanly.',
      alternatives: ['Dumbbell Bench Press', 'Weighted Dips'],
    },
    'exercise',
  );

  assert.equal(ex.kind, 'exercise');
  assert.deepEqual(ex.targetMuscles, ['Pectoralis Major', 'Triceps']);
  assert.equal(ex.formCues?.length, 2);

  const meal = sanitizeCoachBrief(
    {
      headline: 'Balanced High-Protein Lunch',
      coachNote: 'Strong leucine hit with fast-digesting starch.',
      estimatedMacros: {
        calories: 590.4,
        proteinGrams: 52.8,
        carbsGrams: 55,
        fatGrams: -4,
      },
      smartSwaps: ['Swap chicken for 200g grilled paneer or firm tofu'],
    },
    'meal',
  );

  assert.equal(meal.kind, 'meal');
  assert.deepEqual(meal.estimatedMacros, {
    calories: 590,
    proteinGrams: 53,
    carbsGrams: 55,
    fatGrams: 0,
  });

  assert.equal(
    buildCoachCacheKey({
      kind: 'meal',
      dayIndex: 1,
      dayName: 'Tuesday',
      mealSlot: 'lunch',
      title: 'Paneer Bowl',
    }),
    'meal:1:lunch:paneer bowl',
  );
});
