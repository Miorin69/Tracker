import { useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';
import type { CloudSyncState } from './components/AccountMenu';
import { ActionBar } from './components/ActionBar';
import { CoachDrawer } from './components/CoachDrawer';
import { CommandSheet } from './components/CommandSheet';
import { ControlPanel } from './components/ControlPanel';
import { FitnessTipsAndBmi } from './components/FitnessTipsAndBmi';
import { CheckIcon } from './components/Icons';
import { ResilientImage } from './components/ResilientImage';
import { TopBar } from './components/TopBar';
import { WeeklySnapshot } from './components/WeeklySnapshot';
import { WelcomeBanner } from './components/WelcomeBanner';
import { WorkoutVisualStudio } from './components/WorkoutVisualStudio';
import {
  DEFAULT_WEEK_TAG,
  GYM_STAPLES_MEALS,
  QUICK_STAPLES_30M,
} from './data/presets';
import { VISUAL_ASSETS } from './data/visualAssets';
import {
  auth,
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  googleProvider,
} from './firebase';
import type {
  ChecklistCategory,
  CustomHolidayPlan,
  DayIndex,
  DaySchedule,
  MealSlot,
  PrepTimeLimit,
  SavedPreset,
  SplitPresetId,
  StapleMeals,
  WeeklyPlan,
} from './types/plan';
import type { PlanChangeSummary } from './utils/aiPlanMerge';
import {
  buildWorkspaceFingerprint,
  type SavedVideoMap,
  type StoredBmiState,
  type UserWorkspacePreferences,
} from './utils/cloudSyncLogic';
import type { CoachSelection } from './utils/coachLogic';
import {
  createUserSavedPreset,
  deleteUserHolidayPlan,
  deleteUserSavedPreset,
  ensureUserProfileDoc,
  fetchUserHolidayPlans,
  fetchUserSavedPresets,
  fetchUserWorkspace,
  saveUserWorkspace,
  subscribeUserHolidayPlans,
  subscribeUserSavedPresets,
  subscribeUserWorkspace,
  upsertUserHolidayPlan,
} from './utils/firestoreSync';
import {
  applyHolidayPlanToWeek,
  createCustomHolidayPlan,
  syncWeekIntoHolidayPlan,
  updateHolidayPlanDetails,
  type CreateHolidayPlanInput,
  type UpdateHolidayPlanDetailsPatch,
} from './utils/holidayPlanLogic';
import {
  applySampleWeekIntake,
  clearWeekProgress,
  resetDayProgress,
  toggleMealCompletion,
  toggleWorkoutCompletion,
  updateDayExtraIntake,
} from './utils/macroProgressLogic';
import {
  applySplitPresetToPlan,
  createDefaultPlan,
  deriveChecklistFromMeals,
  generateMarkdown,
  generateStandaloneHtml,
  parseImportedPlan,
} from './utils/planLogic';
import {
  loadGuestPreferences,
  saveGuestBmiState,
  saveGuestBookmarkedTipIds,
  saveGuestSavedVideos,
  saveGuestVisualMode,
} from './utils/preferencesStorage';
import {
  clearActivePlan,
  loadActivePlan,
  loadHolidayPlans,
  loadNormalWeekBackup,
  loadSavedPresets,
  saveActivePlan,
  saveHolidayPlans,
  saveNormalWeekBackup,
  savePresetsList,
} from './utils/storage';
import type { VisualMode } from './utils/workoutFocusLogic';

function triggerFileDownload(
  content: string,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatCloudSyncError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (
    raw.includes(
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'",
    )
  ) {
    return `Daily free cloud read quota reached. Quota resets tomorrow, or you can upgrade at https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;
  }
  if (raw.toLowerCase().includes('quota exceeded')) {
    return 'Cloud database daily quota reached. Quota resets tomorrow — your current view remains usable.';
  }
  if (raw.toLowerCase().includes('popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing.';
  }
  if (raw.toLowerCase().includes('popup-blocked')) {
    return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
  }
  return 'Could not sync with your cloud account right now. Please try again shortly.';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [syncState, setSyncState] = useState<CloudSyncState>('guest');
  const [syncError, setSyncError] = useState<string | null>(null);

  const [plan, setPlan] = useState<WeeklyPlan>(() => loadActivePlan());
  const [normalWeekBackup, setNormalWeekBackup] = useState<WeeklyPlan | null>(
    () => loadNormalWeekBackup(),
  );
  const [holidayPlans, setHolidayPlans] = useState<CustomHolidayPlan[]>(() =>
    loadHolidayPlans(),
  );
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() =>
    loadSavedPresets(),
  );
  const [preferences, setPreferences] = useState<UserWorkspacePreferences>(() =>
    loadGuestPreferences(),
  );

  const [selectedDayIndex, setSelectedDayIndex] = useState<DayIndex>(0);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [previousPlanForUndo, setPreviousPlanForUndo] =
    useState<WeeklyPlan | null>(null);
  const [lastAiSummary, setLastAiSummary] = useState<string | null>(null);
  const [lastAiChanges, setLastAiChanges] =
    useState<PlanChangeSummary | null>(null);
  const [highlightedDayIndices, setHighlightedDayIndices] = useState<
    DayIndex[]
  >([]);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachSelection, setCoachSelection] = useState<CoachSelection | null>(
    null,
  );
  const [welcomeVisible, setWelcomeVisible] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('wtm_welcome_dismissed_v1') !== 'true';
    } catch {
      return true;
    }
  });

  const toastTimerRef = useRef<number | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const cloudSaveTimerRef = useRef<number | null>(null);

  const activeUidRef = useRef<string | null>(null);
  const wasSignedInRef = useRef(false);
  const isCloudHydratedRef = useRef(false);
  const workspaceDocExistsRef = useRef(false);
  const lastSyncedFingerprintRef = useRef('');
  const cloudHolidayIdsRef = useRef<Set<string>>(new Set());

  const localStateRef = useRef({
    plan,
    normalWeekBackup,
    holidayPlans,
    savedPresets,
    preferences,
  });
  localStateRef.current = {
    plan,
    normalWeekBackup,
    holidayPlans,
    savedPresets,
    preferences,
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Persist to localStorage ONLY in guest mode so one person's cloud data
  // never leaks into another person's session on a shared browser.
  useEffect(() => {
    if (!authReady || user) return;
    saveActivePlan(plan);
  }, [plan, user, authReady]);

  useEffect(() => {
    if (!authReady || user) return;
    if (normalWeekBackup) {
      saveNormalWeekBackup(normalWeekBackup);
    }
  }, [normalWeekBackup, user, authReady]);

  useEffect(() => {
    if (!authReady || user) return;
    saveHolidayPlans(holidayPlans);
  }, [holidayPlans, user, authReady]);

  useEffect(() => {
    if (!authReady || user) return;
    savePresetsList(savedPresets);
  }, [savedPresets, user, authReady]);

  useEffect(() => {
    if (!authReady || user) return;
    saveGuestBookmarkedTipIds(preferences.bookmarkedTipIds);
    saveGuestBmiState(preferences.bmiState);
    saveGuestSavedVideos(preferences.savedVideos);
    saveGuestVisualMode(preferences.visualMode);
  }, [preferences, user, authReady]);

  // Firebase Auth listener + per-user Firestore hydration & real-time subscriptions
  useEffect(() => {
    let unsubscribers: Unsubscribe[] = [];

    const detachListeners = () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      unsubscribers = [];
    };

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      detachListeners();
      if (cloudSaveTimerRef.current) {
        window.clearTimeout(cloudSaveTimerRef.current);
        cloudSaveTimerRef.current = null;
      }

      if (!nextUser) {
        activeUidRef.current = null;
        isCloudHydratedRef.current = false;
        workspaceDocExistsRef.current = false;
        lastSyncedFingerprintRef.current = '';
        cloudHolidayIdsRef.current = new Set();
        setUser(null);
        setAuthReady(true);
        setSyncState('guest');
        setSyncError(null);

        // If transitioning from signed-in to signed-out, restore local guest state cleanly
        if (wasSignedInRef.current) {
          wasSignedInRef.current = false;
          setPlan(loadActivePlan());
          setNormalWeekBackup(loadNormalWeekBackup());
          setHolidayPlans(loadHolidayPlans());
          setSavedPresets(loadSavedPresets());
          setPreferences(loadGuestPreferences());
          setSelectedDayIndex(0);
          setPreviousPlanForUndo(null);
          setLastAiSummary(null);
          setLastAiChanges(null);
        }
        return;
      }

      wasSignedInRef.current = true;
      activeUidRef.current = nextUser.uid;
      isCloudHydratedRef.current = false;
      workspaceDocExistsRef.current = false;
      setUser(nextUser);
      setAuthReady(true);
      setSyncState('loading');
      setSyncError(null);

      try {
        // 1. Ensure parent /users/{uid} profile exists (Master Gate prerequisite)
        await ensureUserProfileDoc(nextUser);
        if (activeUidRef.current !== nextUser.uid) return;

        // 2. Load this user's personal cloud workspace, holiday plans, and saved presets
        const [cloudWorkspace, cloudHolidays, cloudPresets] = await Promise.all(
          [
            fetchUserWorkspace(nextUser.uid),
            fetchUserHolidayPlans(nextUser.uid),
            fetchUserSavedPresets(nextUser.uid),
          ],
        );
        if (activeUidRef.current !== nextUser.uid) return;

        if (cloudWorkspace) {
          workspaceDocExistsRef.current = true;
          const fp = buildWorkspaceFingerprint(
            cloudWorkspace.activePlan,
            cloudWorkspace.normalWeekBackup,
            cloudWorkspace.preferences,
          );
          lastSyncedFingerprintRef.current = fp;
          cloudHolidayIdsRef.current = new Set(cloudHolidays.map((h) => h.id));

          setPlan(cloudWorkspace.activePlan);
          setNormalWeekBackup(cloudWorkspace.normalWeekBackup);
          setPreferences(cloudWorkspace.preferences);
          setHolidayPlans(cloudHolidays);
          setSavedPresets(cloudPresets);
          setPreviousPlanForUndo(null);
          setLastAiSummary(null);
          setLastAiChanges(null);
        } else {
          // First time this user signed in: save their current local setup into their new cloud account
          const seed = localStateRef.current;
          await saveUserWorkspace(
            nextUser.uid,
            {
              activePlan: seed.plan,
              normalWeekBackup: seed.normalWeekBackup,
              preferences: seed.preferences,
            },
            false,
          );
          if (activeUidRef.current !== nextUser.uid) return;

          workspaceDocExistsRef.current = true;
          lastSyncedFingerprintRef.current = buildWorkspaceFingerprint(
            seed.plan,
            seed.normalWeekBackup,
            seed.preferences,
          );

          if (seed.holidayPlans.length > 0) {
            await Promise.all(
              seed.holidayPlans.map((hp) =>
                upsertUserHolidayPlan(nextUser.uid, hp, false),
              ),
            );
            cloudHolidayIdsRef.current = new Set(
              seed.holidayPlans.map((hp) => hp.id),
            );
          }

          if (seed.savedPresets.length > 0) {
            await Promise.all(
              seed.savedPresets.map((preset) =>
                createUserSavedPreset(nextUser.uid, preset),
              ),
            );
          }
        }

        if (activeUidRef.current !== nextUser.uid) return;
        isCloudHydratedRef.current = true;
        setSyncState('saved');

        // 3. Attach live listeners for multi-tab / multi-device sync
        const handleSnapshotError = (err: Error) => {
          if (activeUidRef.current !== nextUser.uid) return;
          setSyncState('error');
          setSyncError(formatCloudSyncError(err));
        };

        unsubscribers = [
          subscribeUserWorkspace(
            nextUser.uid,
            (incomingWorkspace) => {
              if (activeUidRef.current !== nextUser.uid || !incomingWorkspace) {
                return;
              }
              workspaceDocExistsRef.current = true;
              const incomingFp = buildWorkspaceFingerprint(
                incomingWorkspace.activePlan,
                incomingWorkspace.normalWeekBackup,
                incomingWorkspace.preferences,
              );
              if (incomingFp === lastSyncedFingerprintRef.current) {
                return;
              }
              lastSyncedFingerprintRef.current = incomingFp;
              setPlan(incomingWorkspace.activePlan);
              setNormalWeekBackup(incomingWorkspace.normalWeekBackup);
              setPreferences(incomingWorkspace.preferences);
            },
            handleSnapshotError,
          ),
          subscribeUserHolidayPlans(
            nextUser.uid,
            (plans) => {
              if (activeUidRef.current !== nextUser.uid) return;
              cloudHolidayIdsRef.current = new Set(plans.map((p) => p.id));
              setHolidayPlans(plans);
            },
            handleSnapshotError,
          ),
          subscribeUserSavedPresets(
            nextUser.uid,
            (presets) => {
              if (activeUidRef.current !== nextUser.uid) return;
              setSavedPresets(presets);
            },
            handleSnapshotError,
          ),
        ];
      } catch (error) {
        if (activeUidRef.current !== nextUser.uid) return;
        setSyncState('error');
        setSyncError(formatCloudSyncError(error));
      }
    });

    return () => {
      detachListeners();
      unsubAuth();
      if (cloudSaveTimerRef.current) {
        window.clearTimeout(cloudSaveTimerRef.current);
      }
    };
  }, []);

  // Debounced auto-save for signed-in user's workspace (plan + backup + preferences)
  useEffect(() => {
    if (!user || !isCloudHydratedRef.current) return;

    const nextFp = buildWorkspaceFingerprint(
      plan,
      normalWeekBackup,
      preferences,
    );
    if (nextFp === lastSyncedFingerprintRef.current) return;

    setSyncState('saving');
    if (cloudSaveTimerRef.current) {
      window.clearTimeout(cloudSaveTimerRef.current);
    }

    const targetUid = user.uid;
    cloudSaveTimerRef.current = window.setTimeout(async () => {
      if (activeUidRef.current !== targetUid || !isCloudHydratedRef.current) {
        return;
      }
      try {
        await saveUserWorkspace(
          targetUid,
          {
            activePlan: plan,
            normalWeekBackup,
            preferences,
          },
          workspaceDocExistsRef.current,
        );
        if (activeUidRef.current !== targetUid) return;
        workspaceDocExistsRef.current = true;
        lastSyncedFingerprintRef.current = nextFp;
        setSyncState('saved');
        setSyncError(null);
      } catch (error) {
        if (activeUidRef.current !== targetUid) return;
        setSyncState('error');
        setSyncError(formatCloudSyncError(error));
      }
    }, 650);

    return () => {
      if (cloudSaveTimerRef.current) {
        window.clearTimeout(cloudSaveTimerRef.current);
      }
    };
  }, [user, plan, normalWeekBackup, preferences]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      if (highlightTimerRef.current)
        window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setSyncError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const label =
        cred.user.displayName || cred.user.email || 'your account';
      showToast(`Signed in as ${label}`);
    } catch (error) {
      setSyncError(formatCloudSyncError(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('Signed out — switched to local mode');
    } catch (error) {
      setSyncError(formatCloudSyncError(error));
    }
  };

  const handleDismissWelcome = () => {
    setWelcomeVisible(false);
    try {
      window.localStorage.setItem('wtm_welcome_dismissed_v1', 'true');
    } catch {
      // Ignore storage errors
    }
  };

  const handleShowWelcome = () => {
    setWelcomeVisible(true);
    try {
      window.localStorage.removeItem('wtm_welcome_dismissed_v1');
    } catch {
      // Ignore storage errors
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleUpdateWeekStart = (weekStartDate: string) => {
    setPlan((prev) => ({ ...prev, weekStartDate }));
  };

  const handleSelectNormalWeek = () => {
    if (!plan.activeHolidayPlanId && plan.holidayTag === DEFAULT_WEEK_TAG) {
      return;
    }
    if (normalWeekBackup) {
      setPlan({
        ...normalWeekBackup,
        weekStartDate: plan.weekStartDate,
        holidayTag: DEFAULT_WEEK_TAG,
        holidayNotes: undefined,
        activeHolidayPlanId: undefined,
      });
    } else {
      setPlan((prev) => ({
        ...prev,
        holidayTag: DEFAULT_WEEK_TAG,
        holidayNotes: undefined,
        activeHolidayPlanId: undefined,
      }));
    }
    showToast('Switched to Normal Week');
  };

  const handleApplyHolidayPlan = (holidayPlan: CustomHolidayPlan) => {
    if (!plan.activeHolidayPlanId) {
      setNormalWeekBackup(structuredClone(plan));
    }
    setPlan((prev) => applyHolidayPlanToWeek(prev, holidayPlan));
    showToast(`Applied holiday plan "${holidayPlan.name}"`);
  };

  const handleCreateHolidayPlan = (input: CreateHolidayPlanInput) => {
    if (!plan.activeHolidayPlanId) {
      setNormalWeekBackup(structuredClone(plan));
    }
    const created = createCustomHolidayPlan(plan, input);
    setHolidayPlans((prev) => [created, ...prev]);
    setPlan((prev) => applyHolidayPlanToWeek(prev, created));
    showToast(`Created & applied "${created.name}"`);

    if (user && isCloudHydratedRef.current) {
      void upsertUserHolidayPlan(user.uid, created, false)
        .then(() => {
          cloudHolidayIdsRef.current.add(created.id);
        })
        .catch((err) => {
          setSyncState('error');
          setSyncError(formatCloudSyncError(err));
        });
    }
  };

  const handleUpdateHolidayPlanDetails = (
    id: string,
    patch: UpdateHolidayPlanDetailsPatch,
  ) => {
    let updatedItem: CustomHolidayPlan | null = null;
    setHolidayPlans((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        updatedItem = updateHolidayPlanDetails(item, patch);
        return updatedItem;
      }),
    );

    if (plan.activeHolidayPlanId === id && updatedItem) {
      const next = updatedItem as CustomHolidayPlan;
      setPlan((prev) => ({
        ...prev,
        holidayTag: next.name,
        holidayNotes: next.notes || undefined,
        caloriesTarget: next.caloriesTarget,
        proteinTarget: next.proteinTarget,
        prepTimeLimit: next.prepTimeLimit,
      }));
    }
    showToast('Holiday plan updated');

    if (user && isCloudHydratedRef.current && updatedItem) {
      const nextItem = updatedItem as CustomHolidayPlan;
      const isExisting = cloudHolidayIdsRef.current.has(nextItem.id);
      void upsertUserHolidayPlan(user.uid, nextItem, isExisting)
        .then(() => {
          cloudHolidayIdsRef.current.add(nextItem.id);
        })
        .catch((err) => {
          setSyncState('error');
          setSyncError(formatCloudSyncError(err));
        });
    }
  };

  const handleSyncActiveHolidayPlan = () => {
    if (!plan.activeHolidayPlanId) return;
    let syncedItem: CustomHolidayPlan | null = null;
    setHolidayPlans((prev) =>
      prev.map((item) => {
        if (item.id !== plan.activeHolidayPlanId) return item;
        syncedItem = syncWeekIntoHolidayPlan(item, plan);
        return syncedItem;
      }),
    );
    showToast(`Saved edits to "${syncedItem ? (syncedItem as CustomHolidayPlan).name : plan.holidayTag}"`);

    if (user && isCloudHydratedRef.current && syncedItem) {
      const nextItem = syncedItem as CustomHolidayPlan;
      const isExisting = cloudHolidayIdsRef.current.has(nextItem.id);
      void upsertUserHolidayPlan(user.uid, nextItem, isExisting)
        .then(() => {
          cloudHolidayIdsRef.current.add(nextItem.id);
        })
        .catch((err) => {
          setSyncState('error');
          setSyncError(formatCloudSyncError(err));
        });
    }
  };

  const handleDeleteHolidayPlan = (id: string) => {
    setHolidayPlans((prev) => prev.filter((item) => item.id !== id));
    if (plan.activeHolidayPlanId === id) {
      if (normalWeekBackup) {
        setPlan({
          ...normalWeekBackup,
          weekStartDate: plan.weekStartDate,
          holidayTag: DEFAULT_WEEK_TAG,
          holidayNotes: undefined,
          activeHolidayPlanId: undefined,
        });
      } else {
        setPlan((prev) => ({
          ...prev,
          holidayTag: DEFAULT_WEEK_TAG,
          holidayNotes: undefined,
          activeHolidayPlanId: undefined,
        }));
      }
    }
    showToast('Holiday plan deleted');

    if (user && isCloudHydratedRef.current) {
      cloudHolidayIdsRef.current.delete(id);
      void deleteUserHolidayPlan(user.uid, id).catch((err) => {
        setSyncState('error');
        setSyncError(formatCloudSyncError(err));
      });
    }
  };

  const handleUpdateCalories = (caloriesTarget: number) => {
    setPlan((prev) => ({ ...prev, caloriesTarget }));
  };

  const handleUpdateProtein = (proteinTarget: number) => {
    setPlan((prev) => ({ ...prev, proteinTarget }));
  };

  const handleApplyBmiMacroTargets = (
    caloriesTarget: number,
    proteinTarget: number,
  ) => {
    setPlan((prev) => ({ ...prev, caloriesTarget, proteinTarget }));
    showToast(
      `Applied ${caloriesTarget.toLocaleString('en-US')} kcal & ${proteinTarget}g protein targets`,
    );
  };

  const handleSelectSplitPreset = (presetId: SplitPresetId) => {
    setPlan((prev) => applySplitPresetToPlan(prev, presetId));
    showToast('Training split updated');
  };

  const handleUpdateDay = (
    dayIndex: DayIndex,
    patch: Partial<DaySchedule>,
  ) => {
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.dayIndex === dayIndex ? { ...day, ...patch } : day,
      ),
    }));
  };

  const handleUpdatePrepTimeLimit = (prepTimeLimit: PrepTimeLimit) => {
    setPlan((prev) => ({ ...prev, prepTimeLimit }));
  };

  const handleUpdateStapleMeal = (slot: keyof StapleMeals, value: string) => {
    setPlan((prev) => ({
      ...prev,
      stapleMeals: {
        ...prev.stapleMeals,
        [slot]: value,
      },
    }));
  };

  const handleQuickFillGymStaples = () => {
    setPlan((prev) => {
      const nextMeals =
        prev.prepTimeLimit === '30 mins'
          ? { ...QUICK_STAPLES_30M }
          : { ...GYM_STAPLES_MEALS };
      return {
        ...prev,
        stapleMeals: nextMeals,
        checklist: deriveChecklistFromMeals(nextMeals, prev.prepTimeLimit),
      };
    });
    showToast('Gym staples & checklist populated');
  };

  const handleAutoGenerateChecklist = () => {
    setPlan((prev) => ({
      ...prev,
      checklist: deriveChecklistFromMeals(prev.stapleMeals, prev.prepTimeLimit),
    }));
    showToast('Checklist rebuilt from current meals');
  };

  const handleToggleMealCompleted = (dayIndex: DayIndex, slot: MealSlot) => {
    setPlan((prev) => toggleMealCompletion(prev, dayIndex, slot));
  };

  const handleToggleWorkoutCompleted = (dayIndex: DayIndex) => {
    setPlan((prev) => toggleWorkoutCompletion(prev, dayIndex));
  };

  const handleUpdateExtraIntake = (
    dayIndex: DayIndex,
    extraCalories: number,
    extraProtein: number,
  ) => {
    setPlan((prev) =>
      updateDayExtraIntake(prev, dayIndex, extraCalories, extraProtein),
    );
  };

  const handleResetDayProgress = (dayIndex: DayIndex) => {
    setPlan((prev) => resetDayProgress(prev, dayIndex));
    showToast('Daily progress reset');
  };

  const handleLoadSampleWeek = () => {
    setPlan((prev) => applySampleWeekIntake(prev));
    showToast('Loaded sample 7-day calorie log');
  };

  const handleClearWeekProgress = () => {
    setPlan((prev) => clearWeekProgress(prev));
    showToast('Cleared 7-day intake log');
  };

  const handleToggleChecklistItem = (id: string) => {
    setPlan((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    }));
  };

  const handleAddChecklistItem = (
    category: ChecklistCategory,
    text: string,
  ) => {
    const newItem = {
      id: `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category,
      text,
      checked: false,
    };
    setPlan((prev) => ({
      ...prev,
      checklist: [...prev.checklist, newItem],
    }));
  };

  const handleRemoveChecklistItem = (id: string) => {
    setPlan((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((item) => item.id !== id),
    }));
  };

  const handleSavePreset = (name: string) => {
    const newPreset: SavedPreset = {
      id: `preset-${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      plan: structuredClone(plan),
    };
    setSavedPresets((prev) => [newPreset, ...prev]);
    showToast(`Saved plan "${name}"`);

    if (user && isCloudHydratedRef.current) {
      void createUserSavedPreset(user.uid, newPreset).catch((err) => {
        setSyncState('error');
        setSyncError(formatCloudSyncError(err));
      });
    }
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setPlan(structuredClone(preset.plan));
    showToast(`Loaded "${preset.name}"`);
  };

  const handleDeletePreset = (id: string) => {
    setSavedPresets((prev) => prev.filter((item) => item.id !== id));
    showToast('Saved plan deleted');

    if (user && isCloudHydratedRef.current) {
      void deleteUserSavedPreset(user.uid, id).catch((err) => {
        setSyncState('error');
        setSyncError(formatCloudSyncError(err));
      });
    }
  };

  const handleChangeBookmarkedIds = (updater: (prev: string[]) => string[]) => {
    setPreferences((prev) => ({
      ...prev,
      bookmarkedTipIds: updater(prev.bookmarkedTipIds),
    }));
  };

  const handleChangeBmiState = (
    updater: (prev: StoredBmiState) => StoredBmiState,
  ) => {
    setPreferences((prev) => ({
      ...prev,
      bmiState: updater(prev.bmiState),
    }));
  };

  const handleChangeSavedVideos = (
    updater: (prev: SavedVideoMap) => SavedVideoMap,
  ) => {
    setPreferences((prev) => ({
      ...prev,
      savedVideos: updater(prev.savedVideos),
    }));
  };

  const handleChangeVisualMode = (visualMode: VisualMode) => {
    setPreferences((prev) => ({
      ...prev,
      visualMode,
    }));
  };

  const handleApplyAiPlan = (
    nextPlan: WeeklyPlan,
    summary: string,
    changes: PlanChangeSummary,
  ) => {
    setPreviousPlanForUndo(structuredClone(plan));
    setPlan(nextPlan);
    setLastAiSummary(summary);
    setLastAiChanges(changes);
    setHighlightedDayIndices(changes.changedDayIndices);
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedDayIndices([]);
    }, 5500);

    const toastDetail =
      changes.highlights[0] || 'AI plan adjustments applied';
    showToast(toastDetail);

    if (window.innerWidth < 1024) {
      window.setTimeout(() => {
        handleJumpToSection('weekly-command-sheet');
      }, 120);
    }
  };

  const handleUndoAiPlan = () => {
    if (!previousPlanForUndo) return;
    setPlan(previousPlanForUndo);
    setPreviousPlanForUndo(null);
    setLastAiSummary(null);
    setLastAiChanges(null);
    setHighlightedDayIndices([]);
    showToast('Reverted AI adjustment');
  };

  const handleInspectWithCoach = (selection: CoachSelection) => {
    setSelectedDayIndex(selection.dayIndex as DayIndex);
    setCoachSelection(selection);
    setCoachOpen(true);
  };

  const handleResetDefaults = () => {
    if (!user) {
      clearActivePlan();
    }
    setNormalWeekBackup(null);
    setPlan(createDefaultPlan());
    setSelectedDayIndex(0);
    setImportError(null);
    setPreviousPlanForUndo(null);
    setLastAiSummary(null);
    setLastAiChanges(null);
    setHighlightedDayIndices([]);
    setCoachSelection(null);
    showToast('Reset to default plan');
  };

  const handleCopyMarkdown = async () => {
    const markdown = generateMarkdown(plan);
    let success = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(markdown);
        success = true;
      } catch {
        success = false;
      }
    }

    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = markdown;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      showToast('Copied Markdown to clipboard!');
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2200);
    } else {
      showToast('Clipboard blocked — use Export JSON or HTML');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const filename = `weekly-command-sheet-${plan.weekStartDate}.json`;
    triggerFileDownload(
      JSON.stringify(plan, null, 2),
      filename,
      'application/json;charset=utf-8',
    );
    showToast('Exported JSON backup');
  };

  const handleImportJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const result = parseImportedPlan(content);
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      setImportError(null);
      setPlan(result.plan);
      setSelectedDayIndex(0);
      showToast('Imported weekly plan');
    };
    reader.onerror = () => {
      setImportError('Could not read the selected file.');
    };
    reader.readAsText(file);
  };

  const handleDownloadHtml = () => {
    const html = generateStandaloneHtml(plan);
    const filename = `weekly-command-sheet-${plan.weekStartDate}.html`;
    triggerFileDownload(html, filename, 'text/html;charset=utf-8');
    showToast('Downloaded standalone HTML sheet');
  };

  return (
    <div className="min-h-screen text-[#f6f2ff]">
      <TopBar
        user={user}
        authReady={authReady}
        syncState={syncState}
        syncError={syncError}
        isSigningIn={isSigningIn}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onPrint={handlePrint}
        onJumpToSection={handleJumpToSection}
      />

      <WeeklySnapshot
        plan={plan}
        selectedDayIndex={selectedDayIndex}
        onSelectDay={setSelectedDayIndex}
        onJumpToTracker={() => handleJumpToSection('section-daily-progress')}
      />

      {welcomeVisible && (
        <WelcomeBanner
          onDismiss={handleDismissWelcome}
          onJumpToSection={handleJumpToSection}
          onOpenCoach={() => setCoachOpen(true)}
        />
      )}

      <main
        id="app-layout"
        className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] gap-6 items-start"
      >
        <ControlPanel
          plan={plan}
          selectedDayIndex={selectedDayIndex}
          holidayPlans={holidayPlans}
          savedPresets={savedPresets}
          canUndoAi={Boolean(previousPlanForUndo)}
          lastAiSummary={lastAiSummary}
          lastAiChanges={lastAiChanges}
          onApplyAiPlan={handleApplyAiPlan}
          onUndoAiPlan={handleUndoAiPlan}
          onJumpToSheet={() => handleJumpToSection('weekly-command-sheet')}
          onSelectDay={setSelectedDayIndex}
          onUpdateWeekStart={handleUpdateWeekStart}
          onSelectNormalWeek={handleSelectNormalWeek}
          onApplyHolidayPlan={handleApplyHolidayPlan}
          onCreateHolidayPlan={handleCreateHolidayPlan}
          onUpdateHolidayPlanDetails={handleUpdateHolidayPlanDetails}
          onSyncActiveHolidayPlan={handleSyncActiveHolidayPlan}
          onDeleteHolidayPlan={handleDeleteHolidayPlan}
          onUpdateCalories={handleUpdateCalories}
          onUpdateProtein={handleUpdateProtein}
          onSelectSplitPreset={handleSelectSplitPreset}
          onUpdateDay={handleUpdateDay}
          onUpdatePrepTimeLimit={handleUpdatePrepTimeLimit}
          onUpdateStapleMeal={handleUpdateStapleMeal}
          onQuickFillGymStaples={handleQuickFillGymStaples}
          onAutoGenerateChecklist={handleAutoGenerateChecklist}
          onSavePreset={handleSavePreset}
          onLoadPreset={handleLoadPreset}
          onDeletePreset={handleDeletePreset}
          onResetDefaults={handleResetDefaults}
        />

        <div id="sheet-column" className="min-w-0">
          <ActionBar
            copied={copied}
            importError={importError}
            welcomeVisible={welcomeVisible}
            user={user}
            authReady={authReady}
            isSigningIn={isSigningIn}
            syncError={syncError}
            onSignIn={handleGoogleSignIn}
            onDismissSyncError={() => setSyncError(null)}
            onShowWelcome={handleShowWelcome}
            onOpenCoach={() => setCoachOpen(true)}
            onCopyMarkdown={handleCopyMarkdown}
            onExportJson={handleExportJson}
            onImportJsonFile={handleImportJsonFile}
            onDownloadHtml={handleDownloadHtml}
            onDismissImportError={() => setImportError(null)}
          />

          <CommandSheet
            plan={plan}
            selectedDayIndex={selectedDayIndex}
            highlightedDayIndices={highlightedDayIndices}
            activeCoachSelection={coachOpen ? coachSelection : null}
            onSelectDay={setSelectedDayIndex}
            onInspectWithCoach={handleInspectWithCoach}
            onToggleMealCompleted={handleToggleMealCompleted}
            onToggleWorkoutCompleted={handleToggleWorkoutCompleted}
            onUpdateExtraIntake={handleUpdateExtraIntake}
            onResetDayProgress={handleResetDayProgress}
            onLoadSampleWeek={handleLoadSampleWeek}
            onClearWeekProgress={handleClearWeekProgress}
            onToggleChecklistItem={handleToggleChecklistItem}
            onAddChecklistItem={handleAddChecklistItem}
            onRemoveChecklistItem={handleRemoveChecklistItem}
            onAutoGenerateChecklist={handleAutoGenerateChecklist}
          />
        </div>
      </main>

      <WorkoutVisualStudio
        plan={plan}
        savedVideos={preferences.savedVideos}
        visualMode={preferences.visualMode}
        onChangeSavedVideos={handleChangeSavedVideos}
        onChangeVisualMode={handleChangeVisualMode}
        onShowToast={showToast}
      />

      <FitnessTipsAndBmi
        plan={plan}
        bookmarkedIds={preferences.bookmarkedTipIds}
        bmiState={preferences.bmiState}
        onChangeBookmarkedIds={handleChangeBookmarkedIds}
        onChangeBmiState={handleChangeBmiState}
        onApplyMacroTargets={handleApplyBmiMacroTargets}
        onOpenCoach={() => setCoachOpen(true)}
      />

      <footer className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 pb-10">
        <div className="border-t border-[#2d2150] pt-6 flex items-center justify-center gap-2.5">
          <span className="w-7 h-7 rounded-md overflow-hidden bg-[#f7f7f7] border border-[#ffd166]/55 shrink-0 block">
            <ResilientImage
              src={VISUAL_ASSETS.appLogoMascot}
              alt="Prep Split Fit Duck mascot"
              fallbackLabel="PS"
              className="w-full h-full object-cover object-center"
            />
          </span>
          <p className="text-xs sm:text-sm text-[#c5b8e3] tracking-wide">
            Created and designed by{' '}
            <span className="font-semibold text-[#faf7ff]">Aakrisht Thapa</span>{' '}
            using{' '}
            <span className="font-semibold text-[#38e8ff]">
              Google AI Studio
            </span>
          </p>
        </div>
      </footer>

      <CoachDrawer
        isOpen={coachOpen}
        plan={plan}
        selectedDayIndex={selectedDayIndex}
        selection={coachSelection}
        onSelectItem={handleInspectWithCoach}
        onClose={() => setCoachOpen(false)}
      />

      {/* Non-intrusive Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#faf7ff] bg-[#1b1336] border border-[#ff4fa3]/60 rounded-md shadow-[0_12px_32px_rgba(0,0,0,0.65)]"
        >
          <CheckIcon className="w-3.5 h-3.5 text-[#34d399] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
