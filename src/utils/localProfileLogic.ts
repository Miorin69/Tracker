import type { NutritionGoal, UnitSystem } from './fitnessToolsLogic';
import type { VisualMode } from './workoutFocusLogic';

export const DEFAULT_PROFILE_ID = 'default';
export const DEFAULT_PROFILE_NAME = 'My Profile';
export const MAX_PROFILE_NAME_LENGTH = 40;
export const MAX_PROFILES = 20;

export interface LocalProfile {
  id: string;
  name: string;
  createdAt: string;
}

export interface LocalProfilesState {
  activeProfileId: string;
  profiles: LocalProfile[];
}

export interface StoredBmiState {
  unit: UnitSystem;
  heightCm: string;
  weightKg: string;
  feet: string;
  inches: string;
  weightLbs: string;
  goal: NutritionGoal;
}

export interface SavedCustomVideo {
  url: string;
  videoId?: string;
  label: string;
}

export type SavedVideoMap = Record<string, SavedCustomVideo>;

export interface UserWorkspacePreferences {
  bookmarkedTipIds: string[];
  bmiState: StoredBmiState;
  savedVideos: SavedVideoMap;
  visualMode: VisualMode;
}

export const DEFAULT_BMI_STATE: StoredBmiState = {
  unit: 'metric',
  heightCm: '175',
  weightKg: '72',
  feet: '5',
  inches: '9',
  weightLbs: '159',
  goal: 'maintain',
};

export const DEFAULT_USER_PREFERENCES: UserWorkspacePreferences = {
  bookmarkedTipIds: [],
  bmiState: { ...DEFAULT_BMI_STATE },
  savedVideos: {},
  visualMode: 'infographic',
};

const PROFILE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function clampString(value: unknown, maxLen: number, fallback = ''): string {
  const str = typeof value === 'string' ? value : fallback;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

export function createDefaultProfilesState(
  nowIso = new Date().toISOString(),
): LocalProfilesState {
  return {
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: DEFAULT_PROFILE_NAME,
        createdAt: nowIso,
      },
    ],
  };
}

export function sanitizeProfilesState(raw: unknown): LocalProfilesState {
  if (!raw || typeof raw !== 'object') {
    return createDefaultProfilesState();
  }
  const obj = raw as Record<string, unknown>;
  const rawList = Array.isArray(obj.profiles) ? obj.profiles : [];
  const profiles: LocalProfile[] = [];
  const seenIds = new Set<string>();

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const name =
      typeof entry.name === 'string'
        ? entry.name.trim().slice(0, MAX_PROFILE_NAME_LENGTH)
        : '';
    if (!id || !PROFILE_ID_PATTERN.test(id) || !name || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    profiles.push({
      id,
      name,
      createdAt:
        typeof entry.createdAt === 'string' && entry.createdAt.trim()
          ? entry.createdAt.trim()
          : new Date().toISOString(),
    });
    if (profiles.length >= MAX_PROFILES) break;
  }

  if (profiles.length === 0) {
    return createDefaultProfilesState();
  }

  const requestedActive =
    typeof obj.activeProfileId === 'string' ? obj.activeProfileId.trim() : '';
  const activeProfileId = profiles.some((p) => p.id === requestedActive)
    ? requestedActive
    : profiles[0].id;

  return {
    activeProfileId,
    profiles,
  };
}

