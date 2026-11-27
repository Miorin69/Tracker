import { useState } from 'react';
import {
  DEFAULT_WEEK_TAG,
  PREP_TIME_LIMITS,
  SPLIT_PRESETS,
} from '../data/presets';
import type {
  CustomHolidayPlan,
  DayIndex,
  DaySchedule,
  PrepTimeLimit,
  SavedPreset,
  SplitPresetId,
  StapleMeals,
  WeeklyPlan,
} from '../types/plan';
import { VISUAL_ASSETS } from '../data/visualAssets';
import type { PlanChangeSummary } from '../utils/aiPlanMerge';
import {
  hasUnsavedHolidayEdits,
  type CreateHolidayPlanInput,
  type HolidayStarterMode,
  type UpdateHolidayPlanDetailsPatch,
} from '../utils/holidayPlanLogic';
import {
  inferMuscleGroup,
  recommendWarmupForSession,
} from '../utils/warmupLogic';
import { AiPlanAdjuster } from './AiPlanAdjuster';
import {
  BookmarkIcon,
  EditIcon,
  PlusIcon,
  RotateCcwIcon,
  TrashIcon,
} from './Icons';
import { ResilientImage } from './ResilientImage';

interface ControlPanelProps {
  plan: WeeklyPlan;
  selectedDayIndex: DayIndex;
  holidayPlans: CustomHolidayPlan[];
  savedPresets: SavedPreset[];
  canUndoAi: boolean;
  lastAiSummary: string | null;
  lastAiChanges: PlanChangeSummary | null;
  onApplyAiPlan: (
    nextPlan: WeeklyPlan,
    summary: string,
    changes: PlanChangeSummary,
  ) => void;
  onUndoAiPlan: () => void;
  onJumpToSheet: () => void;
  onSelectDay: (dayIndex: DayIndex) => void;
  onUpdateWeekStart: (dateStr: string) => void;
  onSelectNormalWeek: () => void;
  onApplyHolidayPlan: (holidayPlan: CustomHolidayPlan) => void;
  onCreateHolidayPlan: (input: CreateHolidayPlanInput) => void;
  onUpdateHolidayPlanDetails: (
    id: string,
    patch: UpdateHolidayPlanDetailsPatch,
  ) => void;
  onSyncActiveHolidayPlan: () => void;
  onDeleteHolidayPlan: (id: string) => void;
  onUpdateCalories: (value: number) => void;
  onUpdateProtein: (value: number) => void;
  onSelectSplitPreset: (presetId: SplitPresetId) => void;
  onUpdateDay: (dayIndex: DayIndex, patch: Partial<DaySchedule>) => void;
  onUpdatePrepTimeLimit: (limit: PrepTimeLimit) => void;
  onUpdateStapleMeal: (slot: keyof StapleMeals, value: string) => void;
  onQuickFillGymStaples: () => void;
  onAutoGenerateChecklist: () => void;
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: SavedPreset) => void;
  onDeletePreset: (id: string) => void;
  onResetDefaults: () => void;
}

