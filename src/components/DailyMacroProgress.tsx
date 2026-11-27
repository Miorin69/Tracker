import { useState } from 'react';
import type { DayIndex, MealSlot, WeeklyPlan } from '../types/plan';
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  computeDayMacroProgress,
  getDayProgress,
} from '../utils/macroProgressLogic';
import {
  addDaysToIsoDate,
  formatShortDate,
  getEffectiveDayMeals,
} from '../utils/planLogic';
import { RotateCcwIcon } from './Icons';

interface DailyMacroProgressProps {
  plan: WeeklyPlan;
  selectedDayIndex: DayIndex;
  onSelectDay: (dayIndex: DayIndex) => void;
  onToggleMealCompleted: (dayIndex: DayIndex, slot: MealSlot) => void;
  onToggleWorkoutCompleted: (dayIndex: DayIndex) => void;
  onUpdateExtraIntake: (
    dayIndex: DayIndex,
    extraCalories: number,
    extraProtein: number,
  ) => void;
  onResetDayProgress: (dayIndex: DayIndex) => void;
}

export function DailyMacroProgress({
  plan,
  selectedDayIndex,
  onSelectDay,
  onToggleMealCompleted,
  onToggleWorkoutCompleted,
  onUpdateExtraIntake,
  onResetDayProgress,
}: DailyMacroProgressProps) {
  const [showExtraControls, setShowExtraControls] = useState(false);

  const activeDay = plan.days[selectedDayIndex] ?? plan.days[0];
  const dateLabel = formatShortDate(
    addDaysToIsoDate(plan.weekStartDate, activeDay.dayIndex),
  );
  const meals = getEffectiveDayMeals(plan, activeDay);
  const stats = computeDayMacroProgress(plan, activeDay.dayIndex);
  const isTrainingDay = !activeDay.isRestDay && activeDay.durationMinutes > 0;

  const hasAnyLogged =
    stats.mealsCompletedCount > 0 ||
    stats.extraCalories > 0 ||
    stats.extraProtein > 0 ||
    stats.workoutCompleted;

  const caloriesBarColor =
    stats.caloriesStatus === 'over'
      ? 'bg-gradient-to-r from-[#f59e0b] to-[#fb7185]'
      : stats.caloriesStatus === 'on-target'
        ? 'bg-gradient-to-r from-[#10b981] to-[#34d399]'
        : 'bg-gradient-to-r from-[#ff2e93] via-[#ff6b4a] to-[#ffb347]';

  const proteinBarColor =
    stats.proteinStatus === 'hit'
      ? 'bg-gradient-to-r from-[#10b981] to-[#34d399]'
      : 'bg-gradient-to-r from-[#06b6d4] to-[#22d3ee]';

  const caloriesRemainingText =
    stats.caloriesStatus === 'over'
      ? `+${Math.abs(stats.caloriesRemaining).toLocaleString('en-US')} kcal over`
      : stats.caloriesStatus === 'on-target'
        ? 'Target met'
        : `${stats.caloriesRemaining.toLocaleString('en-US')} kcal left`;

  const proteinRemainingText =
    stats.proteinStatus === 'hit'
      ? stats.proteinRemaining < 0
        ? `Target hit (+${Math.abs(stats.proteinRemaining)}g)`
        : 'Target hit'
      : `${stats.proteinRemaining}g left`;

  const handleQuickAdd = (addCal: number, addProt: number) => {
    onUpdateExtraIntake(
      activeDay.dayIndex,
      stats.extraCalories + addCal,
      stats.extraProtein + addProt,
    );
  };

  return (
    <section
      id="section-daily-progress"
      aria-label="Daily Calorie and Protein Progress"
      className="print-section-gap mb-6 border border-[#35285b] rounded-md bg-[#110c23]/90 p-4 space-y-4"
    >
      {/* Top Bar: Heading + Day Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-lg font-bold tracking-wide text-[#faf7ff]">
              Daily Target Progress
            </h2>
            <span className="text-xs text-[#b7a8d9] tabular-nums">
              {activeDay.dayName} · {dateLabel}
            </span>
          </div>
          <p className="text-xs text-[#9f8ec7] mt-0.5">
            Check off planned meals and today&apos;s session to update your
            daily bars and Weekly Snapshot live.
          </p>
        </div>

        <div className="no-print shrink-0">
          <div
            role="group"
            aria-label="Select day for daily progress tracker"
            className="inline-flex items-center gap-0.5 p-0.5 bg-[#1d1538] border border-[#35285b] rounded-md"
          >
            {plan.days.map((day) => {
              const isSelected = day.dayIndex === activeDay.dayIndex;
              const dayLogged = getDayProgress(plan, day.dayIndex);
              const doneCount = dayLogged.completedMeals.length;
              return (
                <button
                  key={day.dayIndex}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Track ${day.dayName} progress (${doneCount} of 4 meals checked)`}
                  onClick={() => onSelectDay(day.dayIndex)}
                  className={`relative px-2 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'vice-sunset-btn font-bold'
                      : 'text-[#c5b8e3] hover:bg-[#2a1f4d] hover:text-white'
                  }`}
                >
                  <span>{day.shortName}</span>
                  {doneCount > 0 && (
                    <span
                      aria-hidden="true"
                      className={`ml-0.5 text-[10px] font-mono ${
                        isSelected
                          ? 'text-[#14081f]'
                          : doneCount === 4
                            ? 'text-[#34d399]'
                            : 'text-[#ff8c52]'
                      }`}
                    >
                      {doneCount === 4 ? '✓' : doneCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Visual Progress Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Daily Calories Bar */}
        <div
          data-testid="daily-calories-tracker"
          className="bg-[#191233] border border-[#35285b] rounded-md p-3 space-y-2"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-[#faf7ff]">
              Daily Calories
            </span>
            <span className="text-xs font-mono tabular-nums text-[#faf7ff]">
              <strong className="font-bold text-[#ff6ea8]">
                {stats.caloriesConsumed.toLocaleString('en-US')}
              </strong>{' '}
              <span className="text-[#9f8ec7]">
                / {stats.caloriesTarget.toLocaleString('en-US')} kcal
              </span>
            </span>
          </div>

          <div
            role="progressbar"
            aria-label={`Daily calorie progress for ${activeDay.dayName}`}
            aria-valuenow={stats.caloriesConsumed}
            aria-valuemin={0}
            aria-valuemax={stats.caloriesTarget}
            className="h-2.5 w-full bg-[#2a1f4d] rounded-full overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${caloriesBarColor}`}
              style={{ width: `${stats.caloriesBarPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] tabular-nums">
            <span className="font-mono font-semibold text-[#e6ddf8]">
              {stats.caloriesPercent}%
            </span>
            <span
              className={`font-medium ${
                stats.caloriesStatus === 'over'
                  ? 'text-[#fbbf24]'
                  : stats.caloriesStatus === 'on-target'
                    ? 'text-[#34d399]'
                    : 'text-[#9f8ec7]'
              }`}
            >
              {caloriesRemainingText}
            </span>
          </div>
        </div>

        {/* Daily Protein Bar */}
        <div
          data-testid="daily-protein-tracker"
          className="bg-[#191233] border border-[#35285b] rounded-md p-3 space-y-2"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-[#faf7ff]">
              Daily Protein
            </span>
            <span className="text-xs font-mono tabular-nums text-[#faf7ff]">
              <strong className="font-bold text-[#38e8ff]">
                {stats.proteinConsumed}g
              </strong>{' '}
              <span className="text-[#9f8ec7]">/ {stats.proteinTarget}g</span>
            </span>
          </div>

          <div
            role="progressbar"
            aria-label={`Daily protein progress for ${activeDay.dayName}`}
            aria-valuenow={stats.proteinConsumed}
            aria-valuemin={0}
            aria-valuemax={stats.proteinTarget}
            className="h-2.5 w-full bg-[#2a1f4d] rounded-full overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${proteinBarColor}`}
              style={{ width: `${stats.proteinBarPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] tabular-nums">
            <span className="font-mono font-semibold text-[#e6ddf8]">
              {stats.proteinPercent}%
            </span>
            <span
              className={`font-medium ${
                stats.proteinStatus === 'hit'
                  ? 'text-[#34d399]'
                  : 'text-[#9f8ec7]'
              }`}
            >
              {proteinRemainingText}
            </span>
          </div>
        </div>
      </div>

      {/* Meal & Training Check-off */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#e6ddf8]">
            {activeDay.dayName} Check-off
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono tabular-nums text-[#9f8ec7]">
              {stats.mealsCompletedCount}/{stats.totalMealsCount} meals logged
            </span>
            {hasAnyLogged && (
              <button
                type="button"
                onClick={() => onResetDayProgress(activeDay.dayIndex)}
                aria-label={`Reset ${activeDay.dayName} progress`}
                className="no-print inline-flex items-center gap-1 text-[11px] font-medium text-[#c5b8e3] hover:text-[#ffd166] underline underline-offset-2 transition-colors cursor-pointer"
              >
                <RotateCcwIcon className="w-3 h-3" />
                <span>Reset day</span>
              </button>
            )}
          </div>
        </div>

        {/* Workout Completion Row (Training Days) */}
        {isTrainingDay && (
          <label
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md border transition-colors cursor-pointer ${
              stats.workoutCompleted
                ? 'bg-[#122a2a] border-[#34d399]/60'
                : 'bg-[#191233] border-[#35285b] hover:border-[#ffd166]/60'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <input
                type="checkbox"
                checked={stats.workoutCompleted}
                onChange={() => onToggleWorkoutCompleted(activeDay.dayIndex)}
                className="print-checkbox w-4 h-4 accent-[#ffd166] rounded shrink-0 cursor-pointer"
              />
              <span className="text-xs font-semibold text-[#faf7ff] truncate">
                Workout completed:{' '}
                <span
                  className={
                    stats.workoutCompleted
                      ? 'line-through text-[#6ee7b7]'
                      : 'text-[#ffd166]'
                  }
                >
                  {activeDay.workoutTitle}
                </span>
              </span>
            </span>
            <span className="text-[11px] font-mono tabular-nums text-[#b7a8d9] whitespace-nowrap shrink-0">
              {activeDay.durationMinutes} min
            </span>
          </label>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MEAL_SLOTS.map((slot) => {
            const checked = stats.completedMeals.includes(slot);
            const mealText = meals[slot];
            const estimate = stats.slotMacros[slot];

            return (
              <label
                key={slot}
                className={`flex items-start gap-2.5 p-2.5 rounded-md border transition-colors cursor-pointer ${
                  checked
                    ? 'bg-[#122a2a] border-[#34d399]/55'
                    : 'bg-[#191233] border-[#35285b] hover:border-[#ff4fa3]/55'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onToggleMealCompleted(activeDay.dayIndex, slot)
                  }
                  className="print-checkbox mt-0.5 w-4 h-4 accent-[#34d399] rounded shrink-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        checked ? 'text-[#6ee7b7]' : 'text-[#faf7ff]'
                      }`}
                    >
                      {MEAL_SLOT_LABELS[slot]}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-[#9f8ec7] whitespace-nowrap shrink-0">
                      ~{estimate.calories} kcal · {estimate.protein}g P
                    </span>
                  </div>
                  <p
                    title={mealText}
                    className={`text-[11px] truncate mt-0.5 ${
                      checked
                        ? 'line-through text-[#8ab4aa]'
                        : 'text-[#b7a8d9]'
                    }`}
                  >
                    {mealText}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Extra Intake Quick-Log Toggle */}
      <div className="no-print pt-1.5 border-t border-[#2d2150]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            aria-expanded={showExtraControls}
            onClick={() => setShowExtraControls((prev) => !prev)}
            className="text-xs font-medium text-[#22d3ee] hover:text-[#67e8f9] underline underline-offset-2 cursor-pointer"
          >
            {showExtraControls
              ? 'Hide extra intake log'
              : '+ Log extra shake, snack, or meal'}
          </button>

          {(stats.extraCalories > 0 || stats.extraProtein > 0) && (
            <span className="text-[11px] font-mono tabular-nums text-[#ffb36b]">
              Extra logged: +{stats.extraCalories} kcal · +{stats.extraProtein}g
              protein
            </span>
          )}
        </div>

        {showExtraControls && (
          <div className="mt-2.5 p-3 bg-[#191233] border border-[#35285b] rounded-md space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#9f8ec7] mr-1">
                Quick add:
              </span>
              <button
                type="button"
                onClick={() => handleQuickAdd(120, 25)}
                className="px-2 py-1 text-[11px] font-medium text-[#ede7fc] bg-[#241945] border border-[#3e2f6b] rounded hover:border-[#22d3ee]/70 transition-colors cursor-pointer"
              >
                +1 Whey Scoop (120 kcal · 25g P)
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(200, 15)}
                className="px-2 py-1 text-[11px] font-medium text-[#ede7fc] bg-[#241945] border border-[#3e2f6b] rounded hover:border-[#22d3ee]/70 transition-colors cursor-pointer"
              >
                +Greek Yogurt / Bar (200 kcal · 15g P)
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(250, 0)}
                className="px-2 py-1 text-[11px] font-medium text-[#ede7fc] bg-[#241945] border border-[#3e2f6b] rounded hover:border-[#ff4fa3]/70 transition-colors cursor-pointer"
              >
                +250 kcal Treat
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="extra-calories-input"
                  className="block text-[11px] font-medium text-[#c5b8e3] mb-1"
                >
                  Extra Calories (kcal)
                </label>
                <input
                  id="extra-calories-input"
                  type="number"
                  min={0}
                  max={5000}
                  step={10}
                  value={stats.extraCalories}
                  onChange={(e) => {
                    const nextVal = Number(e.target.value);
                    onUpdateExtraIntake(
                      activeDay.dayIndex,
                      Number.isFinite(nextVal) ? nextVal : 0,
                      stats.extraProtein,
                    );
                  }}
                  className="w-full h-8 px-2.5 text-xs font-mono tabular-nums text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md focus:outline-none focus:border-[#ff4fa3]"
                />
              </div>

              <div>
                <label
                  htmlFor="extra-protein-input"
                  className="block text-[11px] font-medium text-[#c5b8e3] mb-1"
                >
                  Extra Protein (g)
                </label>
                <input
                  id="extra-protein-input"
                  type="number"
                  min={0}
                  max={400}
                  step={1}
                  value={stats.extraProtein}
                  onChange={(e) => {
                    const nextVal = Number(e.target.value);
                    onUpdateExtraIntake(
                      activeDay.dayIndex,
                      stats.extraCalories,
                      Number.isFinite(nextVal) ? nextVal : 0,
                    );
                  }}
                  className="w-full h-8 px-2.5 text-xs font-mono tabular-nums text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md focus:outline-none focus:border-[#22d3ee]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
