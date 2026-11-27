import type {
  CustomHolidayPlan,
  SavedPreset,
  WeeklyPlan,
} from '../types/plan';
import { parseStoredHolidayPlans } from './holidayPlanLogic';
import { createDefaultPlan, parseImportedPlan } from './planLogic';

const ACTIVE_PLAN_KEY = 'wtm_active_plan_v1';
const SAVED_PRESETS_KEY = 'wtm_saved_presets_v1';
const HOLIDAY_PLANS_KEY = 'wtm_holiday_plans_v1';
const NORMAL_WEEK_BACKUP_KEY = 'wtm_normal_week_backup_v1';

export function loadActivePlan(): WeeklyPlan {
  try {
    const raw = window.localStorage.getItem(ACTIVE_PLAN_KEY);
    if (!raw) return createDefaultPlan();
    const parsed = parseImportedPlan(raw);
    return parsed.ok ? parsed.plan : createDefaultPlan();
  } catch {
    return createDefaultPlan();
  }
}

export function saveActivePlan(plan: WeeklyPlan): void {
  try {
    window.localStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(plan));
  } catch {
    // Ignore storage quota or private browsing errors gracefully
  }
}

export function clearActivePlan(): void {
  try {
    window.localStorage.removeItem(ACTIVE_PLAN_KEY);
    window.localStorage.removeItem(NORMAL_WEEK_BACKUP_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function loadNormalWeekBackup(): WeeklyPlan | null {
  try {
    const raw = window.localStorage.getItem(NORMAL_WEEK_BACKUP_KEY);
    if (!raw) return null;
    const parsed = parseImportedPlan(raw);
    return parsed.ok ? parsed.plan : null;
  } catch {
    return null;
  }
}

export function saveNormalWeekBackup(plan: WeeklyPlan): void {
  try {
    window.localStorage.setItem(NORMAL_WEEK_BACKUP_KEY, JSON.stringify(plan));
  } catch {
    // Ignore storage errors
  }
}

export function loadHolidayPlans(): CustomHolidayPlan[] {
  try {
    const raw = window.localStorage.getItem(HOLIDAY_PLANS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return parseStoredHolidayPlans(parsed);
  } catch {
    return [];
  }
}

export function saveHolidayPlans(plans: CustomHolidayPlan[]): void {
  try {
    window.localStorage.setItem(HOLIDAY_PLANS_KEY, JSON.stringify(plans));
  } catch {
    // Ignore storage errors
  }
}

export function loadSavedPresets(): SavedPreset[] {
  try {
    const raw = window.localStorage.getItem(SAVED_PRESETS_KEY);
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

export function savePresetsList(presets: SavedPreset[]): void {
  try {
    window.localStorage.setItem(SAVED_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage errors
  }
}
