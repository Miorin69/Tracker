import {
  DEFAULT_BMI_STATE,
  sanitizeBmiState,
  sanitizeBookmarkedTipIds,
  sanitizeSavedVideos,
  type SavedVideoMap,
  type StoredBmiState,
  type UserWorkspacePreferences,
} from './cloudSyncLogic';
import type { VisualMode } from './workoutFocusLogic';

const BOOKMARK_STORAGE_KEY = 'wtm_saved_fitness_tips_v1';
const BMI_STORAGE_KEY = 'wtm_bmi_inputs_v1';
const CUSTOM_YT_STORAGE_KEY = 'wtm_custom_youtube_urls_v1';
const VISUAL_MODE_STORAGE_KEY = 'wtm_workout_visual_mode_v1';

export function loadGuestBookmarkedTipIds(): string[] {
  try {
    const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeBookmarkedTipIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveGuestBookmarkedTipIds(ids: string[]): void {
  try {
    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

export function loadGuestBmiState(): StoredBmiState {
  try {
    const raw = window.localStorage.getItem(BMI_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BMI_STATE };
    return sanitizeBmiState(JSON.parse(raw) as Partial<StoredBmiState>);
  } catch {
    return { ...DEFAULT_BMI_STATE };
  }
}

export function saveGuestBmiState(bmiState: StoredBmiState): void {
  try {
    window.localStorage.setItem(BMI_STORAGE_KEY, JSON.stringify(bmiState));
  } catch {
    // Ignore storage errors
  }
}

export function loadGuestSavedVideos(): SavedVideoMap {
  try {
    const raw = window.localStorage.getItem(CUSTOM_YT_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeSavedVideos(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveGuestSavedVideos(videos: SavedVideoMap): void {
  try {
    window.localStorage.setItem(CUSTOM_YT_STORAGE_KEY, JSON.stringify(videos));
  } catch {
    // Ignore storage errors
  }
}

export function loadGuestVisualMode(): VisualMode {
  try {
    const raw = window.localStorage.getItem(VISUAL_MODE_STORAGE_KEY);
    return raw === 'illustration' ? 'illustration' : 'infographic';
  } catch {
    return 'infographic';
  }
}

export function saveGuestVisualMode(mode: VisualMode): void {
  try {
    window.localStorage.setItem(VISUAL_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function loadGuestPreferences(): UserWorkspacePreferences {
  return {
    bookmarkedTipIds: loadGuestBookmarkedTipIds(),
    bmiState: loadGuestBmiState(),
    savedVideos: loadGuestSavedVideos(),
    visualMode: loadGuestVisualMode(),
  };
}