function slugifyProfileId(name: string, existingIds: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'person';
  let candidate = `p-${base}`;
  let suffix = 2;
  while (existingIds.has(candidate) || candidate === DEFAULT_PROFILE_ID) {
    candidate = `p-${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function addLocalProfile(
  state: LocalProfilesState,
  rawName: string,
  nowIso = new Date().toISOString(),
):
  | { ok: true; state: LocalProfilesState; profile: LocalProfile }
  | { ok: false; error: string } {
  const trimmed = rawName.trim().slice(0, MAX_PROFILE_NAME_LENGTH);
  if (!trimmed) {
    return { ok: false, error: 'Enter a name for this profile.' };
  }
  if (state.profiles.length >= MAX_PROFILES) {
    return {
      ok: false,
      error: `You can store up to ${MAX_PROFILES} local profiles.`,
    };
  }
  if (
    state.profiles.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    return { ok: false, error: `A profile named "${trimmed}" already exists.` };
  }

  const existingIds = new Set(state.profiles.map((p) => p.id));
  const profile: LocalProfile = {
    id: slugifyProfileId(trimmed, existingIds),
    name: trimmed,
    createdAt: nowIso,
  };

  return {
    ok: true,
    profile,
    state: {
      activeProfileId: profile.id,
      profiles: [...state.profiles, profile],
    },
  };
}

export function renameLocalProfile(
  state: LocalProfilesState,
  id: string,
  rawName: string,
):
  | { ok: true; state: LocalProfilesState; profile: LocalProfile }
  | { ok: false; error: string } {
  const trimmed = rawName.trim().slice(0, MAX_PROFILE_NAME_LENGTH);
  if (!trimmed) {
    return { ok: false, error: 'Profile name cannot be empty.' };
  }
  const target = state.profiles.find((p) => p.id === id);
  if (!target) {
    return { ok: false, error: 'Profile not found.' };
  }
  if (
    state.profiles.some(
      (p) => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    return { ok: false, error: `A profile named "${trimmed}" already exists.` };
  }

  const updated: LocalProfile = { ...target, name: trimmed };
  return {
    ok: true,
    profile: updated,
    state: {
      ...state,
      profiles: state.profiles.map((p) => (p.id === id ? updated : p)),
    },
  };
}

export function deleteLocalProfile(
  state: LocalProfilesState,
  id: string,
): { ok: true; state: LocalProfilesState } | { ok: false; error: string } {
  if (state.profiles.length <= 1) {
    return { ok: false, error: 'At least one profile must remain.' };
  }
  if (!state.profiles.some((p) => p.id === id)) {
    return { ok: false, error: 'Profile not found.' };
  }

  const remaining = state.profiles.filter((p) => p.id !== id);
  const nextActiveId =
    state.activeProfileId === id ? remaining[0].id : state.activeProfileId;

  return {
    ok: true,
    state: {
      activeProfileId: nextActiveId,
      profiles: remaining,
    },
  };
}

export function selectLocalProfile(
  state: LocalProfilesState,
  id: string,
): LocalProfilesState {
  if (!state.profiles.some((p) => p.id === id)) {
    return state;
  }
  return {
    ...state,
    activeProfileId: id,
  };
}

export function getProfileStorageKey(profileId: string, baseKey: string): string {
  if (!profileId || profileId === DEFAULT_PROFILE_ID) {
    return baseKey;
  }
  return `wtm_profile_${profileId}_${baseKey}`;
}

export function getProfileInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'MP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function sanitizeBmiState(
  bmi: Partial<StoredBmiState> | undefined,
): StoredBmiState {
  const src = bmi ?? DEFAULT_BMI_STATE;
  return {
    unit: src.unit === 'imperial' ? 'imperial' : 'metric',
    heightCm: clampString(src.heightCm, 12, DEFAULT_BMI_STATE.heightCm),
    weightKg: clampString(src.weightKg, 12, DEFAULT_BMI_STATE.weightKg),
    feet: clampString(src.feet, 12, DEFAULT_BMI_STATE.feet),
    inches: clampString(src.inches, 12, DEFAULT_BMI_STATE.inches),
    weightLbs: clampString(src.weightLbs, 12, DEFAULT_BMI_STATE.weightLbs),
    goal:
      src.goal === 'fat-loss' ||
      src.goal === 'lean-bulk' ||
      src.goal === 'maintain'
        ? src.goal
        : 'maintain',
  };
}

export function sanitizeBookmarkedTipIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const clean: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, 80);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    clean.push(trimmed);
    if (clean.length >= 50) break;
  }
  return clean;
}

export function sanitizeSavedVideos(videos: unknown): SavedVideoMap {
  if (!videos || typeof videos !== 'object') return {};
  const result: SavedVideoMap = {};
  const entries = Object.entries(videos as Record<string, unknown>);
  for (const [key, val] of entries) {
    if (Object.keys(result).length >= 25) break;
    if (!key || key.length > 80 || !val || typeof val !== 'object') continue;
    const obj = val as Record<string, unknown>;
    if (typeof obj.url !== 'string' || obj.url.trim().length === 0) continue;
    const entry: SavedCustomVideo = {
      url: clampString(obj.url.trim(), 400),
      label: clampString(
        typeof obj.label === 'string' && obj.label.trim().length > 0
          ? obj.label.trim()
          : 'Saved YouTube Video',
        140,
      ),
    };
    if (typeof obj.videoId === 'string' && obj.videoId.trim().length > 0) {
      entry.videoId = clampString(obj.videoId.trim(), 32);
    }
    result[key] = entry;
  }
  return result;
}
