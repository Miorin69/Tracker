import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BLUEPRINT_LIMITS,
  DEFAULT_BMI_STATE,
  buildWorkspaceFingerprint,
  hydrateHolidayPlanFromFirestore,
  hydrateSavedPresetFromFirestore,
  hydrateWeeklyPlanFromFirestore,
  sanitizeBmiState,
  sanitizeBookmarkedTipIds,
  sanitizeFirestoreId,
  sanitizeHolidayPlanForFirestore,
  sanitizeSavedPresetForFirestore,
  sanitizeSavedVideos,
  sanitizeUserProfileForFirestore,
  sanitizeWeeklyPlanForFirestore,
} from './cloudSyncLogic.ts';
import { createDefaultPlan } from './planLogic.ts';
import type { CustomHolidayPlan, SavedPreset } from '../types/plan.ts';

describe('cloudSyncLogic — Blueprint-Synchronized Sanitization & Hydration', () => {
  it('strips undefined optional fields and preserves dailyProgress keys as 0..6 strings', () => {
    const plan = createDefaultPlan();
    plan.holidayNotes = undefined;
    plan.activeHolidayPlanId = undefined;
    plan.dailyProgress = {
      0: {
        completedMeals: ['breakfast', 'lunch'],
        extraCalories: 250,
        extraProtein: 25,
        workoutCompleted: true,
      },
    };

    const sanitized = sanitizeWeeklyPlanForFirestore(plan);
    assert.equal('holidayNotes' in sanitized, false);
    assert.equal('activeHolidayPlanId' in sanitized, false);
    assert.deepEqual(Object.keys(sanitized.dailyProgress as object), ['0']);

    const hydrated = hydrateWeeklyPlanFromFirestore(sanitized);
    assert.ok(hydrated);
    assert.deepEqual(hydrated.dailyProgress?.[0]?.completedMeals, [
      'breakfast',
      'lunch',
    ]);
    assert.equal(hydrated.dailyProgress?.[0]?.extraCalories, 250);
    assert.equal(hydrated.dailyProgress?.[0]?.workoutCompleted, true);
  });

  it('truncates oversized strings and bounds macros to match firestore.rules', () => {
    const plan = createDefaultPlan();
    plan.holidayTag = 'X'.repeat(500);
    plan.holidayNotes = 'N'.repeat(900);
    plan.caloriesTarget = 999999;
    plan.proteinTarget = 5;
    plan.stapleMeals.breakfast = 'B'.repeat(500);

    const sanitized = sanitizeWeeklyPlanForFirestore(plan);
    assert.equal(
      (sanitized.holidayTag as string).length,
      BLUEPRINT_LIMITS.PLAN_NAME_MAX,
    );
    assert.equal(
      (sanitized.holidayNotes as string).length,
      BLUEPRINT_LIMITS.HOLIDAY_NOTES_MAX,
    );
    assert.equal(sanitized.caloriesTarget, BLUEPRINT_LIMITS.CALORIES_MAX);
    assert.equal(sanitized.proteinTarget, BLUEPRINT_LIMITS.PROTEIN_MIN);
    assert.equal(
      (sanitized.stapleMeals as { breakfast: string }).breakfast.length,
      BLUEPRINT_LIMITS.MEAL_TEXT_MAX,
    );
  });

  it('sanitizes document IDs to match ^[a-zA-Z0-9_-]+$', () => {
    assert.equal(sanitizeFirestoreId('holiday-123_abc'), 'holiday-123_abc');
    const cleaned = sanitizeFirestoreId('../../evil$id with spaces');
    assert.match(cleaned, BLUEPRINT_LIMITS.ID_PATTERN);
    assert.ok(cleaned.length <= BLUEPRINT_LIMITS.ID_MAX);
  });

  it('caps bookmarkedTipIds at 50 unique strings and savedVideos at 25 entries', () => {
    const manyTips = Array.from({ length: 70 }, (_, i) => `tip-${i}`);
    const boundedTips = sanitizeBookmarkedTipIds([...manyTips, 'tip-0']);
    assert.equal(boundedTips.length, BLUEPRINT_LIMITS.BOOKMARKED_TIPS_MAX);

    const manyVideos: Record<string, { url: string; label: string }> = {};
    for (let i = 0; i < 40; i += 1) {
      manyVideos[`focus-${i}`] = {
        url: `https://youtube.com/watch?v=vid${i}`,
        label: `Video ${i}`,
      };
    }
    const boundedVideos = sanitizeSavedVideos(manyVideos);
    assert.equal(
      Object.keys(boundedVideos).length,
      BLUEPRINT_LIMITS.SAVED_VIDEOS_MAX,
    );
  });

  it('round-trips holiday plans and saved presets cleanly', () => {
    const basePlan = createDefaultPlan();
    const holidayPlan: CustomHolidayPlan = {
      id: 'holiday-beach-2026',
      name: 'Beach Trip',
      notes: 'Hotel dumbbells only',
      caloriesTarget: 2200,
      proteinTarget: 165,
      prepTimeLimit: '30 mins',
      splitPreset: 'holiday-maintenance',
      stapleMeals: basePlan.stapleMeals,
      days: basePlan.days,
      checklist: basePlan.checklist,
      updatedAt: '2026-06-01T12:00:00.000Z',
    };

    const sanitizedHoliday = sanitizeHolidayPlanForFirestore(
      'user-abc-123',
      holidayPlan,
    );
    assert.equal(sanitizedHoliday.ownerId, 'user-abc-123');
    const hydratedHoliday = hydrateHolidayPlanFromFirestore(sanitizedHoliday);
    assert.ok(hydratedHoliday);
    assert.equal(hydratedHoliday.id, 'holiday-beach-2026');
    assert.equal(hydratedHoliday.name, 'Beach Trip');

    const preset: SavedPreset = {
      id: 'preset-cut-1',
      name: 'Summer Cut',
      savedAt: '2026-06-01T12:00:00.000Z',
      plan: basePlan,
    };
    const sanitizedPreset = sanitizeSavedPresetForFirestore(
      'user-abc-123',
      preset,
    );
    const hydratedPreset = hydrateSavedPresetFromFirestore(sanitizedPreset);
    assert.ok(hydratedPreset);
    assert.equal(hydratedPreset.id, 'preset-cut-1');
    assert.equal(hydratedPreset.plan.days.length, 7);
  });

  it('sanitizes user profile without undefined photoURL', () => {
    const profile = sanitizeUserProfileForFirestore(
      'uid-123',
      'Aakrisht Thapa',
      'aakrisht@example.com',
      null,
    );
    assert.equal(profile.ownerId, 'uid-123');
    assert.equal('photoURL' in profile, false);
  });

  it('produces stable workspace fingerprints for echo prevention', () => {
    const plan = createDefaultPlan();
    const prefs = {
      bookmarkedTipIds: ['tip-1'],
      bmiState: sanitizeBmiState(DEFAULT_BMI_STATE),
      savedVideos: {},
      visualMode: 'infographic' as const,
    };
    const fp1 = buildWorkspaceFingerprint(plan, null, prefs);
    const fp2 = buildWorkspaceFingerprint(plan, null, prefs);
    assert.equal(fp1, fp2);
  });
});