export function ControlPanel({
  plan,
  selectedDayIndex,
  holidayPlans,
  savedPresets,
  canUndoAi,
  lastAiSummary,
  lastAiChanges,
  onApplyAiPlan,
  onUndoAiPlan,
  onJumpToSheet,
  onSelectDay,
  onUpdateWeekStart,
  onSelectNormalWeek,
  onApplyHolidayPlan,
  onCreateHolidayPlan,
  onUpdateHolidayPlanDetails,
  onSyncActiveHolidayPlan,
  onDeleteHolidayPlan,
  onUpdateCalories,
  onUpdateProtein,
  onSelectSplitPreset,
  onUpdateDay,
  onUpdatePrepTimeLimit,
  onUpdateStapleMeal,
  onQuickFillGymStaples,
  onAutoGenerateChecklist,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onResetDefaults,
}: ControlPanelProps) {
  const [caloriesInput, setCaloriesInput] = useState<string>(
    String(plan.caloriesTarget),
  );
  const [proteinInput, setProteinInput] = useState<string>(
    String(plan.proteinTarget),
  );
  const [caloriesError, setCaloriesError] = useState<string | null>(null);
  const [proteinError, setProteinError] = useState<string | null>(null);

  // Custom Holiday Plan inline creator / editor state
  const [holidayEditorMode, setHolidayEditorMode] = useState<
    'closed' | 'create' | 'edit'
  >('closed');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidayNameInput, setHolidayNameInput] = useState('');
  const [holidayNotesInput, setHolidayNotesInput] = useState('');
  const [holidayCalInput, setHolidayCalInput] = useState(
    String(plan.caloriesTarget),
  );
  const [holidayProtInput, setHolidayProtInput] = useState(
    String(plan.proteinTarget),
  );
  const [holidayPrepInput, setHolidayPrepInput] = useState<PrepTimeLimit>('30 mins');
  const [holidayStarterMode, setHolidayStarterMode] =
    useState<HolidayStarterMode>('quick-maintenance');
  const [holidayFormError, setHolidayFormError] = useState<string | null>(null);

  const [showDayMealOverrides, setShowDayMealOverrides] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetError, setPresetError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Sync displayed numeric strings if plan resets/loads externally
  const [lastSyncedCal, setLastSyncedCal] = useState(plan.caloriesTarget);
  const [lastSyncedProt, setLastSyncedProt] = useState(plan.proteinTarget);
  if (plan.caloriesTarget !== lastSyncedCal) {
    setLastSyncedCal(plan.caloriesTarget);
    setCaloriesInput(String(plan.caloriesTarget));
    setCaloriesError(null);
  }
  if (plan.proteinTarget !== lastSyncedProt) {
    setLastSyncedProt(plan.proteinTarget);
    setProteinInput(String(plan.proteinTarget));
    setProteinError(null);
  }

  const activeDay = plan.days[selectedDayIndex];
  const activeHolidayPlan = plan.activeHolidayPlanId
    ? holidayPlans.find((h) => h.id === plan.activeHolidayPlanId) ?? null
    : null;
  const activeHolidayHasUnsavedEdits = activeHolidayPlan
    ? hasUnsavedHolidayEdits(activeHolidayPlan, plan)
    : false;

  const openCreateHolidayEditor = () => {
    setHolidayEditorMode('create');
    setEditingHolidayId(null);
    setHolidayNameInput('');
    setHolidayNotesInput('');
    setHolidayCalInput(String(plan.caloriesTarget));
    setHolidayProtInput(String(plan.proteinTarget));
    setHolidayPrepInput('30 mins');
    setHolidayStarterMode('quick-maintenance');
    setHolidayFormError(null);
  };

  const openEditHolidayEditor = (item: CustomHolidayPlan) => {
    setHolidayEditorMode('edit');
    setEditingHolidayId(item.id);
    setHolidayNameInput(item.name);
    setHolidayNotesInput(item.notes);
    setHolidayCalInput(String(item.caloriesTarget));
    setHolidayProtInput(String(item.proteinTarget));
    setHolidayPrepInput(item.prepTimeLimit);
    setHolidayFormError(null);
  };

  const closeHolidayEditor = () => {
    setHolidayEditorMode('closed');
    setEditingHolidayId(null);
    setHolidayFormError(null);
  };

  const handleHolidayFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = holidayNameInput.trim();
    if (!trimmedName) {
      setHolidayFormError('Enter a name for your holiday plan.');
      return;
    }
    const parsedCal = Number(holidayCalInput);
    if (!Number.isFinite(parsedCal) || parsedCal < 800 || parsedCal > 10000) {
      setHolidayFormError('Calories must be between 800 and 10,000 kcal.');
      return;
    }
    const parsedProt = Number(holidayProtInput);
    if (!Number.isFinite(parsedProt) || parsedProt < 30 || parsedProt > 500) {
      setHolidayFormError('Protein must be between 30 and 500 g.');
      return;
    }

    setHolidayFormError(null);

    if (holidayEditorMode === 'edit' && editingHolidayId) {
      onUpdateHolidayPlanDetails(editingHolidayId, {
        name: trimmedName,
        notes: holidayNotesInput.trim(),
        caloriesTarget: Math.round(parsedCal),
        proteinTarget: Math.round(parsedProt),
        prepTimeLimit: holidayPrepInput,
      });
    } else {
      onCreateHolidayPlan({
        name: trimmedName,
        notes: holidayNotesInput.trim(),
        caloriesTarget: Math.round(parsedCal),
        proteinTarget: Math.round(parsedProt),
        prepTimeLimit: holidayPrepInput,
        starterMode: holidayStarterMode,
      });
    }

    closeHolidayEditor();
  };

  const handleCaloriesChange = (raw: string) => {
    setCaloriesInput(raw);
    if (raw.trim() === '') {
      setCaloriesError('Enter a target between 800 and 10,000 kcal.');
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 800 || parsed > 10000) {
      setCaloriesError('Must be between 800 and 10,000 kcal.');
      return;
    }
    setCaloriesError(null);
    const rounded = Math.round(parsed);
    setLastSyncedCal(rounded);
    onUpdateCalories(rounded);
  };

  const handleProteinChange = (raw: string) => {
    setProteinInput(raw);
    if (raw.trim() === '') {
      setProteinError('Enter a target between 30 and 500 g.');
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 30 || parsed > 500) {
      setProteinError('Must be between 30 and 500 g.');
      return;
    }
    setProteinError(null);
    const rounded = Math.round(parsed);
    setLastSyncedProt(rounded);
    onUpdateProtein(rounded);
  };

  const handleSavePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = presetName.trim();
    if (!trimmed) {
      setPresetError('Enter a plan name before saving.');
      return;
    }
    setPresetError(null);
    onSavePreset(trimmed);
    setPresetName('');
  };

  const handleDayMealOverrideChange = (
    slot: keyof StapleMeals,
    value: string,
  ) => {
    const nextOverrides = {
      ...(activeDay.mealOverrides ?? {}),
      [slot]: value,
    };
    const hasAnyOverride = Object.values(nextOverrides).some(
      (v) => v && v.trim().length > 0,
    );
    onUpdateDay(selectedDayIndex, {
      mealOverrides: hasAnyOverride ? nextOverrides : undefined,
    });
  };

  const handleClearDayOverrides = () => {
    onUpdateDay(selectedDayIndex, { mealOverrides: undefined });
  };

  const activeDayHasOverrides = Boolean(
    activeDay.mealOverrides &&
      Object.values(activeDay.mealOverrides).some(
        (v) => v && v.trim().length > 0,
      ),
  );

  return (
    <aside
      aria-label="Plan configuration controls"
      className="no-print bg-[#150f29]/95 border border-[#35285b] rounded-lg divide-y divide-[#2d2150] overflow-hidden shadow-[0_14px_38px_rgba(6,3,18,0.5)]"
    >
      <AiPlanAdjuster
        plan={plan}
        canUndo={canUndoAi}
        lastSummary={lastAiSummary}
        lastChanges={lastAiChanges}
        onApplyAiPlan={onApplyAiPlan}
        onUndoAiPlan={onUndoAiPlan}
        onJumpToSheet={onJumpToSheet}
      />

      {/* Section 1: Week & Custom Holiday Plans */}
      <section id="section-week-theme" className="p-5 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-[#faf7ff]">
            1. Week &amp; Holiday Plans
          </h2>
          <p className="text-xs text-[#b5a7d6] mt-0.5">
            Set start date, build editable holiday plans, and adjust daily
            macro targets.
          </p>
        </div>

        <div className="space-y-3.5">
          <div>
            <label
              htmlFor="week-start-date"
              className="block text-xs font-medium text-[#d4c8ef] mb-1"
            >
              Week Start Date
            </label>
            <input
              id="week-start-date"
              type="date"
              value={plan.weekStartDate}
              onChange={(e) => {
                if (e.target.value) onUpdateWeekStart(e.target.value);
              }}
              className="w-full h-10 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3] tabular-nums [color-scheme:dark]"
            />
          </div>

          {/* Custom Editable Holiday Plans Manager */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#d4c8ef]">
                Custom Holiday Plans
              </span>
              {holidayEditorMode === 'closed' && (
                <button
                  type="button"
                  onClick={openCreateHolidayEditor}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#faf7ff] bg-[#21183e] border border-[#4a397a] rounded-md hover:bg-[#2c2052] hover:border-[#ff6ea8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PlusIcon className="w-3 h-3 text-[#ff6ea8]" />
                  <span>New Holiday Plan</span>
                </button>
              )}
            </div>

            <div className="border border-[#35285b] rounded-md divide-y divide-[#2d2150] overflow-hidden">
              {/* Normal Week Row */}
              <div
                className={`flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                  !activeHolidayPlan
                    ? 'bg-[#261b49] text-[#faf7ff]'
                    : 'bg-[#110c23] hover:bg-[#191233]'
                }`}
              >
                <button
                  type="button"
                  onClick={onSelectNormalWeek}
                  aria-pressed={!activeHolidayPlan}
                  className="flex-1 text-left min-w-0 cursor-pointer"
                >
                  <div
                    className={`font-semibold ${
                      !activeHolidayPlan ? 'text-[#faf7ff]' : 'text-[#e6ddf8]'
                    }`}
                  >
                    {DEFAULT_WEEK_TAG}
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      !activeHolidayPlan ? 'text-[#c5b8e3]' : 'text-[#9f8ec7]'
                    }`}
                  >
                    Standard weekly training &amp; meal routine
                  </div>
                </button>
                {!activeHolidayPlan && (
                  <span className="text-[11px] font-semibold text-[#38e8ff] shrink-0">
                    Active
                  </span>
                )}
              </div>

              {/* User's Custom Editable Holiday Plans */}
              {holidayPlans.map((item) => {
                const isActive = activeHolidayPlan?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                      isActive
                        ? 'bg-[#2c193f]'
                        : 'bg-[#110c23] hover:bg-[#191233]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onApplyHolidayPlan(item)}
                      aria-pressed={isActive}
                      aria-label={`Use holiday plan ${item.name}`}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-[#faf7ff] truncate">
                          {item.name}
                        </span>
                        {isActive && (
                          <span className="text-[11px] font-semibold text-[#ffd166] shrink-0">
                            · Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9f8ec7] tabular-nums truncate">
                        {item.caloriesTarget.toLocaleString('en-US')} kcal ·{' '}
                        {item.proteinTarget}g P · {item.prepTimeLimit}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditHolidayEditor(item)}
                        aria-label={`Edit holiday plan ${item.name}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#e6ddf8] bg-[#1e163a] border border-[#3e2f6b] rounded hover:bg-[#2a1f4f] hover:border-[#ff6ea8] transition-colors cursor-pointer"
                      >
                        <EditIcon className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingHolidayId === item.id) {
                            closeHolidayEditor();
                          }
                          onDeleteHolidayPlan(item.id);
                        }}
                        aria-label={`Delete holiday plan ${item.name}`}
                        className="p-1 text-[#9f8ec7] hover:text-[#fda4af] hover:bg-[#3b1224] rounded transition-colors cursor-pointer"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {holidayPlans.length === 0 && holidayEditorMode === 'closed' && (
              <p className="text-[11px] text-[#9f8ec7] leading-snug">
                No custom holiday plans yet. Create your own editable holiday
                plan with custom workouts, meals, and targets.
              </p>
            )}

            {/* Active Holiday Plan Edit Sync Banner */}
            {activeHolidayPlan && holidayEditorMode === 'closed' && (
              <div className="p-2.5 bg-[#2a183b] border border-[#ff875e]/45 rounded-md space-y-2">
                <div className="text-[11px] text-[#f6e7ff] leading-snug">
                  <span className="font-semibold text-[#ffd166]">
                    Editing &ldquo;{activeHolidayPlan.name}&rdquo;:
                  </span>{' '}
                  {activeHolidayPlan.notes
                    ? activeHolidayPlan.notes
                    : 'Customize any workouts, meals, or targets below, then save updates back to this holiday plan.'}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {activeHolidayHasUnsavedEdits && (
                    <button
                      type="button"
                      onClick={onSyncActiveHolidayPlan}
                      className="px-2.5 py-1 text-xs font-bold rounded vice-sunset-btn transition-all cursor-pointer"
                    >
                      Save edits to &ldquo;{activeHolidayPlan.name}&rdquo;
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditHolidayEditor(activeHolidayPlan)}
                    className="text-xs font-medium text-[#38e8ff] hover:underline underline-offset-2 cursor-pointer"
                  >
                    Edit details
                  </button>
                </div>
              </div>
            )}

            {/* Inline Holiday Plan Creator / Editor */}
            {holidayEditorMode !== 'closed' && (
              <form
                onSubmit={handleHolidayFormSubmit}
                aria-label={
                  holidayEditorMode === 'edit'
                    ? 'Edit custom holiday plan'
                    : 'Create custom holiday plan'
                }
                className="p-3 bg-[#191233] border border-[#4a397a] rounded-md space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#faf7ff]">
                    {holidayEditorMode === 'edit'
                      ? 'Edit Holiday Plan'
                      : 'Create Custom Holiday Plan'}
                  </span>
                  <button
                    type="button"
                    onClick={closeHolidayEditor}
                    className="text-[11px] font-medium text-[#b5a7d6] hover:text-[#faf7ff] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="holiday-plan-name"
                    className="block text-[11px] font-medium text-[#d4c8ef] mb-1"
                  >
                    Holiday Plan Name
                  </label>
                  <input
                    id="holiday-plan-name"
                    type="text"
                    value={holidayNameInput}
                    onChange={(e) => {
                      setHolidayNameInput(e.target.value);
                      if (holidayFormError) setHolidayFormError(null);
                    }}
                    placeholder="e.g., Summer Vacation, Family Trip, Festival Week"
                    className="w-full h-8 px-2.5 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="holiday-plan-notes"
                    className="block text-[11px] font-medium text-[#d4c8ef] mb-1"
                  >
                    Strategy / Notes (optional)
                  </label>
                  <input
                    id="holiday-plan-notes"
                    type="text"
                    value={holidayNotesInput}
                    onChange={(e) => setHolidayNotesInput(e.target.value)}
                    placeholder="e.g., 25-min morning lifts, protein-first dinners"
                    className="w-full h-8 px-2.5 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="holiday-plan-calories"
                      className="block text-[11px] font-medium text-[#d4c8ef] mb-1"
                    >
                      Calories (kcal)
                    </label>
                    <input
                      id="holiday-plan-calories"
                      type="number"
                      min={800}
                      max={10000}
                      step={50}
                      value={holidayCalInput}
                      onChange={(e) => setHolidayCalInput(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded tabular-nums focus:outline-none focus:border-[#ff4fa3]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="holiday-plan-protein"
                      className="block text-[11px] font-medium text-[#d4c8ef] mb-1"
                    >
                      Protein (g)
                    </label>
                    <input
                      id="holiday-plan-protein"
                      type="number"
                      min={30}
                      max={500}
                      step={5}
                      value={holidayProtInput}
                      onChange={(e) => setHolidayProtInput(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded tabular-nums focus:outline-none focus:border-[#ff4fa3]"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] font-medium text-[#d4c8ef] mb-1">
                    Prep Time Window
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {PREP_TIME_LIMITS.map((limit) => (
                      <button
                        key={limit}
                        type="button"
                        aria-pressed={holidayPrepInput === limit}
                        onClick={() => setHolidayPrepInput(limit)}
                        className={`py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                          holidayPrepInput === limit
                            ? 'bg-[#2c2052] text-[#38e8ff] border-[#38e8ff]/60'
                            : 'bg-[#110c23] text-[#c5b8e3] border-[#3e2f6b] hover:bg-[#21183e]'
                        }`}
                      >
                        {limit}
                      </button>
                    ))}
                  </div>
                </div>

                {holidayEditorMode === 'create' && (
                  <div>
                    <span className="block text-[11px] font-medium text-[#d4c8ef] mb-1">
                      Starting Workouts &amp; Meals
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        aria-pressed={holidayStarterMode === 'quick-maintenance'}
                        onClick={() =>
                          setHolidayStarterMode('quick-maintenance')
                        }
                        className={`px-2 py-1.5 text-[11px] font-medium rounded border text-left transition-colors cursor-pointer ${
                          holidayStarterMode === 'quick-maintenance'
                            ? 'bg-[#2c2052] text-[#38e8ff] border-[#38e8ff]/60'
                            : 'bg-[#110c23] text-[#c5b8e3] border-[#3e2f6b] hover:bg-[#21183e]'
                        }`}
                      >
                        Quick Sessions (3×25m)
                      </button>
                      <button
                        type="button"
                        aria-pressed={holidayStarterMode === 'current'}
                        onClick={() => setHolidayStarterMode('current')}
                        className={`px-2 py-1.5 text-[11px] font-medium rounded border text-left transition-colors cursor-pointer ${
                          holidayStarterMode === 'current'
                            ? 'bg-[#2c2052] text-[#38e8ff] border-[#38e8ff]/60'
                            : 'bg-[#110c23] text-[#c5b8e3] border-[#3e2f6b] hover:bg-[#21183e]'
                        }`}
                      >
                        Copy Current Week
                      </button>
                    </div>
                  </div>
                )}

                {holidayFormError && (
                  <p role="alert" className="text-[11px] text-[#fda4af]">
                    {holidayFormError}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="submit"
                    className="flex-1 h-8 px-3 text-xs font-bold rounded vice-sunset-btn transition-all cursor-pointer"
                  >
                    {holidayEditorMode === 'edit'
                      ? 'Save Changes'
                      : 'Save & Apply Holiday Plan'}
                  </button>
                  <button
                    type="button"
                    onClick={closeHolidayEditor}
                    className="h-8 px-3 text-xs font-medium text-[#e6ddf8] bg-[#21183e] border border-[#3e2f6b] rounded hover:bg-[#2c2052] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="calories-target"
                className="block text-xs font-medium text-[#d4c8ef] mb-1"
              >
                Daily Calories (kcal)
              </label>
              <input
                id="calories-target"
                type="number"
                min={800}
                max={10000}
                step={50}
                value={caloriesInput}
                onChange={(e) => handleCaloriesChange(e.target.value)}
                aria-invalid={Boolean(caloriesError)}
                className={`w-full h-10 px-3 text-sm text-[#faf7ff] bg-[#110c23] border rounded-md tabular-nums focus:outline-none focus:ring-1 ${
                  caloriesError
                    ? 'border-[#f43f5e] focus:border-[#f43f5e] focus:ring-[#f43f5e]'
                    : 'border-[#3e2f6b] focus:border-[#ff4fa3] focus:ring-[#ff4fa3]'
                }`}
              />
              {caloriesError && (
                <p role="alert" className="text-xs text-[#fda4af] mt-1">
                  {caloriesError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="protein-target"
                className="block text-xs font-medium text-[#d4c8ef] mb-1"
              >
                Daily Protein (g)
              </label>
              <input
                id="protein-target"
                type="number"
                min={30}
                max={500}
                step={5}
                value={proteinInput}
                onChange={(e) => handleProteinChange(e.target.value)}
                aria-invalid={Boolean(proteinError)}
                className={`w-full h-10 px-3 text-sm text-[#faf7ff] bg-[#110c23] border rounded-md tabular-nums focus:outline-none focus:ring-1 ${
                  proteinError
                    ? 'border-[#f43f5e] focus:border-[#f43f5e] focus:ring-[#f43f5e]'
                    : 'border-[#3e2f6b] focus:border-[#22d3ee] focus:ring-[#22d3ee]'
                }`}
              />
              {proteinError && (
                <p role="alert" className="text-xs text-[#fda4af] mt-1">
                  {proteinError}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Training Split & Schedule */}
      <section id="section-training-split" className="p-5 space-y-4">
        <div className="relative h-24 rounded-md overflow-hidden border border-[#3e2f6b] bg-[#110c23]">
          <ResilientImage
            src={VISUAL_ASSETS.strengthTraining}
            alt="Barbell and matte plates on a strength training platform"
            fallbackLabel="Training Split"
            className="w-full h-full object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0b0716]/95 via-[#190c2e]/50 to-[#ff2e93]/15"
          />
          <div className="absolute inset-x-0 bottom-0 px-3 py-2">
            <h2 className="font-display text-base font-bold uppercase tracking-wider text-[#faf7ff]">
              2. Training Split &amp; Schedule
            </h2>
            <p className="text-xs text-[#dfd3f7]">
              Choose a base split, then customize any day&apos;s session below.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="split-preset-select"
            className="block text-xs font-medium text-[#d4c8ef] mb-1"
          >
            Training Split Preset
          </label>
          <select
            id="split-preset-select"
            value={plan.splitPreset}
            onChange={(e) =>
              onSelectSplitPreset(e.target.value as SplitPresetId)
            }
            className="w-full h-10 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3] cursor-pointer"
          >
            {SPLIT_PRESETS.map((preset) => (
              <option
                key={preset.id}
                value={preset.id}
                className="bg-[#150f29] text-[#faf7ff]"
              >
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {/* 7-Day Selector Strip */}
        <div>
          <span className="block text-xs font-medium text-[#d4c8ef] mb-1.5">
            Edit Day ({activeDay.dayName})
          </span>
          <div
            role="tablist"
            aria-label="Select day of week to edit"
            className="grid grid-cols-7 gap-1 p-1 bg-[#110c23] border border-[#35285b] rounded-md"
          >
            {plan.days.map((day) => {
              const selected = day.dayIndex === selectedDayIndex;
              return (
                <button
                  key={day.dayIndex}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onSelectDay(day.dayIndex)}
                  className={`py-1.5 text-xs font-semibold rounded transition-all cursor-pointer whitespace-nowrap ${
                    selected
                      ? 'vice-sunset-btn'
                      : 'text-[#c5b8e3] hover:bg-[#221942] hover:text-[#faf7ff]'
                  }`}
                >
                  {day.shortName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Editor Fields */}
        <div className="space-y-3 pt-1">
          <div>
            <label
              htmlFor="day-workout-title"
              className="block text-xs font-medium text-[#d4c8ef] mb-1"
            >
              {activeDay.dayName} Workout Title
            </label>
            <input
              id="day-workout-title"
              type="text"
              value={activeDay.workoutTitle}
              onChange={(e) => {
                const nextTitle = e.target.value;
                const currentWarmup = (activeDay.warmup ?? '').trim();
                const prevFocus = inferMuscleGroup(
                  activeDay.workoutTitle,
                  activeDay.exercises,
                  activeDay.isRestDay,
                );
                const nextFocus = inferMuscleGroup(
                  nextTitle,
                  activeDay.exercises,
                  activeDay.isRestDay,
                );
                const prevAutoWarmup = recommendWarmupForSession(
                  activeDay.workoutTitle,
                  activeDay.exercises,
                  activeDay.isRestDay,
                );
                const isDefaultOrAutoWarmup =
                  !currentWarmup ||
                  currentWarmup === prevAutoWarmup ||
                  SPLIT_PRESETS.some(
                    (preset) =>
                      preset.days[selectedDayIndex]?.warmup === currentWarmup,
                  );
                const shouldAutoUpdateWarmup =
                  !activeDay.isRestDay &&
                  nextFocus !== prevFocus &&
                  isDefaultOrAutoWarmup;

                onUpdateDay(selectedDayIndex, {
                  workoutTitle: nextTitle,
                  ...(shouldAutoUpdateWarmup
                    ? {
                        warmup: recommendWarmupForSession(
                          nextTitle,
                          activeDay.exercises,
                          activeDay.isRestDay,
                        ),
                      }
                    : {}),
                });
              }}
              className="w-full h-9 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label
                htmlFor="day-duration-mins"
                className="block text-xs font-medium text-[#d4c8ef] mb-1"
              >
                Duration (mins)
              </label>
              <input
                id="day-duration-mins"
                type="number"
                min={0}
                max={300}
                step={5}
                value={activeDay.durationMinutes}
                onChange={(e) => {
                  const mins = Math.max(
                    0,
                    Math.min(300, Math.round(Number(e.target.value) || 0)),
                  );
                  const nextIsRest = mins === 0 ? true : activeDay.isRestDay;
                  onUpdateDay(selectedDayIndex, {
                    durationMinutes: mins,
                    isRestDay: nextIsRest,
                    ...(nextIsRest ? { warmup: '' } : {}),
                  });
                }}
                className="w-full h-9 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md tabular-nums focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
              />
            </div>

            <label className="flex items-center gap-2 h-9 px-2.5 border border-[#35285b] rounded-md bg-[#110c23] text-xs font-medium text-[#d4c8ef] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={activeDay.isRestDay}
                onChange={(e) => {
                  const nextIsRest = e.target.checked;
                  onUpdateDay(selectedDayIndex, {
                    isRestDay: nextIsRest,
                    warmup: nextIsRest
                      ? ''
                      : activeDay.warmup?.trim() ||
                        recommendWarmupForSession(
                          activeDay.workoutTitle,
                          activeDay.exercises,
                          false,
                        ),
                  });
                }}
                className="w-4 h-4 accent-[#ff4fa3] rounded cursor-pointer"
              />
              <span>Recovery / Rest</span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label
                htmlFor="day-warmup"
                className="block text-xs font-medium text-[#d4c8ef]"
              >
                Warm-up Recommendation
              </label>
              {!activeDay.isRestDay && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateDay(selectedDayIndex, {
                      warmup: recommendWarmupForSession(
                        activeDay.workoutTitle,
                        activeDay.exercises,
                        false,
                      ),
                    })
                  }
                  aria-label={`Auto-match warm-up for ${activeDay.dayName}`}
                  className="text-[11px] font-medium text-[#38e8ff] hover:text-[#faf7ff] underline underline-offset-2 cursor-pointer"
                >
                  Auto-match
                </button>
              )}
            </div>
            <textarea
              id="day-warmup"
              rows={2}
              value={activeDay.warmup ?? ''}
              onChange={(e) =>
                onUpdateDay(selectedDayIndex, { warmup: e.target.value })
              }
              placeholder={
                activeDay.isRestDay
                  ? 'No warm-up needed on rest days'
                  : 'e.g., 5 min: Band pull-aparts 2×15, scapular slides 2×10...'
              }
              className="w-full px-3 py-2 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md leading-snug placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3] resize-y"
            />
          </div>

          <div>
            <label
              htmlFor="day-exercises"
              className="block text-xs font-medium text-[#d4c8ef] mb-1"
            >
              Key Exercises &amp; Session Notes
            </label>
            <textarea
              id="day-exercises"
              rows={3}
              value={activeDay.exercises}
              onChange={(e) =>
                onUpdateDay(selectedDayIndex, { exercises: e.target.value })
              }
              className="w-full px-3 py-2 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md leading-snug focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3] resize-y"
            />
          </div>

          {/* Optional Day-Specific Meal Override */}
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-expanded={showDayMealOverrides}
                onClick={() => setShowDayMealOverrides((prev) => !prev)}
                className="text-xs font-medium text-[#38e8ff] hover:text-[#faf7ff] underline underline-offset-4 cursor-pointer"
              >
                {showDayMealOverrides
                  ? `Hide ${activeDay.shortName} meal overrides`
                  : `Override meals for ${activeDay.dayName}${activeDayHasOverrides ? ' (custom)' : ''}`}
              </button>
              {activeDayHasOverrides && (
                <button
                  type="button"
                  onClick={handleClearDayOverrides}
                  className="text-xs text-[#b5a7d6] hover:text-[#faf7ff] cursor-pointer"
                >
                  Use staples
                </button>
              )}
            </div>

            {showDayMealOverrides && (
              <div className="mt-2.5 space-y-2 p-3 bg-[#191233] border border-[#35285b] rounded-md">
                <p className="text-xs text-[#9f8ec7]">
                  Leave blank to inherit your weekly staple meal.
                </p>
                {(
                  [
                    ['breakfast', 'Breakfast'],
                    ['lunch', 'Lunch'],
                    ['dinner', 'Dinner'],
                    ['snack', 'Pre/Post Snack'],
                  ] as const
                ).map(([slot, label]) => (
                  <div key={slot}>
                    <label
                      htmlFor={`override-${slot}`}
                      className="block text-xs font-medium text-[#d4c8ef] mb-0.5"
                    >
                      {activeDay.shortName} {label}
                    </label>
                    <input
                      id={`override-${slot}`}
                      type="text"
                      value={activeDay.mealOverrides?.[slot] ?? ''}
                      onChange={(e) =>
                        handleDayMealOverrideChange(slot, e.target.value)
                      }
                      placeholder={plan.stapleMeals[slot]}
                      className="w-full h-8 px-2.5 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Staple Meal Rotation & Prep Limit */}
      <section id="section-meals-prep" className="p-5 space-y-4">
        <div className="relative h-24 rounded-md overflow-hidden border border-[#3e2f6b] bg-[#110c23]">
          <ResilientImage
            src={VISUAL_ASSETS.mealPrep}
            alt="Glass meal prep containers with chicken, rice, broccoli, tofu stir-fry, and yogurt oat bowls"
            fallbackLabel="Meal Prep"
            className="w-full h-full object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0b0716]/95 via-[#190c2e]/50 to-[#22d3ee]/15"
          />
          <div className="absolute inset-x-0 bottom-0 px-3 py-2 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold uppercase tracking-wider text-[#faf7ff]">
                3. Staple Meals &amp; Prep Limit
              </h2>
              <p className="text-xs text-[#dfd3f7] truncate">
                Define repeatable meals and weekly prep window.
              </p>
            </div>
            <button
              type="button"
              onClick={onQuickFillGymStaples}
              className="px-2.5 py-1 text-xs font-bold rounded vice-sunset-btn transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              Quick-Fill Staples
            </button>
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-[#d4c8ef] mb-1.5">
            Weekly Prep Time Limit
          </span>
          <div
            role="group"
            aria-label="Prep time limit"
            className="grid grid-cols-3 gap-1 p-1 bg-[#110c23] border border-[#35285b] rounded-md"
          >
            {PREP_TIME_LIMITS.map((limit) => {
              const active = plan.prepTimeLimit === limit;
              return (
                <button
                  key={limit}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onUpdatePrepTimeLimit(limit)}
                  className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#2c2052] text-[#38e8ff] border border-[#38e8ff]/50'
                      : 'text-[#c5b8e3] border border-transparent hover:bg-[#21183e] hover:text-[#faf7ff]'
                  }`}
                >
                  {limit}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5">
          {(
            [
              ['breakfast', 'Breakfast'],
              ['lunch', 'Lunch'],
              ['dinner', 'Dinner'],
              ['snack', 'Pre / Post-Workout Snack'],
            ] as const
          ).map(([slot, label]) => (
            <div key={slot}>
              <label
                htmlFor={`staple-${slot}`}
                className="block text-xs font-medium text-[#d4c8ef] mb-1"
              >
                {label}
              </label>
              <input
                id={`staple-${slot}`}
                type="text"
                value={plan.stapleMeals[slot]}
                onChange={(e) => onUpdateStapleMeal(slot, e.target.value)}
                className="w-full h-9 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onAutoGenerateChecklist}
          className="w-full py-2 px-3 text-xs font-semibold text-[#e6ddf8] bg-[#21183e] border border-[#4a397a] rounded-md hover:bg-[#2c2052] hover:border-[#38e8ff] transition-colors cursor-pointer"
        >
          Sync Prep &amp; Grocery Checklist from Meals
        </button>
      </section>

      {/* Section 4: Saved Plans & Reset */}
      <section id="section-saved-plans" className="p-5 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-[#faf7ff]">
            4. Saved Plans &amp; Reset
          </h2>
          <p className="text-xs text-[#b5a7d6] mt-0.5">
            Store reusable templates locally for future weeks.
          </p>
        </div>

        <form onSubmit={handleSavePresetSubmit} className="space-y-1.5">
          <label htmlFor="save-preset-name" className="sr-only">
            Plan preset name
          </label>
          <div className="flex gap-2">
            <input
              id="save-preset-name"
              type="text"
              value={presetName}
              onChange={(e) => {
                setPresetName(e.target.value);
                if (presetError) setPresetError(null);
              }}
              placeholder="e.g., Lean Bulk PPL, Summer Cut"
              className="flex-1 min-w-0 h-9 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-bold rounded-md vice-sunset-btn transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookmarkIcon className="w-3.5 h-3.5" />
              <span>Save Plan</span>
            </button>
          </div>
          {presetError && (
            <p role="alert" className="text-xs text-[#fda4af]">
              {presetError}
            </p>
          )}
        </form>

        {savedPresets.length > 0 ? (
          <ul className="divide-y divide-[#2d2150] border border-[#35285b] rounded-md bg-[#110c23]">
            {savedPresets.map((preset) => (
              <li
                key={preset.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#faf7ff] truncate">
                    {preset.name}
                  </div>
                  <div className="text-[#9f8ec7] tabular-nums truncate">
                    {preset.plan.caloriesTarget} kcal · {preset.plan.proteinTarget}g P ·{' '}
                    {preset.plan.holidayTag}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onLoadPreset(preset)}
                    aria-label={`Load saved plan ${preset.name}`}
                    className="px-2.5 py-1 text-xs font-medium text-[#e6ddf8] bg-[#21183e] border border-[#3e2f6b] rounded hover:bg-[#2c2052] hover:border-[#38e8ff] transition-colors cursor-pointer"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePreset(preset.id)}
                    aria-label={`Delete saved plan ${preset.name}`}
                    className="p-1.5 text-[#9f8ec7] hover:text-[#fda4af] hover:bg-[#3b1224] rounded transition-colors cursor-pointer"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[#9f8ec7] py-1">
            No saved plans yet. Save your current setup above to reuse it any
            week.
          </p>
        )}

        <div className="pt-2 border-t border-[#2d2150]">
          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-[#d4c8ef] bg-[#191233] border border-[#35285b] rounded-md hover:bg-[#241a46] hover:text-[#faf7ff] transition-colors cursor-pointer"
            >
              <RotateCcwIcon className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 p-2.5 bg-[#191233] border border-[#4a397a] rounded-md">
              <span className="text-xs font-medium text-[#faf7ff]">
                Restore default plan?
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="px-2.5 py-1 text-xs font-medium text-[#d4c8ef] bg-[#110c23] border border-[#3e2f6b] rounded hover:bg-[#21183e] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetDefaults();
                    setConfirmingReset(false);
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded vice-sunset-btn cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
