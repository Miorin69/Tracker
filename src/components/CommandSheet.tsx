import { useState } from 'react';
import { SPLIT_PRESETS } from '../data/presets';
import type {
  ChecklistCategory,
  DayIndex,
  MealSlot,
  WeeklyPlan,
} from '../types/plan';
import {
  addDaysToIsoDate,
  computeWeeklyTrainingSummary,
  formatShortDate,
  formatWeekRange,
  getEffectiveDayMeals,
} from '../utils/planLogic';
import { parseExercisesFromText } from '../utils/coachLogic';
import type { CoachSelection, MealSlotKey } from '../utils/coachLogic';
import { getDayProgress } from '../utils/macroProgressLogic';
import { VISUAL_ASSETS } from '../data/visualAssets';
import { DailyMacroProgress } from './DailyMacroProgress';
import {
  ArrowRightLeftIcon,
  CheckSquareIcon,
  PlusIcon,
  SortAscIcon,
  TrashIcon,
} from './Icons';
import { ResilientImage } from './ResilientImage';
import { WeeklyCalorieTrendChart } from './WeeklyCalorieTrendChart';

interface CommandSheetProps {
  plan: WeeklyPlan;
  selectedDayIndex: DayIndex;
  highlightedDayIndices?: DayIndex[];
  activeCoachSelection: CoachSelection | null;
  isPrintPreview?: boolean;
  onSelectDay: (dayIndex: DayIndex) => void;
  onInspectWithCoach: (selection: CoachSelection) => void;
  onToggleMealCompleted: (dayIndex: DayIndex, slot: MealSlot) => void;
  onToggleWorkoutCompleted: (dayIndex: DayIndex) => void;
  onUpdateExtraIntake: (
    dayIndex: DayIndex,
    extraCalories: number,
    extraProtein: number,
  ) => void;
  onResetDayProgress: (dayIndex: DayIndex) => void;
  onLoadSampleWeek: () => void;
  onClearWeekProgress: () => void;
  onToggleChecklistItem: (id: string) => void;
  onAddChecklistItem: (category: ChecklistCategory, text: string) => void;
  onRemoveChecklistItem: (id: string) => void;
  onDeleteChecklistItems: (ids: string[]) => void;
  onMoveChecklistItems: (ids: string[], targetCategory: ChecklistCategory) => void;
  onAutoGenerateChecklist: () => void;
  onSortChecklist: () => void;
}

