import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultPlan } from './planLogic';
import {
  applyHolidayPlanToWeek,
  createCustomHolidayPlan,
  hasUnsavedHolidayEdits,
  parseStoredHolidayPlans,
  syncWeekIntoHolidayPlan,
  updateHolidayPlanDetails,
} from './holidayPlanLogic';

test('createCustomHolidayPlan creates editable holiday plans from quick-maintenance or current week', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));

  const quickHoliday = createCustomHolidayPlan(base, {
    name: 'Summer Beach Trip',
    notes: '25-min morning lifts, protein-first dinners',
    caloriesTarget: 2000,
    proteinTarget: 155,
    prepTimeLimit: '30 mins',
    starterMode: 'quick-maintenance',
  });

  assert.equal(quickHoliday.name, 'Summer Beach Trip');
  assert.equal(quickHoliday.notes, '25-min morning lifts, protein-first dinners');
  assert.equal(quickHoliday.caloriesTarget, 2000);
  assert.equal(quickHoliday.proteinTarget, 155);
  assert.equal(quickHoliday.splitPreset, 'holiday-maintenance');
  assert.equal(quickHoliday.days.length, 7);
  assert.equal(quickHoliday.days[0].durationMinutes, 25);

  const copiedHoliday = createCustomHolidayPlan(base, {
    name: 'Home Deload Week',
    starterMode: 'current',
  });

  assert.equal(copiedHoliday.splitPreset, base.splitPreset);
  assert.equal(copiedHoliday.days[0].workoutTitle, base.days[0].workoutTitle);
});

test('applyHolidayPlanToWeek, edit detection, and syncWeekIntoHolidayPlan round-trip cleanly', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  const holiday = createCustomHolidayPlan(base, {
    name: 'Family Reunion Week',
    notes: 'Keep walks high and hit 150g protein',
    caloriesTarget: 2300,
    proteinTarget: 150,
    starterMode: 'quick-maintenance',
  });

  const activeWeek = applyHolidayPlanToWeek(base, holiday);
  assert.equal(activeWeek.weekStartDate, base.weekStartDate);
  assert.equal(activeWeek.holidayTag, 'Family Reunion Week');
  assert.equal(activeWeek.holidayNotes, 'Keep walks high and hit 150g protein');
  assert.equal(activeWeek.activeHolidayPlanId, holiday.id);
  assert.equal(hasUnsavedHolidayEdits(holiday, activeWeek), false);

  // Edit Monday's workout on the active sheet
  const editedWeek = structuredClone(activeWeek);
  editedWeek.days[0].workoutTitle = 'Hotel Dumbbell Circuit';
  editedWeek.days[0].exercises = 'DB Goblet Squat 3×12, Push-Ups 3×15, DB Row 3×12';
  assert.equal(hasUnsavedHolidayEdits(holiday, editedWeek), true);

  // Sync changes back into the saved custom holiday plan
  const syncedHoliday = syncWeekIntoHolidayPlan(holiday, editedWeek);
  assert.equal(syncedHoliday.days[0].workoutTitle, 'Hotel Dumbbell Circuit');
  assert.equal(hasUnsavedHolidayEdits(syncedHoliday, editedWeek), false);
});

test('updateHolidayPlanDetails updates name, notes, targets, and prep window safely', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  const holiday = createCustomHolidayPlan(base, {
    name: 'Trip V1',
    notes: 'Original notes',
    caloriesTarget: 2100,
    proteinTarget: 150,
    starterMode: 'quick-maintenance',
  });

  const updated = updateHolidayPlanDetails(holiday, {
    name: 'Mountain Cabin Week',
    notes: 'Hikes + bodyweight circuits',
    caloriesTarget: 2500,
    proteinTarget: 165,
    prepTimeLimit: '60 mins',
  });

  assert.equal(updated.name, 'Mountain Cabin Week');
  assert.equal(updated.notes, 'Hikes + bodyweight circuits');
  assert.equal(updated.caloriesTarget, 2500);
  assert.equal(updated.proteinTarget, 165);
  assert.equal(updated.prepTimeLimit, '60 mins');
});

test('parseStoredHolidayPlans validates good records and skips malformed entries', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  const valid = createCustomHolidayPlan(base, {
    name: 'Ski Week',
    notes: 'High carbs for slopes',
    starterMode: 'quick-maintenance',
  });

  const parsed = parseStoredHolidayPlans([
    valid,
    null,
    { id: 'bad', name: '' },
    'invalid',
  ]);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'Ski Week');
  assert.equal(parsed[0].notes, 'High carbs for slopes');
  assert.equal(parsed[0].days.length, 7);
});
