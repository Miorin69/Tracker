import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FITNESS_TIPS,
  calculateBmiFromImperial,
  calculateBmiFromMetric,
  classifyBmi,
  cmToFeetInches,
  computeSuggestedTargets,
  feetInchesToCm,
  filterFitnessTips,
  kgToLbs,
  lbsToKg,
  pickContextualTip,
} from './fitnessToolsLogic.ts';
import { createDefaultPlan } from './planLogic.ts';

test('calculateBmiFromMetric computes BMI, category, healthy weight range, and scale percent accurately', () => {
  const normal = calculateBmiFromMetric(175, 70, 'maintain');
  assert.equal(normal.valid, true);
  assert.equal(normal.bmi, 22.9);
  assert.equal(normal.category, 'Healthy Weight');
  assert.equal(normal.healthyWeightMinKg, 56.7);
  assert.equal(normal.healthyWeightMaxKg, 76.3);
  assert.ok(normal.scalePercent > 25 && normal.scalePercent < 40);
  assert.ok(normal.suggestedCalories >= 1800 && normal.suggestedCalories <= 2600);
  assert.ok(normal.suggestedProtein >= 120 && normal.suggestedProtein <= 160);

  const underweight = calculateBmiFromMetric(180, 55, 'lean-bulk');
  assert.equal(underweight.valid, true);
  assert.equal(underweight.category, 'Underweight');
  assert.equal(underweight.bmi, 17);

  const overweight = calculateBmiFromMetric(175, 85, 'fat-loss');
  assert.equal(overweight.valid, true);
  assert.equal(overweight.category, 'Overweight');
  assert.equal(overweight.bmi, 27.8);

  const obese = calculateBmiFromMetric(170, 95, 'fat-loss');
  assert.equal(obese.valid, true);
  assert.equal(obese.category, 'Obese');
  assert.equal(obese.bmi, 32.9);
});

test('calculateBmiFromMetric and calculateBmiFromImperial reject out-of-range inputs cleanly', () => {
  assert.equal(calculateBmiFromMetric(50, 70).valid, false);
  assert.equal(calculateBmiFromMetric(175, 10).valid, false);
  assert.equal(calculateBmiFromImperial(2, 5, 160).valid, false);
  assert.equal(calculateBmiFromImperial(5, 12, 160).valid, false);
  assert.equal(calculateBmiFromImperial(5, 10, 40).valid, false);
});

test('imperial BMI calculation and unit conversions agree with metric calculation', () => {
  const imp = calculateBmiFromImperial(5, 10, 170, 'maintain');
  assert.equal(imp.valid, true);
  assert.equal(imp.bmi, 24.4);
  assert.equal(imp.category, 'Healthy Weight');

  const { feet, inches } = cmToFeetInches(178);
  assert.equal(feet, 5);
  assert.equal(inches, 10);
  assert.ok(Math.abs(feetInchesToCm(5, 10) - 177.8) < 0.2);
  assert.ok(Math.abs(lbsToKg(kgToLbs(75)) - 75) < 0.2);

  assert.equal(classifyBmi(18.4), 'Underweight');
  assert.equal(classifyBmi(18.5), 'Healthy Weight');
  assert.equal(classifyBmi(24.9), 'Healthy Weight');
  assert.equal(classifyBmi(25.0), 'Overweight');
  assert.equal(classifyBmi(30.0), 'Obese');
});

test('computeSuggestedTargets scales calories and protein appropriately across goals', () => {
  const cut = computeSuggestedTargets(80, 'fat-loss');
  const maint = computeSuggestedTargets(80, 'maintain');
  const bulk = computeSuggestedTargets(80, 'lean-bulk');

  assert.ok(cut.calories < maint.calories);
  assert.ok(maint.calories < bulk.calories);
  assert.ok(cut.protein >= maint.protein);
});

test('filterFitnessTips filters by category, search query, and bookmarks', () => {
  assert.equal(FITNESS_TIPS.length >= 12, true);

  const strengthOnly = filterFitnessTips(FITNESS_TIPS, 'Strength', '', false, []);
  assert.ok(strengthOnly.length > 0);
  assert.ok(strengthOnly.every((tip) => tip.category === 'Strength'));

  const vegMatches = filterFitnessTips(
    FITNESS_TIPS,
    'All',
    'paneer',
    false,
    [],
  );
  assert.equal(vegMatches.length, 1);
  assert.equal(vegMatches[0].id, 'tip-veg-protein-stacking');

  const savedOnly = filterFitnessTips(
    FITNESS_TIPS,
    'All',
    '',
    true,
    ['tip-double-progression', 'tip-sleep-window'],
  );
  assert.equal(savedOnly.length, 2);
});

test('pickContextualTip adapts to prep time, high protein, or high training frequency', () => {
  const fastPlan = createDefaultPlan();
  fastPlan.prepTimeLimit = '30 mins';
  assert.equal(pickContextualTip(fastPlan).id, 'tip-batch-prep-30');

  const highProtPlan = createDefaultPlan();
  highProtPlan.prepTimeLimit = '60 mins';
  highProtPlan.proteinTarget = 185;
  assert.equal(pickContextualTip(highProtPlan).id, 'tip-protein-anchor');

  const sixDayPlan = createDefaultPlan();
  sixDayPlan.prepTimeLimit = '60 mins';
  sixDayPlan.proteinTarget = 150;
  assert.equal(pickContextualTip(sixDayPlan).id, 'tip-sleep-window');
});
