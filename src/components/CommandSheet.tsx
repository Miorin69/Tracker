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
import { PlusIcon, TrashIcon } from './Icons';
import { ResilientImage } from './ResilientImage';
import { WeeklyCalorieTrendChart } from './WeeklyCalorieTrendChart';

interface CommandSheetProps {
  plan: WeeklyPlan;
  selectedDayIndex: DayIndex;
  highlightedDayIndices?: DayIndex[];
  activeCoachSelection: CoachSelection | null;
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
  onAutoGenerateChecklist: () => void;
}

export function CommandSheet({
  plan,
  selectedDayIndex,
  highlightedDayIndices = [],
  activeCoachSelection,
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
  onAutoGenerateChecklist,
}: CommandSheetProps) {
  const [newPrepText, setNewPrepText] = useState('');
  const [newGroceryText, setNewGroceryText] = useState('');
  const [prepInputError, setPrepInputError] = useState<string | null>(null);
  const [groceryInputError, setGroceryInputError] = useState<string | null>(
    null,
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
      id="weekly-command-sheet"
      aria-label="Weekly Command Sheet Preview"
      className="bg-[#150f29]/95 border border-[#35285b] rounded-lg p-5 sm:p-8"
    >
      {/* 1. Header Banner */}
      <header className="print-header bg-[#1c1438] border border-[#3e2f6b] rounded-md p-4 sm:p-5 mb-6">
        <div className="flex flex-col xl:flex-row print:flex-row xl:items-center print:items-center xl:justify-between print:justify-between gap-4">
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

          <dl className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-x-4 gap-y-2 xl:border-l print:border-l xl:border-[#35285b] print:border-slate-200 xl:pl-4 print:pl-4 shrink-0">
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
          <div className="hidden md:grid print:grid md:grid-cols-[88px_minmax(0,1fr)_minmax(0,1.2fr)] print:grid-cols-[72px_minmax(0,1fr)_minmax(0,1.25fr)] bg-[#1e163b] border-b border-[#35285b] text-xs font-semibold text-[#c5b8e3]">
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
                  <div className="px-3 py-2.5 flex items-center justify-between md:flex-col md:items-start md:justify-start gap-1 border-b md:border-b-0 border-[#2d2150]">
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
                    <span className="md:hidden print:hidden text-xs font-mono tabular-nums text-[#b7a8d9]">
                      {durationLabel}
                    </span>
                  </div>

                  {/* Training Column */}
                  <div className="px-3 py-2.5 md:border-l print:border-l border-[#2d2150]">
                    <div className="flex items-baseline justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectDay(day.dayIndex)}
                        className="text-left text-xs sm:text-sm font-semibold text-[#faf7ff] hover:text-[#ffd166] hover:underline underline-offset-2 cursor-pointer"
                      >
                        {day.workoutTitle}
                      </button>
                      <span className="hidden md:inline print:inline text-xs font-mono tabular-nums text-[#ffb36b] whitespace-nowrap shrink-0">
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
                  <div className="px-3 py-2.5 border-t md:border-t-0 md:border-l print:border-t-0 print:border-l border-[#2d2150] text-xs text-[#d6cbef] space-y-1">
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
        id="section-checklist"
        aria-label="Prep and Grocery Checklist"
        className="print-section-gap mt-6 pt-6 border-t border-[#2d2150]"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg font-bold tracking-wide text-[#faf7ff]">
            Prep &amp; Grocery Checklist
          </h2>
          <button
            type="button"
            onClick={onAutoGenerateChecklist}
            className="no-print text-xs font-medium text-[#22d3ee] hover:text-[#67e8f9] underline underline-offset-4 cursor-pointer"
          >
            Rebuild from current meals
          </button>
        </div>

        <div className="print-checklist-grid grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Meal Prep Steps */}
          <div data-testid="prep-checklist-column">
            <div className="flex items-baseline justify-between pb-2 mb-3 border-b border-[#2d2150]">
              <h3 className="text-xs font-semibold text-[#faf7ff]">
                Meal Prep Steps
              </h3>
              <span className="text-xs text-[#9f8ec7] tabular-nums font-mono">
                {prepDoneCount}/{prepItems.length} done
              </span>
            </div>

            {prepItems.length === 0 ? (
              <p className="text-xs text-[#9f8ec7] py-2">
                No meal prep steps yet. Add one below or rebuild from meals.
              </p>
            ) : (
              <ul className="space-y-2">
                {prepItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 group"
                  >
                    <label className="flex items-start gap-2.5 text-xs text-[#e6ddf8] leading-snug cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => onToggleChecklistItem(item.id)}
                        className="print-checkbox mt-0.5 w-4 h-4 accent-[#ff4fa3] rounded shrink-0 cursor-pointer"
                      />
                      <span
                        className={
                          item.checked
                            ? 'line-through text-[#78689e]'
                            : 'text-[#e6ddf8]'
                        }
                      >
                        {item.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onRemoveChecklistItem(item.id)}
                      aria-label={`Remove prep step: ${item.text}`}
                      className="no-print p-1 text-[#78689e] hover:text-[#fb7185] rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0 cursor-pointer"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={handleAddPrep}
              className="no-print mt-3 pt-2.5 border-t border-[#2d2150] space-y-1"
            >
              <label htmlFor="add-prep-item" className="sr-only">
                Add meal prep step
              </label>
              <div className="flex gap-1.5">
                <input
                  id="add-prep-item"
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
            <div className="flex items-baseline justify-between pb-2 mb-3 border-b border-[#2d2150]">
              <h3 className="text-xs font-semibold text-[#faf7ff]">
                Grocery List
              </h3>
              <span className="text-xs text-[#9f8ec7] tabular-nums font-mono">
                {groceryDoneCount}/{groceryItems.length} done
              </span>
            </div>

            {groceryItems.length === 0 ? (
              <p className="text-xs text-[#9f8ec7] py-2">
                No grocery items yet. Add one below or rebuild from meals.
              </p>
            ) : (
              <ul className="space-y-2">
                {groceryItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 group"
                  >
                    <label className="flex items-start gap-2.5 text-xs text-[#e6ddf8] leading-snug cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => onToggleChecklistItem(item.id)}
                        className="print-checkbox mt-0.5 w-4 h-4 accent-[#22d3ee] rounded shrink-0 cursor-pointer"
                      />
                      <span
                        className={
                          item.checked
                            ? 'line-through text-[#78689e]'
                            : 'text-[#e6ddf8]'
                        }
                      >
                        {item.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onRemoveChecklistItem(item.id)}
                      aria-label={`Remove grocery item: ${item.text}`}
                      className="no-print p-1 text-[#78689e] hover:text-[#fb7185] rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0 cursor-pointer"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={handleAddGrocery}
              className="no-print mt-3 pt-2.5 border-t border-[#2d2150] space-y-1"
            >
              <label htmlFor="add-grocery-item" className="sr-only">
                Add grocery item
              </label>
              <div className="flex gap-1.5">
                <input
                  id="add-grocery-item"
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
