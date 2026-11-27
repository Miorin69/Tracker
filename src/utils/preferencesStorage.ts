import {
  DEFAULT_BMI_STATE,
  DEFAULT_PROFILE_ID,
  getProfileStorageKey,
  sanitizeBmiState,
  sanitizeBookmarkedTipIds,
  sanitizeSavedVideos,
  type SavedVideoMap,
  type StoredBmiState,
  type UserWorkspacePreferences,
} from './localProfileLogic';
import type { VisualMode } from './workoutFocusLogic';

const BOOKMARK_STORAGE_KEY = 'wtm_saved_fitness_tips_v1';
const BMI_STORAGE_KEY = 'wtm_bmi_inputs_v1';
const CUSTOM_YT_STORAGE_KEY = 'wtm_custom_youtube_urls_v1';
const VISUAL_MODE_STORAGE_KEY = 'wtm_workout_visual_mode_v1';

export function loadProfileBookmarkedTipIds(
  profileId = DEFAULT_PROFILE_ID,
): string[] {
  try {
    const raw = window.localStorage.getItem(
      getProfileStorageKey(profileId, BOOKMARK_STORAGE_KEY),
    );
    if (!raw) return [];
    return sanitizeBookmarkedTipIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveProfileBookmarkedTipIds(
  ids: string[],
  profileId = DEFAULT_PROFILE_ID,
): void {
  try {
    window.localStorage.setItem(
      getProfileStorageKey(profileId, BOOKMARK_STORAGE_KEY),
      JSON.stringify(ids),
    );
  } catch {
    // Ignore storage errors
  }
}

export function loadProfileBmiState(
  profileId = DEFAULT_PROFILE_ID,
): StoredBmiState {
  try {
    const raw = window.localStorage.getItem(
      getProfileStorageKey(profileId, BMI_STORAGE_KEY),
    );
    if (!raw) return { ...DEFAULT_BMI_STATE };
    return sanitizeBmiState(JSON.parse(raw) as Partial<StoredBmiState>);
  } catch {
    return { ...DEFAULT_BMI_STATE };
  }
}

export function saveProfileBmiState(
  bmiState: StoredBmiState,
  profileId = DEFAULT_PROFILE_ID,
): void {
  try {
    window.localStorage.setItem(
      getProfileStorageKey(profileId, BMI_STORAGE_KEY),
      JSON.stringify(bmiState),
    );
  } catch {
    // Ignore storage errors
  }
}

export function loadProfileSavedVideos(
  profileId = DEFAULT_PROFILE_ID,
): SavedVideoMap {
  try {
    const raw = window.localStorage.getItem(
      getProfileStorageKey(profileId, CUSTOM_YT_STORAGE_KEY),
    );
    if (!raw) return {};
    return sanitizeSavedVideos(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveProfileSavedVideos(
  videos: SavedVideoMap,
  profileId = DEFAULT_PROFILE_ID,
): void {
  try {
    window.localStorage.setItem(
      getProfileStorageKey(profileId, CUSTOM_YT_STORAGE_KEY),
      JSON.stringify(videos),
    );
  } catch {
    // Ignore storage errors
  }
}

export function loadProfileVisualMode(
  profileId = DEFAULT_PROFILE_ID,
): VisualMode {
  try {
    const raw = window.localStorage.getItem(
      getProfileStorageKey(profileId, VISUAL_MODE_STORAGE_KEY),
    );
    return raw === 'illustration' ? 'illustration' : 'infographic';
  } catch {
    return 'infographic';
  }
}

export function saveProfileVisualMode(
  mode: VisualMode,
  profileId = DEFAULT_PROFILE_ID,
): void {
  try {
    window.localStorage.setItem(
      getProfileStorageKey(profileId, VISUAL_MODE_STORAGE_KEY),
      mode,
    );
  } catch {
    // Ignore storage errors
  }
}

export function loadProfilePreferences(
  profileId = DEFAULT_PROFILE_ID,
): UserWorkspacePreferences {
  return {
    bookmarkedTipIds: loadProfileBookmarkedTipIds(profileId),
    bmiState: loadProfileBmiState(profileId),
    savedVideos: loadProfileSavedVideos(profileId),
    visualMode: loadProfileVisualMode(profileId),
  };
}
