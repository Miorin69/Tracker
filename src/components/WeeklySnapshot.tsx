import type { DayIndex, WeeklyPlan } from '../types/plan';
import { computeWeeklySnapshot } from '../utils/macroProgressLogic';
import { formatWeekRange } from '../utils/planLogic';

interface WeeklySnapshotProps {
  plan: WeeklyPlan;
  selectedDayIndex: DayIndex;
  onSelectDay: (dayIndex: DayIndex) => void;
  onJumpToTracker: () => void;
}

export function WeeklySnapshot({
  plan,
  selectedDayIndex,
  onSelectDay,
  onJumpToTracker,
}: WeeklySnapshotProps) {
  const snapshot = computeWeeklySnapshot(plan);
  const weekRange = formatWeekRange(plan.weekStartDate);
  const holidayLabel = plan.holidayTag.trim() || 'Normal Week';

  const handleDayJump = (dayIndex: DayIndex) => {
    onSelectDay(dayIndex);
    onJumpToTracker();
  };

  return (
    <section
      id="section-weekly-snapshot"
      aria-label="Weekly Snapshot"
      className="no-print max-w-[1440px] mx-auto px-4 sm:px-6 pt-5"
    >
      <div className="bg-[#150f29]/95 border border-[#35285b] rounded-lg overflow-hidden shadow-[0_14px_40px_rgba(7,3,18,0.55)]">
        {/* Sunset horizon hairline */}
        <div className="h-[3px] w-full vice-horizon-line" aria-hidden="true" />

        {/* Header Row */}
        <div className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-display text-2xl sm:text-[26px] font-bold tracking-wide text-[#faf7ff] leading-none">
                Weekly Snapshot
              </h2>
              <span className="text-xs text-[#b7a8d9] tabular-nums">
                {weekRange}
                <span aria-hidden="true" className="mx-1.5 text-[#5b478a]">
                  ·
                </span>
                <span className="text-[#ffb36b] font-medium">{holidayLabel}</span>
                <span aria-hidden="true" className="mx-1.5 text-[#5b478a]">
                  ·
                </span>
                <span className="text-[#5eead4] font-semibold">
                  {snapshot.adherenceLabel}
                </span>
              </span>
            </div>
            <p className="text-xs text-[#b7a8d9] leading-relaxed">
              {snapshot.adherenceHint}
            </p>
          </div>

          <button
            type="button"
            onClick={onJumpToTracker}
            className="self-start md:self-center inline-flex items-center justify-center px-3.5 h-8 text-xs font-semibold text-[#ffd4ec] bg-[#241942] border border-[#ff2e93]/40 rounded-md hover:bg-[#ff2e93]/20 hover:border-[#ff2e93]/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Log Daily Progress &rarr;
          </button>
        </div>

        {/* 4-Metric Weekly Averages Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#2d2150] border-t border-[#2d2150]">
          {/* Avg Calorie Intake % */}
          <div
            data-testid="snapshot-avg-calories"
            className="px-5 py-3.5 space-y-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-[#c5b8e3]">
                Avg Calorie Intake
              </span>
              <span className="text-xl font-bold font-mono tabular-nums text-[#ff6ea8]">
                {snapshot.avgCaloriesPercent}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Weekly average calorie intake percentage"
              aria-valuenow={snapshot.avgCaloriesPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full bg-[#241a42] rounded-full overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ff2e93] via-[#ff6b4a] to-[#ffb347] transition-all duration-300"
                style={{ width: `${snapshot.avgCaloriesBarPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#9f8ec7] font-mono tabular-nums">
              <span>
                {snapshot.loggedDaysCount > 0
                  ? `${snapshot.avgCaloriesPerDay.toLocaleString('en-US')} / ${plan.caloriesTarget.toLocaleString('en-US')} kcal`
                  : `Target ${plan.caloriesTarget.toLocaleString('en-US')} kcal`}
              </span>
              <span>{snapshot.loggedDaysCount}/7 days</span>
            </div>
          </div>

          {/* Avg Protein Intake % */}
          <div
            data-testid="snapshot-avg-protein"
            className="px-5 py-3.5 space-y-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-[#c5b8e3]">
                Avg Protein Intake
              </span>
              <span className="text-xl font-bold font-mono tabular-nums text-[#38e8ff]">
                {snapshot.avgProteinPercent}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Weekly average protein intake percentage"
              aria-valuenow={snapshot.avgProteinPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full bg-[#241a42] rounded-full overflow-hidden"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  snapshot.avgProteinPercent >= 95
                    ? 'bg-gradient-to-r from-[#10b981] to-[#34d399]'
                    : 'bg-gradient-to-r from-[#06b6d4] to-[#22d3ee]'
                }`}
                style={{ width: `${snapshot.avgProteinBarPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#9f8ec7] font-mono tabular-nums">
              <span>
                {snapshot.loggedDaysCount > 0
                  ? `${snapshot.avgProteinPerDay}g / ${plan.proteinTarget}g avg`
                  : `Target ${plan.proteinTarget}g/day`}
              </span>
              <span>{snapshot.weeklyProteinPercent}% of week</span>
            </div>
          </div>

          {/* Training Adherence % */}
          <div
            data-testid="snapshot-training-adherence"
            className="px-5 py-3.5 space-y-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-[#c5b8e3]">
                Training Adherence
              </span>
              <span className="text-xl font-bold font-mono tabular-nums text-[#ffd166]">
                {snapshot.trainingAdherencePercent}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Weekly training sessions adherence percentage"
              aria-valuenow={snapshot.trainingAdherencePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full bg-[#241a42] rounded-full overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ff7a45] to-[#ffd166] transition-all duration-300"
                style={{
                  width: `${Math.min(100, snapshot.trainingAdherencePercent)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#9f8ec7] font-mono tabular-nums">
              <span>
                {snapshot.workoutsCompletedCount}/{snapshot.scheduledWorkoutsCount}{' '}
                sessions done
              </span>
              <span>{plan.prepTimeLimit} prep</span>
            </div>
          </div>

          {/* Weekly Meal Consistency */}
          <div
            data-testid="snapshot-meal-consistency"
            className="px-5 py-3.5 space-y-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-[#c5b8e3]">
                Meals Logged
              </span>
              <span className="text-xl font-bold font-mono tabular-nums text-[#f0abfc]">
                {snapshot.mealsAdherencePercent}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Weekly planned meals logged percentage"
              aria-valuenow={snapshot.mealsAdherencePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full bg-[#241a42] rounded-full overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#c026d3] to-[#ff4fa3] transition-all duration-300"
                style={{ width: `${snapshot.mealsAdherencePercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#9f8ec7] font-mono tabular-nums">
              <span>
                {snapshot.totalMealsCompleted}/{snapshot.totalMealsPossible} meals
              </span>
              <span>{snapshot.weeklyCaloriesPercent}% week kcal</span>
            </div>
          </div>
        </div>

        {/* Interactive 7-Day Adherence Strip */}
        <div className="border-t border-[#2d2150] bg-[#100a20]/90 px-4 sm:px-5 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-medium text-[#b7a8d9]">
              7-Day Adherence Strip (click any day to log)
            </span>
            <div className="flex items-center gap-3 text-[11px] text-[#9f8ec7]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-1.5 rounded-sm bg-[#ff5c8a]" />
                Calories
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-1.5 rounded-sm bg-[#22d3ee]" />
                Protein
              </span>
            </div>
          </div>

          <div
            role="group"
            aria-label="Weekly adherence by day"
            className="grid grid-cols-7 gap-1.5 sm:gap-2"
          >
            {snapshot.days.map((day) => {
              const isSelected = day.dayIndex === selectedDayIndex;
              return (
                <button
                  key={day.dayIndex}
                  type="button"
                  onClick={() => handleDayJump(day.dayIndex)}
                  aria-label={`${day.dayName}: ${day.caloriesPercent}% calories, ${day.proteinPercent}% protein${day.workoutCompleted ? ', workout completed' : ''}`}
                  className={`px-2 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#251a46] border-[#ff4fa3]/70'
                      : 'bg-[#17112e] border-[#2d2150] hover:border-[#4c3980] hover:bg-[#1e163b]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span
                      className={`text-[11px] font-semibold ${
                        isSelected ? 'text-[#ffd166]' : 'text-[#e9e2fa]'
                      }`}
                    >
                      {day.shortName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono tabular-nums">
                      <span
                        className={
                          day.caloriesPercent > 0
                            ? 'text-[#e6ddf8] font-semibold'
                            : 'text-[#9f8ec7]'
                        }
                      >
                        {day.caloriesPercent > 0
                          ? `${day.caloriesPercent}%`
                          : day.isRestDay
                            ? 'Rest'
                            : '0%'}
                      </span>
                      {day.workoutCompleted && (
                        <span
                          aria-hidden="true"
                          className="text-[#34d399] font-bold"
                        >
                          &#10003;
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Mini dual intake bars */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-[#2a1f4b] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff2e93] to-[#ff8c52] transition-all duration-300"
                        style={{ width: `${day.caloriesBarPercent}%` }}
                      />
                    </div>
                    <div className="h-1.5 w-full bg-[#2a1f4b] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#06b6d4] to-[#22d3ee] transition-all duration-300"
                        style={{ width: `${day.proteinBarPercent}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
