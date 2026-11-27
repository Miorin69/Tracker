import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BMI_STATE,
  DEFAULT_PROFILE_ID,
  addLocalProfile,
  createDefaultProfilesState,
  deleteLocalProfile,
  getProfileInitials,
  getProfileStorageKey,
  renameLocalProfile,
  sanitizeBmiState,
  sanitizeBookmarkedTipIds,
  sanitizeProfilesState,
  sanitizeSavedVideos,
  selectLocalProfile,
} from './localProfileLogic';

test('default profile uses legacy unscoped localStorage keys while new profiles are isolated', () => {
  assert.equal(
    getProfileStorageKey(DEFAULT_PROFILE_ID, 'wtm_active_plan_v1'),
    'wtm_active_plan_v1',
  );
  assert.equal(
    getProfileStorageKey('p-aakrisht', 'wtm_active_plan_v1'),
    'wtm_profile_p-aakrisht_wtm_active_plan_v1',
  );
});

test('addLocalProfile creates unique isolated profile and activates it', () => {
  const initial = createDefaultProfilesState('2026-01-01T00:00:00.000Z');
  const added = addLocalProfile(initial, 'Aakrisht Thapa', '2026-01-02T00:00:00.000Z');
  assert.equal(added.ok, true);
  if (!added.ok) return;

  assert.equal(added.profile.name, 'Aakrisht Thapa');
  assert.equal(added.profile.id, 'p-aakrisht-thapa');
  assert.equal(added.state.activeProfileId, added.profile.id);
  assert.equal(added.state.profiles.length, 2);

  // Duplicate name rejected (case-insensitive)
  const dup = addLocalProfile(added.state, 'aakrisht thapa');
  assert.equal(dup.ok, false);

  // Blank name rejected
  const blank = addLocalProfile(added.state, '   ');
  assert.equal(blank.ok, false);
});

test('renameLocalProfile and deleteLocalProfile enforce invariants', () => {
  const base = createDefaultProfilesState('2026-01-01T00:00:00.000Z');
  const cannotDeleteOnly = deleteLocalProfile(base, DEFAULT_PROFILE_ID);
  assert.equal(cannotDeleteOnly.ok, false);

  const added = addLocalProfile(base, 'Alex');
  assert.equal(added.ok, true);
  if (!added.ok) return;

  const renamed = renameLocalProfile(added.state, added.profile.id, 'Alex K');
  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  assert.equal(renamed.profile.name, 'Alex K');

  const deleted = deleteLocalProfile(renamed.state, added.profile.id);
  assert.equal(deleted.ok, true);
  if (!deleted.ok) return;
  assert.equal(deleted.state.profiles.length, 1);
  assert.equal(deleted.state.activeProfileId, DEFAULT_PROFILE_ID);
});

test('sanitizeProfilesState recovers gracefully from malformed localStorage payloads', () => {
  const fallback = sanitizeProfilesState(null);
  assert.equal(fallback.activeProfileId, DEFAULT_PROFILE_ID);
  assert.equal(fallback.profiles.length, 1);

  const repaired = sanitizeProfilesState({
    activeProfileId: 'missing-id',
    profiles: [
      { id: 'bad id!', name: 'Ignored' },
      { id: 'p-sam', name: 'Sam', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
  });
  assert.equal(repaired.activeProfileId, 'p-sam');
  assert.equal(repaired.profiles.length, 1);
});

test('selectLocalProfile switches only to valid profile IDs', () => {
  const base = createDefaultProfilesState();
  const added = addLocalProfile(base, 'Sam');
  assert.equal(added.ok, true);
  if (!added.ok) return;

  const switchedBack = selectLocalProfile(added.state, DEFAULT_PROFILE_ID);
  assert.equal(switchedBack.activeProfileId, DEFAULT_PROFILE_ID);

  const invalid = selectLocalProfile(switchedBack, 'nonexistent');
  assert.equal(invalid.activeProfileId, DEFAULT_PROFILE_ID);
});

test('getProfileInitials extracts crisp 2-letter avatars', () => {
  assert.equal(getProfileInitials('Aakrisht Thapa'), 'AT');
  assert.equal(getProfileInitials('Hishay'), 'HI');
  assert.equal(getProfileInitials('   '), 'MP');
});

test('preference sanitizers clamp invalid inputs cleanly', () => {
  const bmi = sanitizeBmiState({ unit: 'imperial', goal: 'lean-bulk' });
  assert.equal(bmi.unit, 'imperial');
  assert.equal(bmi.goal, 'lean-bulk');
  assert.equal(bmi.heightCm, DEFAULT_BMI_STATE.heightCm);

  assert.deepEqual(sanitizeBookmarkedTipIds(['a', 'a', '', 123, 'b']), ['a', 'b']);

  const videos = sanitizeSavedVideos({
    k1: { url: 'https://youtu.be/abc', videoId: 'abc', label: 'Push Day' },
    k2: { url: '', label: 'Invalid' },
  });
  assert.equal(Object.keys(videos).length, 1);
  assert.equal(videos.k1.videoId, 'abc');
});