export function CommandSheet({
  plan,
  selectedDayIndex,
  highlightedDayIndices = [],
  activeCoachSelection,
  isPrintPreview = false,
  onSelectDay,
  onInspectWithCoach,
  onToggleMealCompleted,
  onToggleWorkoutCompleted,
  onUpdateExtraIntake,
  onResetDayProgress,
  onLoadSampleWeek,
  onClearWeekProgress,
  onToggleChecklistItem,
  onAddChecklistItem,
  onRemoveChecklistItem,
  onDeleteChecklistItems,
  onMoveChecklistItems,
  onAutoGenerateChecklist,
  onSortChecklist,
}: CommandSheetProps) {
  const [newPrepText, setNewPrepText] = useState('');
  const [newGroceryText, setNewGroceryText] = useState('');
  const [prepInputError, setPrepInputError] = useState<string | null>(null);
  const [groceryInputError, setGroceryInputError] = useState<string | null>(
    null,
  );
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState<string[]>(
    [],
  );

  const weekRange = formatWeekRange(plan.weekStartDate);
  const summary = computeWeeklyTrainingSummary(plan.days);
  const splitLabel =
    plan.customSplitLabel?.trim() ||
    SPLIT_PRESETS.find((s) => s.id === plan.splitPreset)?.label ||
    plan.splitPreset;

  const prepItems = plan.checklist.filter((item) => item.category === 'prep');
  const groceryItems = plan.checklist.filter(
    (item) => item.category === 'grocery',
  );
  const prepDoneCount = prepItems.filter((item) => item.checked).length;
  const groceryDoneCount = groceryItems.filter((item) => item.checked).length;

  const validIdSet = new Set(plan.checklist.map((item) => item.id));
  const activeSelectedIds = selectedChecklistIds.filter((id) =>
    validIdSet.has(id),
  );
  const activeSelectedSet = new Set(activeSelectedIds);
  const selectedCount = activeSelectedIds.length;
  const selectedPrepCount = prepItems.filter((item) =>
    activeSelectedSet.has(item.id),
  ).length;
  const selectedGroceryCount = groceryItems.filter((item) =>
    activeSelectedSet.has(item.id),
  ).length;
  const allPrepSelected =
    prepItems.length > 0 && selectedPrepCount === prepItems.length;
  const allGrocerySelected =
    groceryItems.length > 0 && selectedGroceryCount === groceryItems.length;
  const allChecklistSelected =
    plan.checklist.length > 0 && selectedCount === plan.checklist.length;
  const batchModeActive = isBatchMode && !isPrintPreview;

  const toggleBatchMode = () => {
    setIsBatchMode((prev) => {
      if (prev) {
        setSelectedChecklistIds([]);
      }
      return !prev;
    });
  };

  const toggleSelectItem = (id: string) => {
    setSelectedChecklistIds((prev) => {
      const cleaned = prev.filter((itemId) => validIdSet.has(itemId));
      return cleaned.includes(id)
        ? cleaned.filter((itemId) => itemId !== id)
        : [...cleaned, id];
    });
  };

  const toggleSelectCategory = (category: ChecklistCategory) => {
    const categoryIds = (category === 'prep' ? prepItems : groceryItems).map(
      (item) => item.id,
    );
    if (categoryIds.length === 0) return;
    const allSelected = categoryIds.every((id) => activeSelectedSet.has(id));
    setSelectedChecklistIds((prev) => {
      const next = new Set(prev.filter((id) => validIdSet.has(id)));
      if (allSelected) {
        for (const id of categoryIds) next.delete(id);
      } else {
        for (const id of categoryIds) next.add(id);
      }
      return Array.from(next);
    });
  };

  const handleToggleSelectAll = () => {
    if (allChecklistSelected) {
      setSelectedChecklistIds([]);
    } else {
      setSelectedChecklistIds(plan.checklist.map((item) => item.id));
    }
  };

  const handleBatchDelete = () => {
    if (activeSelectedIds.length === 0) return;
    const remainingCount = plan.checklist.length - activeSelectedIds.length;
    onDeleteChecklistItems(activeSelectedIds);
    setSelectedChecklistIds([]);
    if (remainingCount <= 0) {
      setIsBatchMode(false);
    }
  };

  const handleBatchMove = (targetCategory: ChecklistCategory) => {
    if (activeSelectedIds.length === 0) return;
    onMoveChecklistItems(activeSelectedIds, targetCategory);
    setSelectedChecklistIds([]);
  };

  const trimmedHoliday = plan.holidayTag.trim() || 'Normal Week';
  const isSpecialEvent = trimmedHoliday.toLowerCase() !== 'normal week';

  const handleAddPrep = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newPrepText.trim();
    if (!text) {
      setPrepInputError('Enter a prep step to add.');
      return;
    }
    setPrepInputError(null);
    onAddChecklistItem('prep', text);
    setNewPrepText('');
  };

  const handleAddGrocery = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newGroceryText.trim();
    if (!text) {
      setGroceryInputError('Enter a grocery item to add.');
      return;
    }
    setGroceryInputError(null);
    onAddChecklistItem('grocery', text);
    setNewGroceryText('');
  };

  return (
    <article
      id={isPrintPreview ? undefined : 'weekly-command-sheet'}
      aria-label={
        isPrintPreview
          ? 'Weekly Command Sheet Print Preview'
          : 'Weekly Command Sheet Preview'
      }
      className="print-sheet-article bg-[#150f29]/95 border border-[#35285b] rounded-lg p-5 sm:p-8"
    >
      {/* 1. Header Banner */}
      <header className="print-header bg-[#1c1438] border border-[#3e2f6b] rounded-md p-4 sm:p-5 mb-6">
        <div className="print-header-row flex flex-col xl:flex-row print:flex-row xl:items-center print:items-center xl:justify-between print:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#f7f7f7] border border-[#ffd166]/60 shrink-0">
              <ResilientImage
                src={VISUAL_ASSETS.appLogoMascot}
                alt="Prep Split Fit Duck emblem"
                fallbackLabel="PS"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide vice-gradient-text whitespace-nowrap">
                  Weekly Command Sheet
                </h1>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    isSpecialEvent ? 'text-[#ffd166]' : 'text-[#b7a8d9]'
                  }`}
                >
                  {trimmedHoliday}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-[#c5b8e3] tabular-nums">
                <span className="font-medium text-[#faf7ff]">{weekRange}</span>
                <span aria-hidden="true" className="text-[#5b478a]">
                  ·
                </span>
                <span>{splitLabel}</span>
              </div>
              {plan.holidayNotes?.trim() && (
                <p className="text-xs text-[#ffd166] leading-snug">
                  {plan.holidayNotes.trim()}
                </p>
              )}
            </div>
          </div>

          <dl className="print-metrics-grid grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-x-4 gap-y-2 xl:border-l print:border-l xl:border-[#35285b] print:border-slate-200 xl:pl-4 print:pl-4 shrink-0">
            <div>
              <dt className="text-[11px] text-[#9f8ec7] whitespace-nowrap">
                Daily Calories
              </dt>
              <dd className="text-sm font-bold text-[#ff6ea8] tabular-nums font-mono whitespace-nowrap">
                {plan.caloriesTarget.toLocaleString('en-US')} kcal
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#9f8ec7] whitespace-nowrap">
                Daily Protein
              </dt>
              <dd className="text-sm font-bold text-[#38e8ff] tabular-nums font-mono whitespace-nowrap">
                {plan.proteinTarget} g
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#9f8ec7] whitespace-nowrap">
                Prep Budget
              </dt>
              <dd className="text-sm font-bold text-[#ffd166] tabular-nums font-mono whitespace-nowrap">
                {plan.prepTimeLimit}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#9f8ec7] whitespace-nowrap">
                Training Load
              </dt>
              <dd className="text-sm font-bold text-[#faf7ff] tabular-nums font-mono whitespace-nowrap">
                {summary.trainingDays}d · {summary.totalMinutes}m
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {/* 2. Weekly Caloric Intake vs. Target Line Graph */}
      <WeeklyCalorieTrendChart
        plan={plan}
        selectedDayIndex={selectedDayIndex}
        onSelectDay={onSelectDay}
        onLoadSampleWeek={onLoadSampleWeek}
        onClearWeekProgress={onClearWeekProgress}
      />

      {/* 3. Daily Calorie & Protein Progress Tracker */}
      <DailyMacroProgress
        plan={plan}
        selectedDayIndex={selectedDayIndex}
        onSelectDay={onSelectDay}
        onToggleMealCompleted={onToggleMealCompleted}
        onToggleWorkoutCompleted={onToggleWorkoutCompleted}
        onUpdateExtraIntake={onUpdateExtraIntake}
        onResetDayProgress={onResetDayProgress}
      />

      {/* 3. 7-Day Training & Meal Grid */}
      <section aria-label="7-Day Training and Meal Grid">
        <div className="flex items-baseline justify-between mb-2.5 gap-2 flex-wrap">
          <h2 className="font-display text-lg font-bold tracking-wide text-[#faf7ff]">
            7-Day Training &amp; Meal Schedule
          </h2>
          <span className="no-print text-xs text-[#9f8ec7]">
            Click any exercise or meal for Coach Hishay&apos;s breakdown
          </span>
        </div>

        <div className="border border-[#35285b] rounded-md overflow-hidden">
          {/* Column Header Row (visible on md+ and print) */}
          <div className="print-grid-header hidden md:grid print:grid md:grid-cols-[88px_minmax(0,1fr)_minmax(0,1.2fr)] print:grid-cols-[72px_minmax(0,1fr)_minmax(0,1.25fr)] bg-[#1e163b] border-b border-[#35285b] text-xs font-semibold text-[#c5b8e3]">
            <div className="px-3 py-2">Day</div>
            <div className="px-3 py-2 border-l border-[#35285b]">
              Training Focus &amp; Key Lifts
            </div>
            <div className="px-3 py-2 border-l border-[#35285b]">
              Daily Meal Plan
            </div>
          </div>

          <div className="divide-y divide-[#2d2150]">
            {plan.days.map((day) => {
              const dateIso = addDaysToIsoDate(plan.weekStartDate, day.dayIndex);
              const dateLabel = formatShortDate(dateIso);
              const meals = getEffectiveDayMeals(plan, day);
              const isSelected = day.dayIndex === selectedDayIndex;
              const durationLabel =
                day.durationMinutes > 0
                  ? `${day.durationMinutes} min`
                  : 'Rest';
              const hasCustomMeals = Boolean(
                day.mealOverrides &&
                  Object.values(day.mealOverrides).some(
                    (v) => v && v.trim().length > 0,
                  ),
              );

              const isHighlighted = highlightedDayIndices.includes(day.dayIndex);
              const dayLoggedProgress = getDayProgress(plan, day.dayIndex);
              const mealsLoggedCount = dayLoggedProgress.completedMeals.length;

              return (
                <div
                  key={day.dayIndex}
                  className={`print-day-row grid grid-cols-1 md:grid-cols-[88px_minmax(0,1fr)_minmax(0,1.2fr)] print:grid-cols-[72px_minmax(0,1fr)_minmax(0,1.25fr)] transition-colors duration-300 ${
                    isHighlighted
                      ? 'bg-[#122e30]/90 print:bg-white'
                      : isSelected
                        ? 'bg-[#211842]/95 print:bg-white'
                        : day.isRestDay
                          ? 'bg-[#120d26]/90 print:bg-white'
                          : 'bg-[#16102c]'
                  }`}
                >
                  {/* Day Column */}
                  <div className="print-day-cell px-3 py-2.5 flex items-center justify-between md:flex-col md:items-start md:justify-start gap-1 border-b md:border-b-0 border-[#2d2150]">
                    <button
                      type="button"
                      onClick={() => onSelectDay(day.dayIndex)}
                      aria-label={`Edit ${day.dayName} schedule`}
                      className="text-left group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22d3ee] rounded"
                    >
                      <div
                        className={`text-sm font-bold group-hover:underline underline-offset-2 ${
                          isSelected ? 'text-[#ffd166]' : 'text-[#faf7ff]'
                        }`}
                      >
                        {day.shortName}
                      </div>
                      <div className="text-xs text-[#9f8ec7] tabular-nums">
                        {dateLabel}
                      </div>
                      {isHighlighted && (
                        <div className="no-print text-[10.5px] font-semibold text-[#34d399] mt-0.5 whitespace-nowrap">
                          Updated
                        </div>
                      )}
                      {mealsLoggedCount > 0 && (
                        <div className="text-[10.5px] font-mono font-semibold text-[#34d399] mt-0.5 whitespace-nowrap">
                          {mealsLoggedCount}/4 meals
                          {mealsLoggedCount === 4 ? ' ✓' : ''}
                        </div>
                      )}
                      {dayLoggedProgress.workoutCompleted && (
                        <div className="text-[10.5px] font-mono font-semibold text-[#ffd166] mt-0.5 whitespace-nowrap">
                          Lift ✓
                        </div>
                      )}
                      {hasCustomMeals && (
                        <div className="text-[10.5px] font-medium text-[#ff8c52] mt-0.5 whitespace-nowrap">
                          Custom menu
                        </div>
                      )}
                    </button>
                    <span className="print-duration-mobile md:hidden print:hidden text-xs font-mono tabular-nums text-[#b7a8d9]">
                      {durationLabel}
                    </span>
                  </div>

                  {/* Training Column */}
                  <div className="print-training-cell px-3 py-2.5 md:border-l print:border-l border-[#2d2150]">
                    <div className="flex items-baseline justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectDay(day.dayIndex)}
                        className="text-left text-xs sm:text-sm font-semibold text-[#faf7ff] hover:text-[#ffd166] hover:underline underline-offset-2 cursor-pointer"
                      >
                        {day.workoutTitle}
                      </button>
                      <span className="print-duration-desktop hidden md:inline print:inline text-xs font-mono tabular-nums text-[#ffb36b] whitespace-nowrap shrink-0">
                        {durationLabel}
                      </span>
                    </div>
                    {day.warmup?.trim() && (
                      <p className="text-[11px] text-[#9f8ec7] mt-1 leading-snug">
                        <span className="font-semibold text-[#c5b8e3]">
                          Warm-up:
                        </span>{' '}
                        {day.warmup.trim()}
                      </p>
                    )}
                    {(() => {
                      const exercises = parseExercisesFromText(day.exercises);
                      if (exercises.length === 0) {
                        return (
                          <p className="text-xs text-[#b7a8d9] mt-1 leading-relaxed">
                            Recovery &amp; hydration
                          </p>
                        );
                      }
                      return (
                        <div className="text-xs text-[#c5b8e3] mt-1 leading-relaxed">
                          {exercises.map((exercise, exIdx) => {
                            const isInspected =
                              activeCoachSelection?.kind === 'exercise' &&
                              activeCoachSelection.dayIndex === day.dayIndex &&
                              activeCoachSelection.title === exercise;
                            return (
                              <span key={`${exercise}-${exIdx}`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onInspectWithCoach({
                                      kind: 'exercise',
                                      dayIndex: day.dayIndex,
                                      dayName: day.dayName,
                                      title: exercise,
                                      workoutContext: day.workoutTitle,
                                    })
                                  }
                                  aria-label={`Ask Coach Hishay about ${exercise} on ${day.dayName}`}
                                  className={`text-left inline hover:text-[#22d3ee] hover:underline underline-offset-2 decoration-[#22d3ee]/60 cursor-pointer rounded-sm transition-colors ${
                                    isInspected
                                      ? 'text-[#22d3ee] font-semibold underline decoration-[#22d3ee] print:font-normal print:no-underline'
                                      : ''
                                  }`}
                                >
                                  {exercise}
                                </button>
                                {exIdx < exercises.length - 1 ? ', ' : ''}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Meals Column */}
                  <div className="print-meals-cell px-3 py-2.5 border-t md:border-t-0 md:border-l print:border-t-0 print:border-l border-[#2d2150] text-xs text-[#d6cbef] space-y-1">
                    {(
                      [
                        ['breakfast', 'B', meals.breakfast],
                        ['lunch', 'L', meals.lunch],
                        ['dinner', 'D', meals.dinner],
                        ['snack', 'S', meals.snack],
                      ] as ReadonlyArray<[MealSlotKey, string, string]>
                    ).map(([slot, shortLabel, text]) => {
                      const isInspected =
                        activeCoachSelection?.kind === 'meal' &&
                        activeCoachSelection.dayIndex === day.dayIndex &&
                        activeCoachSelection.mealSlot === slot;
                      return (
                        <div key={slot} className="leading-snug">
                          <button
                            type="button"
                            onClick={() =>
                              onInspectWithCoach({
                                kind: 'meal',
                                dayIndex: day.dayIndex,
                                dayName: day.dayName,
                                mealSlot: slot,
                                title: text,
                                workoutContext: day.workoutTitle,
                              })
                            }
                            aria-label={`Ask Coach Hishay about ${day.dayName} ${slot}: ${text}`}
                            className={`w-full text-left rounded-sm px-1 -mx-1 py-0.5 -my-0.5 hover:bg-[#2a1f4d] hover:text-white transition-colors cursor-pointer print:p-0 print:m-0 ${
                              isInspected
                                ? 'bg-[#2a1f4d] text-[#22d3ee] font-medium print:bg-transparent print:font-normal'
                                : ''
                            }`}
                          >
                            <span className="font-semibold text-[#ff6ea8] mr-1.5">
                              {shortLabel}:
                            </span>
                            <span>{text}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Interactive Prep & Grocery Checklist */}
      <section
        id={isPrintPreview ? undefined : 'section-checklist'}
        aria-label="Prep and Grocery Checklist"
        className="print-section-gap mt-6 pt-6 border-t border-[#2d2150]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg font-bold tracking-wide text-[#faf7ff]">
            Prep &amp; Grocery Checklist
          </h2>
          <div className="no-print flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={toggleBatchMode}
              disabled={!batchModeActive && plan.checklist.length === 0}
              aria-pressed={batchModeActive}
              data-testid="toggle-batch-select-btn"
              className={`inline-flex items-center gap-1.5 px-2.5 h-7 text-xs font-semibold rounded-md border transition-colors cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                batchModeActive
                  ? 'text-[#faf7ff] bg-[#361b52] border-[#ff4fa3] hover:bg-[#462169]'
                  : 'text-[#ede7fc] bg-[#241945] border-[#3e2f6b] hover:bg-[#31235c] hover:border-[#ff4fa3]/70 hover:text-[#ff94c8]'
              }`}
            >
              <CheckSquareIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{batchModeActive ? 'Done Selecting' : 'Batch Select'}</span>
            </button>
            <button
              type="button"
              onClick={onSortChecklist}
              disabled={plan.checklist.length < 2}
              data-testid="sort-checklist-btn"
              aria-label="Group checklist by category and sort alphabetically A to Z"
              className="inline-flex items-center gap-1.5 px-2.5 h-7 text-xs font-semibold text-[#ede7fc] bg-[#241945] border border-[#3e2f6b] rounded-md hover:bg-[#31235c] hover:border-[#38e8ff]/60 hover:text-[#38e8ff] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <SortAscIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Group &amp; Sort A–Z</span>
            </button>
            <button
              type="button"
              onClick={onAutoGenerateChecklist}
              className="text-xs font-medium text-[#22d3ee] hover:text-[#67e8f9] underline underline-offset-4 cursor-pointer whitespace-nowrap"
            >
              Rebuild from current meals
            </button>
          </div>
        </div>

        {/* Batch Action Toolbar */}
        {batchModeActive && (
          <div
            role="region"
            aria-label="Checklist batch actions"
            data-testid="checklist-batch-bar"
            className="no-print mb-4 px-3 py-2.5 rounded-md bg-[#1d143b] border border-[#ff4fa3]/55 flex flex-wrap items-center justify-between gap-2.5"
          >
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span
                data-testid="batch-selected-count"
                className="font-mono font-semibold text-[#ffd166] tabular-nums"
              >
                {selectedCount} selected
              </span>
              <span aria-hidden="true" className="text-[#5b478a]">
                ·
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                disabled={plan.checklist.length === 0}
                className="font-medium text-[#38e8ff] hover:text-[#7ff2ff] underline underline-offset-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {allChecklistSelected ? 'Clear all' : 'Select all'}
              </button>
              {selectedCount > 0 && !allChecklistSelected && (
                <button
                  type="button"
                  onClick={() => setSelectedChecklistIds([])}
                  className="font-medium text-[#b7a8d9] hover:text-[#faf7ff] underline underline-offset-2 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleBatchMove('prep')}
                disabled={selectedGroceryCount === 0}
                data-testid="batch-move-prep-btn"
                title={
                  selectedGroceryCount === 0
                    ? 'Select at least one Grocery item to move to Meal Prep Steps'
                    : `Move ${selectedGroceryCount} selected grocery item(s) to Meal Prep Steps`
                }
                className="inline-flex items-center gap-1.5 px-2.5 h-7 text-xs font-semibold text-[#ede7fc] bg-[#241945] border border-[#3e2f6b] rounded-md hover:bg-[#31235c] hover:border-[#ff4fa3]/70 hover:text-[#ff94c8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
              >
                <ArrowRightLeftIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Move to Prep</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchMove('grocery')}
                disabled={selectedPrepCount === 0}
                data-testid="batch-move-grocery-btn"
                title={
                  selectedPrepCount === 0
                    ? 'Select at least one Meal Prep step to move to Grocery List'
                    : `Move ${selectedPrepCount} selected prep step(s) to Grocery List`
                }
                className="inline-flex items-center gap-1.5 px-2.5 h-7 text-xs font-semibold text-[#ede7fc] bg-[#241945] border border-[#3e2f6b] rounded-md hover:bg-[#31235c] hover:border-[#38e8ff]/70 hover:text-[#38e8ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
              >
                <ArrowRightLeftIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Move to Grocery</span>
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={selectedCount === 0}
                data-testid="batch-delete-btn"
                className="inline-flex items-center gap-1.5 px-2.5 h-7 text-xs font-semibold text-[#ffe4e8] bg-[#4a1428] border border-[#fb7185]/60 rounded-md hover:bg-[#611a34] hover:border-[#fb7185] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
              >
                <TrashIcon className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Delete{selectedCount > 0 ? ` (${selectedCount})` : ''}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="print-checklist-grid grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Meal Prep Steps */}
          <div data-testid="prep-checklist-column">
            <div className="flex items-baseline justify-between gap-2 pb-2 mb-3 border-b border-[#2d2150]">
              <h3 className="text-xs font-semibold text-[#faf7ff]">
                Meal Prep Steps
              </h3>
              <div className="flex items-center gap-2.5">
                {batchModeActive && prepItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleSelectCategory('prep')}
                    data-testid="select-all-prep-btn"
                    className="no-print text-[11px] font-medium text-[#ff94c8] hover:text-[#ffc2df] underline underline-offset-2 cursor-pointer"
                  >
                    {allPrepSelected ? 'Deselect prep' : 'Select all prep'}
                  </button>
                )}
                <span className="text-xs text-[#9f8ec7] tabular-nums font-mono">
                  {prepDoneCount}/{prepItems.length} done
                </span>
              </div>
            </div>

            {prepItems.length === 0 ? (
              <p className="text-xs text-[#9f8ec7] py-2">
                No meal prep steps yet. Add one below or rebuild from meals.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {prepItems.map((item) => {
                  const isSelected = activeSelectedSet.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={`flex items-start justify-between gap-2 group rounded-md transition-colors ${
                        batchModeActive
                          ? isSelected
                            ? 'bg-[#2a1a4e] border border-[#ff4fa3]/65 px-2 py-1.5'
                            : 'bg-[#191233]/60 border border-[#2d2150] hover:border-[#4e3b82] px-2 py-1.5'
                          : 'py-0.5'
                      }`}
                    >
                      <label className="flex items-start gap-2.5 text-xs text-[#e6ddf8] leading-snug cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={batchModeActive ? isSelected : item.checked}
                          aria-label={
                            batchModeActive
                              ? `Select prep step: ${item.text}`
                              : undefined
                          }
                          onChange={() =>
                            batchModeActive
                              ? toggleSelectItem(item.id)
                              : onToggleChecklistItem(item.id)
                          }
                          className={`print-checkbox mt-0.5 w-4 h-4 rounded shrink-0 cursor-pointer ${
                            batchModeActive
                              ? 'accent-[#ffd166]'
                              : 'accent-[#ff4fa3]'
                          }`}
                        />
                        <span
                          className={
                            !batchModeActive && item.checked
                              ? 'line-through text-[#78689e]'
                              : 'text-[#e6ddf8]'
                          }
                        >
                          {item.text}
                          {batchModeActive && item.checked && (
                            <span className="ml-1.5 text-[10px] font-mono text-[#34d399]">
                              (done)
                            </span>
                          )}
                        </span>
                      </label>
                      {!batchModeActive && (
                        <button
                          type="button"
                          onClick={() => onRemoveChecklistItem(item.id)}
                          aria-label={`Remove prep step: ${item.text}`}
                          className="no-print p-1 text-[#78689e] hover:text-[#fb7185] rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0 cursor-pointer"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              onSubmit={handleAddPrep}
              className="no-print mt-3 pt-2.5 border-t border-[#2d2150] space-y-1"
            >
              <label
                htmlFor={isPrintPreview ? undefined : 'add-prep-item'}
                className="sr-only"
              >
                Add meal prep step
              </label>
              <div className="flex gap-1.5">
                <input
                  id={isPrintPreview ? undefined : 'add-prep-item'}
                  type="text"
                  value={newPrepText}
                  onChange={(e) => {
                    setNewPrepText(e.target.value);
                    if (prepInputError) setPrepInputError(null);
                  }}
                  placeholder="Add prep step..."
                  className="flex-1 min-w-0 h-8 px-2.5 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3]"
                />
                <button
                  type="submit"
                  aria-label="Add meal prep step"
                  className="inline-flex items-center gap-1 px-2.5 h-8 text-xs font-medium text-[#ede7fc] bg-[#241945] border border-[#3e2f6b] rounded-md hover:bg-[#31235c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
              {prepInputError && (
                <p role="alert" className="text-xs text-[#fda4af]">
                  {prepInputError}
                </p>
              )}
            </form>
          </div>

          {/* Grocery List */}
          <div data-testid="grocery-checklist-column">
            <div className="flex items-baseline justify-between gap-2 pb-2 mb-3 border-b border-[#2d2150]">
              <h3 className="text-xs font-semibold text-[#faf7ff]">
                Grocery List
              </h3>
              <div className="flex items-center gap-2.5">
                {batchModeActive && groceryItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleSelectCategory('grocery')}
                    data-testid="select-all-grocery-btn"
                    className="no-print text-[11px] font-medium text-[#38e8ff] hover:text-[#8ff3ff] underline underline-offset-2 cursor-pointer"
                  >
                    {allGrocerySelected
                      ? 'Deselect groceries'
                      : 'Select all groceries'}
                  </button>
                )}
                <span className="text-xs text-[#9f8ec7] tabular-nums font-mono">
                  {groceryDoneCount}/{groceryItems.length} done
                </span>
              </div>
            </div>

            {groceryItems.length === 0 ? (
              <p className="text-xs text-[#9f8ec7] py-2">
                No grocery items yet. Add one below or rebuild from meals.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {groceryItems.map((item) => {
                  const isSelected = activeSelectedSet.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={`flex items-start justify-between gap-2 group rounded-md transition-colors ${
                        batchModeActive
                          ? isSelected
                            ? 'bg-[#17284a] border border-[#38e8ff]/65 px-2 py-1.5'
                            : 'bg-[#191233]/60 border border-[#2d2150] hover:border-[#4e3b82] px-2 py-1.5'
                          : 'py-0.5'
                      }`}
                    >
                      <label className="flex items-start gap-2.5 text-xs text-[#e6ddf8] leading-snug cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={batchModeActive ? isSelected : item.checked}
                          aria-label={
                            batchModeActive
                              ? `Select grocery item: ${item.text}`
                              : undefined
                          }
                          onChange={() =>
                            batchModeActive
                              ? toggleSelectItem(item.id)
                              : onToggleChecklistItem(item.id)
                          }
                          className={`print-checkbox mt-0.5 w-4 h-4 rounded shrink-0 cursor-pointer ${
                            batchModeActive
                              ? 'accent-[#ffd166]'
                              : 'accent-[#22d3ee]'
                          }`}
                        />
                        <span
                          className={
                            !batchModeActive && item.checked
                              ? 'line-through text-[#78689e]'
                              : 'text-[#e6ddf8]'
                          }
                        >
                          {item.text}
                          {batchModeActive && item.checked && (
                            <span className="ml-1.5 text-[10px] font-mono text-[#34d399]">
                              (done)
                            </span>
                          )}
                        </span>
                      </label>
                      {!batchModeActive && (
                        <button
                          type="button"
                          onClick={() => onRemoveChecklistItem(item.id)}
                          aria-label={`Remove grocery item: ${item.text}`}
                          className="no-print p-1 text-[#78689e] hover:text-[#fb7185] rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0 cursor-pointer"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              onSubmit={handleAddGrocery}
              className="no-print mt-3 pt-2.5 border-t border-[#2d2150] space-y-1"
            >
              <label
                htmlFor={isPrintPreview ? undefined : 'add-grocery-item'}
                className="sr-only"
              >
                Add grocery item
              </label>
              <div className="flex gap-1.5">
                <input
                  id={isPrintPreview ? undefined : 'add-grocery-item'}
                  type="text"
                  value={newGroceryText}
                  onChange={(e) => {
                    setNewGroceryText(e.target.value);
                    if (groceryInputError) setGroceryInputError(null);
                  }}
                  placeholder="Add grocery item..."
                  className="flex-1 min-w-0 h-8 px-2.5 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md placeholder:text-[#78689e] focus:outline-none focus:border-[#22d3ee]"
                />
                <button
                  type="submit"
                  aria-label="Add grocery item"
                  className="inline-flex items-center gap-1 px-2.5 h-8 text-xs font-medium text-[#ede7fc] bg-[#241945] border border-[#3e2f6b] rounded-md hover:bg-[#31235c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
              {groceryInputError && (
                <p role="alert" className="text-xs text-[#fda4af]">
                  {groceryInputError}
                </p>
              )}
            </form>
          </div>
        </div>
      </section>
    </article>
  );
}
