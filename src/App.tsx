import { useEffect, useRef, useState } from 'react';
import { ActionBar } from './components/ActionBar';
import { CoachDrawer } from './components/CoachDrawer';
import { CommandSheet } from './components/CommandSheet';
import { ControlPanel } from './components/ControlPanel';
import { FitnessTipsAndBmi } from './components/FitnessTipsAndBmi';
import { CheckIcon } from './components/Icons';
import { PrintPreviewOverlay } from './components/PrintPreviewOverlay';
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
import type { CoachSelection } from './utils/coachLogic';
import {
  applyHolidayPlanToWeek,
  createCustomHolidayPlan,
  syncWeekIntoHolidayPlan,
  updateHolidayPlanDetails,
  type CreateHolidayPlanInput,
  type UpdateHolidayPlanDetailsPatch,
} from './utils/holidayPlanLogic';
import {
  addLocalProfile,
  deleteLocalProfile,
  renameLocalProfile,
  selectLocalProfile,
  type LocalProfilesState,
  type SavedVideoMap,
  type StoredBmiState,
  type UserWorkspacePreferences,
} from './utils/localProfileLogic';
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
  deleteChecklistItems,
  deriveChecklistFromMeals,
  generateMarkdown,
  generateStandaloneHtml,
  moveChecklistItemsCategory,
  parseImportedPlan,
  sortChecklistByCategoryAndName,
} from './utils/planLogic';
import {
  loadProfilePreferences,
  saveProfileBmiState,
  saveProfileBookmarkedTipIds,
  saveProfileSavedVideos,
  saveProfileVisualMode,
} from './utils/preferencesStorage';
import {
  clearActivePlan,
  clearProfileStorage,
  loadActivePlan,
  loadHolidayPlans,
  loadNormalWeekBackup,
  loadProfilesState,
  loadSavedPresets,
  saveActivePlan,
  saveHolidayPlans,
  saveNormalWeekBackup,
  savePresetsList,
  saveProfilesState,
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

export default function App() {
  const [profilesState, setProfilesState] = useState<LocalProfilesState>(() =>
    loadProfilesState(),
  );
  const activeProfileId = profilesState.activeProfileId;
  const activeProfile =
    profilesState.profiles.find((p) => p.id === activeProfileId) ??
    profilesState.profiles[0];

  const [workspaceProfileId, setWorkspaceProfileId] =
    useState<string>(activeProfileId);

  const [plan, setPlan] = useState<WeeklyPlan>(() =>
    loadActivePlan(activeProfileId),
  );
  const [normalWeekBackup, setNormalWeekBackup] = useState<WeeklyPlan | null>(
    () => loadNormalWeekBackup(activeProfileId),
  );
  const [holidayPlans, setHolidayPlans] = useState<CustomHolidayPlan[]>(() =>
    loadHolidayPlans(activeProfileId),
  );
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() =>
    loadSavedPresets(activeProfileId),
  );
  const [preferences, setPreferences] = useState<UserWorkspacePreferences>(() =>
    loadProfilePreferences(activeProfileId),
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
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
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

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  useEffect(() => {
    saveProfilesState(profilesState);
  }, [profilesState]);

  useEffect(() => {
    saveActivePlan(plan, workspaceProfileId);
  }, [plan, workspaceProfileId]);

  useEffect(() => {
    saveNormalWeekBackup(normalWeekBackup, workspaceProfileId);
  }, [normalWeekBackup, workspaceProfileId]);

  useEffect(() => {
    saveHolidayPlans(holidayPlans, workspaceProfileId);
  }, [holidayPlans, workspaceProfileId]);

  useEffect(() => {
    savePresetsList(savedPresets, workspaceProfileId);
  }, [savedPresets, workspaceProfileId]);

  useEffect(() => {
    saveProfileBookmarkedTipIds(
      preferences.bookmarkedTipIds,
      workspaceProfileId,
    );
    saveProfileBmiState(preferences.bmiState, workspaceProfileId);
    saveProfileSavedVideos(preferences.savedVideos, workspaceProfileId);
    saveProfileVisualMode(preferences.visualMode, workspaceProfileId);
  }, [preferences, workspaceProfileId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      if (highlightTimerRef.current)
        window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const hydrateProfileWorkspace = (profileId: string) => {
    setWorkspaceProfileId(profileId);
    setPlan(loadActivePlan(profileId));
    setNormalWeekBackup(loadNormalWeekBackup(profileId));
    setHolidayPlans(loadHolidayPlans(profileId));
    setSavedPresets(loadSavedPresets(profileId));
    setPreferences(loadProfilePreferences(profileId));
    setSelectedDayIndex(0);
    setImportError(null);
    setPreviousPlanForUndo(null);
    setLastAiSummary(null);
    setLastAiChanges(null);
    setHighlightedDayIndices([]);
    setCoachSelection(null);
  };

  const handleSelectProfile = (id: string) => {
    if (id === profilesState.activeProfileId) return;
    const next = selectLocalProfile(profilesState, id);
    const chosen = next.profiles.find((p) => p.id === next.activeProfileId);
    setProfilesState(next);
    hydrateProfileWorkspace(next.activeProfileId);
    if (chosen) {
      showToast(`Switched to ${chosen.name}`);
    }
  };

  const handleAddProfile = (name: string): { ok: boolean; error?: string } => {
    const result = addLocalProfile(profilesState, name);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    setProfilesState(result.state);
    hydrateProfileWorkspace(result.profile.id);
    showToast(`Created profile "${result.profile.name}"`);
    return { ok: true };
  };

  const handleRenameProfile = (
    id: string,
    name: string,
  ): { ok: boolean; error?: string } => {
    const result = renameLocalProfile(profilesState, id, name);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    setProfilesState(result.state);
    showToast(`Renamed profile to "${result.profile.name}"`);
    return { ok: true };
  };

  const handleDeleteProfile = (id: string): { ok: boolean; error?: string } => {
    const target = profilesState.profiles.find((p) => p.id === id);
    const result = deleteLocalProfile(profilesState, id);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    clearProfileStorage(id);
    setProfilesState(result.state);
    if (result.state.activeProfileId !== workspaceProfileId) {
      hydrateProfileWorkspace(result.state.activeProfileId);
    }
    if (target) {
      showToast(`Deleted profile "${target.name}"`);
    }
    return { ok: true };
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
    showToast(
      `Saved edits to "${syncedItem ? (syncedItem as CustomHolidayPlan).name : plan.holidayTag}"`,
    );
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

  const handleSortChecklist = () => {
    setPlan((prev) => ({
      ...prev,
      checklist: sortChecklistByCategoryAndName(prev.checklist),
    }));
    showToast('Checklist grouped by category & sorted A–Z');
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

  const handleDeleteChecklistItems = (ids: string[]) => {
    if (ids.length === 0) return;
    setPlan((prev) => ({
      ...prev,
      checklist: deleteChecklistItems(prev.checklist, ids),
    }));
    showToast(
      ids.length === 1
        ? 'Deleted 1 checklist item'
        : `Deleted ${ids.length} checklist items`,
    );
  };

  const handleMoveChecklistItems = (
    ids: string[],
    targetCategory: ChecklistCategory,
  ) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const movedCount = plan.checklist.filter(
      (item) => idSet.has(item.id) && item.category !== targetCategory,
    ).length;
    if (movedCount === 0) return;

    setPlan((prev) => ({
      ...prev,
      checklist: moveChecklistItemsCategory(prev.checklist, ids, targetCategory),
    }));
    const destinationLabel =
      targetCategory === 'prep' ? 'Meal Prep Steps' : 'Grocery List';
    showToast(
      movedCount === 1
        ? `Moved 1 item to ${destinationLabel}`
        : `Moved ${movedCount} items to ${destinationLabel}`,
    );
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
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setPlan(structuredClone(preset.plan));
    showToast(`Loaded "${preset.name}"`);
  };

  const handleDeletePreset = (id: string) => {
    setSavedPresets((prev) => prev.filter((item) => item.id !== id));
    showToast('Saved plan deleted');
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
    clearActivePlan(workspaceProfileId);
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
        profiles={profilesState.profiles}
        activeProfile={activeProfile}
        onSelectProfile={handleSelectProfile}
        onAddProfile={handleAddProfile}
        onRenameProfile={handleRenameProfile}
        onDeleteProfile={handleDeleteProfile}
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
            printPreviewOpen={printPreviewOpen}
            onTogglePrintPreview={() => setPrintPreviewOpen((prev) => !prev)}
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
            onDeleteChecklistItems={handleDeleteChecklistItems}
            onMoveChecklistItems={handleMoveChecklistItems}
            onAutoGenerateChecklist={handleAutoGenerateChecklist}
            onSortChecklist={handleSortChecklist}
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

      <footer className="no-print max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 pb-10">
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

      <PrintPreviewOverlay
        isOpen={printPreviewOpen}
        plan={plan}
        selectedDayIndex={selectedDayIndex}
        onClose={() => setPrintPreviewOpen(false)}
        onPrint={handlePrint}
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
        onDeleteChecklistItems={handleDeleteChecklistItems}
        onMoveChecklistItems={handleMoveChecklistItems}
        onAutoGenerateChecklist={handleAutoGenerateChecklist}
        onSortChecklist={handleSortChecklist}
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
