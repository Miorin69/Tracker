import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { CustomHolidayPlan, SavedPreset, WeeklyPlan } from '../types/plan';
import {
  DEFAULT_USER_PREFERENCES,
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
  type UserWorkspacePreferences,
} from './cloudSyncLogic';

export interface HydratedCloudWorkspace {
  activePlan: WeeklyPlan;
  normalWeekBackup: WeeklyPlan | null;
  preferences: UserWorkspacePreferences;
}

export async function ensureUserProfileDoc(user: User): Promise<void> {
  const uid = sanitizeFirestoreId(user.uid, 'user');
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const profileData = sanitizeUserProfileForFirestore(
    uid,
    user.displayName,
    user.email,
    user.photoURL,
  );

  if (!exists) {
    try {
      await setDoc(ref, {
        ...profileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return;
  }

  try {
    const updatePayload: Record<string, unknown> = {
      displayName: profileData.displayName,
      email: profileData.email,
      updatedAt: serverTimestamp(),
    };
    if ('photoURL' in profileData) {
      updatePayload.photoURL = profileData.photoURL;
    }
    await updateDoc(ref, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function hydrateWorkspaceDocData(
  data: Record<string, unknown>,
): HydratedCloudWorkspace | null {
  const activePlan = hydrateWeeklyPlanFromFirestore(data.activePlan);
  if (!activePlan) return null;

  const normalWeekBackup = data.normalWeekBackup
    ? hydrateWeeklyPlanFromFirestore(data.normalWeekBackup)
    : null;

  const preferences: UserWorkspacePreferences = {
    bookmarkedTipIds: sanitizeBookmarkedTipIds(data.bookmarkedTipIds),
    bmiState: sanitizeBmiState(
      data.bmiState as UserWorkspacePreferences['bmiState'] | undefined,
    ),
    savedVideos: sanitizeSavedVideos(data.savedVideos),
    visualMode:
      data.visualMode === 'illustration' ? 'illustration' : 'infographic',
  };

  return {
    activePlan,
    normalWeekBackup,
    preferences,
  };
}

export async function fetchUserWorkspace(
  uid: string,
): Promise<HydratedCloudWorkspace | null> {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const path = `users/${safeUid}/workspaces/primary`;
  const ref = doc(db, 'users', safeUid, 'workspaces', 'primary');

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return hydrateWorkspaceDocData(snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserWorkspace(
  uid: string,
  payload: {
    activePlan: WeeklyPlan;
    normalWeekBackup: WeeklyPlan | null;
    preferences: UserWorkspacePreferences;
  },
  docAlreadyExists: boolean,
): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const path = `users/${safeUid}/workspaces/primary`;
  const ref = doc(db, 'users', safeUid, 'workspaces', 'primary');

  const body: Record<string, unknown> = {
    activePlan: sanitizeWeeklyPlanForFirestore(payload.activePlan),
    normalWeekBackup: payload.normalWeekBackup
      ? sanitizeWeeklyPlanForFirestore(payload.normalWeekBackup)
      : null,
    bookmarkedTipIds: sanitizeBookmarkedTipIds(
      payload.preferences.bookmarkedTipIds,
    ),
    bmiState: sanitizeBmiState(payload.preferences.bmiState),
    savedVideos: sanitizeSavedVideos(payload.preferences.savedVideos),
    visualMode:
      payload.preferences.visualMode === 'illustration'
        ? 'illustration'
        : 'infographic',
    updatedAt: serverTimestamp(),
  };

  if (!docAlreadyExists) {
    try {
      await setDoc(ref, {
        ownerId: safeUid,
        ...body,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return;
  }

  try {
    await updateDoc(ref, body);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserWorkspace(
  uid: string,
  onData: (workspace: HydratedCloudWorkspace | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const path = `users/${safeUid}/workspaces/primary`;
  const ref = doc(db, 'users', safeUid, 'workspaces', 'primary');

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(hydrateWorkspaceDocData(snap.data() as Record<string, unknown>));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function fetchUserHolidayPlans(
  uid: string,
): Promise<CustomHolidayPlan[]> {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const path = `users/${safeUid}/holidayPlans`;
  const q = query(
    collection(db, 'users', safeUid, 'holidayPlans'),
    where('ownerId', '==', safeUid),
  );

  try {
    const snap = await getDocs(q);
    const items: CustomHolidayPlan[] = [];
    snap.forEach((docSnap) => {
      const hydrated = hydrateHolidayPlanFromFirestore(docSnap.data());
      if (hydrated) items.push(hydrated);
    });
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeUserHolidayPlans(
  uid: string,
  onData: (plans: CustomHolidayPlan[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const path = `users/${safeUid}/holidayPlans`;
  const q = query(
    collection(db, 'users', safeUid, 'holidayPlans'),
    where('ownerId', '==', safeUid),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: CustomHolidayPlan[] = [];
      snap.forEach((docSnap) => {
        const hydrated = hydrateHolidayPlanFromFirestore(docSnap.data());
        if (hydrated) items.push(hydrated);
      });
      items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function upsertUserHolidayPlan(
  uid: string,
  holidayPlan: CustomHolidayPlan,
  isExistingDoc: boolean,
): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const safeId = sanitizeFirestoreId(holidayPlan.id, 'holiday');
  const path = `users/${safeUid}/holidayPlans/${safeId}`;
  const ref = doc(db, 'users', safeUid, 'holidayPlans', safeId);
  const sanitized = sanitizeHolidayPlanForFirestore(safeUid, {
    ...holidayPlan,
    id: safeId,
  });

  if (!isExistingDoc) {
    try {
      await setDoc(ref, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return;
  }

  const updateBody: Record<string, unknown> = {
    name: sanitized.name,
    notes: sanitized.notes,
    caloriesTarget: sanitized.caloriesTarget,
    proteinTarget: sanitized.proteinTarget,
    prepTimeLimit: sanitized.prepTimeLimit,
    splitPreset: sanitized.splitPreset,
    stapleMeals: sanitized.stapleMeals,
    days: sanitized.days,
    checklist: sanitized.checklist,
    updatedAtIso: sanitized.updatedAtIso,
    updatedAt: serverTimestamp(),
  };
  if ('customSplitLabel' in sanitized) {
    updateBody.customSplitLabel = sanitized.customSplitLabel;
  }

  try {
    await updateDoc(ref, updateBody);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserHolidayPlan(
  uid: string,
  holidayPlanId: string,
): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const safeId = sanitizeFirestoreId(holidayPlanId, 'holiday');
  const path = `users/${safeUid}/holidayPlans/${safeId}`;
  const ref = doc(db, 'users', safeUid, 'holidayPlans', safeId);

  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchUserSavedPresets(
  uid: string,
): Promise<SavedPreset[]> {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const path = `users/${safeUid}/savedPresets`;
  const q = query(
    collection(db, 'users', safeUid, 'savedPresets'),
    where('ownerId', '==', safeUid),
  );

  try {
    const snap = await getDocs(q);
    const items: SavedPreset[] = [];
    snap.forEach((docSnap) => {
      const hydrated = hydrateSavedPresetFromFirestore(docSnap.data());
      if (hydrated) items.push(hydrated);
    });
    return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeUserSavedPresets(
  uid: string,
  onData: (presets: SavedPreset[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const path = `users/${safeUid}/savedPresets`;
  const q = query(
    collection(db, 'users', safeUid, 'savedPresets'),
    where('ownerId', '==', safeUid),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: SavedPreset[] = [];
      snap.forEach((docSnap) => {
        const hydrated = hydrateSavedPresetFromFirestore(docSnap.data());
        if (hydrated) items.push(hydrated);
      });
      items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function createUserSavedPreset(
  uid: string,
  preset: SavedPreset,
): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const safeId = sanitizeFirestoreId(preset.id, 'preset');
  const path = `users/${safeUid}/savedPresets/${safeId}`;
  const ref = doc(db, 'users', safeUid, 'savedPresets', safeId);
  const sanitized = sanitizeSavedPresetForFirestore(safeUid, {
    ...preset,
    id: safeId,
  });

  try {
    await setDoc(ref, {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteUserSavedPreset(
  uid: string,
  presetId: string,
): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid, 'user');
  const safeId = sanitizeFirestoreId(presetId, 'preset');
  const path = `users/${safeUid}/savedPresets/${safeId}`;
  const ref = doc(db, 'users', safeUid, 'savedPresets', safeId);

  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export { DEFAULT_USER_PREFERENCES };
