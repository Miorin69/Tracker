import type {
  CustomHolidayPlan,
  SavedPreset,
  WeeklyPlan,
} from '../types/plan';
import { parseStoredHolidayPlans } from './holidayPlanLogic';
import {
  DEFAULT_PROFILE_ID,
  createDefaultProfilesState,
  getProfileStorageKey,
  sanitizeProfilesState,
  type LocalProfilesState,
} from './localProfileLogic';
import { createDefaultPlan, parseImportedPlan } from './planLogic';

const PROFILES_INDEX_KEY = 'wtm_profiles_index_v1';
const ACTIVE_PLAN_KEY = 'wtm_active_plan_v1';
const SAVED_PRESETS_KEY = 'wtm_saved_presets_v1';
const HOLIDAY_PLANS_KEY = 'wtm_holiday_plans_v1';
const NORMAL_WEEK_BACKUP_KEY = 'wtm_normal_week_backup_v1';

export function loadProfilesState(): LocalProfilesState {
  try {
    const raw = window.localStorage.getItem(PROFILES_INDEX_KEY);
    if (!raw) return createDefaultProfilesState();
    return sanitizeProfilesState(JSON.parse(raw));
  } catch {
    return createDefaultProfilesState();
  }
}

export function saveProfilesState(state: LocalProfilesState): void {
  try {
    window.localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private browsing errors gracefully
  }
}

export function loadActivePlan(profileId = DEFAULT_PROFILE_ID): WeeklyPlan {
  try {
    const raw = window.localStorage.getItem(
      getProfileStorageKey(profileId, ACTIVE_PLAN_KEY),
    );
    if (!raw) return createDefaultPlan();
    const parsed = parseImportedPlan(raw);
    return parsed.ok ? parsed.plan : createDefaultPlan();
  } catch {
    return createDefaultPlan();
  }
}

export function saveActivePlan(
  plan: WeeklyPlan,
  profileId = DEFAULT_PROFILE_ID,
): void {
  try {
    window.localStorage.setItem(
      getProfileStorageKey(profileId, ACTIVE_PLAN_KEY),
      JSON.stringify(plan),
    );
  } catch {
    // Ignore storage quota or private browsing errors gracefully
  }
}

export function clearActivePlan(profileId = DEFAULT_PROFILE_ID): void {
  try {
    window.localStorage.removeItem(
      getProfileStorageKey(profileId, ACTIVE_PLAN_KEY),
    );
    window.localStorage.removeItem(
      getProfileStorageKey(profileId, NORMAL_WEEK_BACKUP_KEY),
    );
  } catch {
    // Ignore storage errors
  }
}

export function loadNormalWeekBackup(
  profileId = DEFAULT_PROFILE_ID,
): WeeklyPlan | null {
  try {
    const raw = window.localStorage.getItem(
      getProfileStorageKey(profileId, NORMAL_WEEK_BACKUP_KEY),
    );
    if (!raw) return null;
    const parsed = parseImportedPlan(raw);
    return parsed.ok ? parsed.plan : null;
  } catch {
    return null;
  }
}

export function saveNormalWeekBackup(
  plan: WeeklyPlan | null,
  profileId = DEFAULT_PROFILE_ID,
): void {
  try {
    const key = getProfileStorageKey(profileId, NORMAL_WEEK_BACKUP_KEY);
    if (!plan) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(plan));
  } catch {
    // Ignore storage errors
  }
}

export function loadHolidayPlans(
  profileId = DEFAULT_PROFILE_ID,
): CustomHolidayPlan[] {
  try {
    const raw = window.localStorage.getItem(
      getProfileStorageKey(profileId, HOLIDAY_PLANS_KEY),
    );
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return parseStoredHolidayPlans(parsed);
  } catch {
    return [];
  }
}

export function saveHolidayPlans(
  plans: CustomHolidayPlan[],
  profileId = DEFAULT_PROFILE_ID,
): void {
  try {
    window.localStorage.setItem(
      getProfileStorageKey(profileId, HOLIDAY_PLANS_KEY),
      JSON.stringify(plans),
    );
  } catch {
    // Ignore storage errors
  }
}

export function loadSavedPresets(
  profileId = DEFAULT_PROFILE_ID,
): SavedPreset[] {
  try {
    const raw = window.localStorage.getItem(
      getProfileStorageKey(profileId, SAVED_PRESETS_KEY),
    );
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: SavedPreset[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      if (
        typeof obj.id !== 'string' ||
        typeof obj.name !== 'string' ||
        typeof obj.savedAt !== 'string' ||
        !obj.plan
      ) {
        continue;
      }
      const planResult = parseImportedPlan(JSON.stringify(obj.plan));
      if (planResult.ok) {
        valid.push({
          id: obj.id,
          name: obj.name,
          savedAt: obj.savedAt,
          plan: planResult.plan,
        });
      }
    }
    return valid;
  } catch {
    return [];
  }
}

export function savePresetsList(
  presets: SavedPreset[],
  profileId = DEFAULT_PROFILE_ID,
): void {
  try {
    window.localStorage.setItem(
      getProfileStorageKey(profileId, SAVED_PRESETS_KEY),
      JSON.stringify(presets),
    );
  } catch {
    // Ignore storage errors
  }
}

export function clearProfileStorage(profileId: string): void {
  try {
    for (const key of [
      ACTIVE_PLAN_KEY,
      SAVED_PRESETS_KEY,
      HOLIDAY_PLANS_KEY,
      NORMAL_WEEK_BACKUP_KEY,
      'wtm_saved_fitness_tips_v1',
      'wtm_bmi_inputs_v1',
      'wtm_custom_youtube_urls_v1',
      'wtm_workout_visual_mode_v1',
    ]) {
      window.localStorage.removeItem(getProfileStorageKey(profileId, key));
    }
  } catch {
    // Ignore storage errors
  }
}
