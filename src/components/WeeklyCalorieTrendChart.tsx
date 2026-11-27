import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DayIndex, WeeklyPlan } from '../types/plan';
import {
  computeWeeklyCalorieTrend,
  type WeeklyCalorieTrendPoint,
} from '../utils/macroProgressLogic';
import { addDaysToIsoDate, formatShortDate } from '../utils/planLogic';

interface WeeklyCalorieTrendChartProps {
  plan: WeeklyPlan;
  selectedDayIndex: DayIndex;
  onSelectDay: (dayIndex: DayIndex) => void;
  onLoadSampleWeek: () => void;
  onClearWeekProgress: () => void;
}

interface EnrichedTrendPoint extends WeeklyCalorieTrendPoint {
  dateLabel: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload?: EnrichedTrendPoint;
  }>;
}

function TrendTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const deltaLabel = !point.hasLogged
    ? 'Not logged yet'
    : point.delta === 0
      ? 'Exact target'
      : point.delta > 0
        ? `+${point.delta.toLocaleString('en-US')} kcal vs target`
        : `${point.delta.toLocaleString('en-US')} kcal vs target`;

  const deltaColor = !point.hasLogged
    ? 'text-[#9f8ec7]'
    : point.percent >= 90 && point.percent <= 110
      ? 'text-[#34d399]'
      : point.percent > 110
        ? 'text-[#fbbf24]'
        : 'text-[#ff8c52]';

  return (
    <div className="bg-[#181031] border border-[#4c397f] rounded-md px-3 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.65)] text-xs min-w-[178px]">
      <div className="flex items-baseline justify-between gap-3 pb-1.5 mb-1.5 border-b border-[#2d2150]">
        <span className="font-semibold text-[#faf7ff]">{point.dayName}</span>
        <span className="text-[11px] font-mono tabular-nums text-[#9f8ec7]">
          {point.dateLabel}
        </span>
      </div>
      <div className="space-y-1 font-mono tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#c5b8e3]">Intake</span>
          <span className="font-bold text-[#ff6ea8]">
            {point.intake.toLocaleString('en-US')} kcal
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#c5b8e3]">Target</span>
          <span className="font-semibold text-[#38e8ff]">
            {point.target.toLocaleString('en-US')} kcal
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#2d2150] text-[11px]">
          <span className={deltaColor}>{deltaLabel}</span>
          {point.hasLogged && (
            <span className="text-[#faf7ff] font-semibold">
              {point.percent}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function WeeklyCalorieTrendChart({
  plan,
  selectedDayIndex,
  onSelectDay,
  onLoadSampleWeek,
  onClearWeekProgress,
}: WeeklyCalorieTrendChartProps) {
  const trend = computeWeeklyCalorieTrend(plan);

  const chartData: EnrichedTrendPoint[] = trend.points.map((point) => ({
    ...point,
    dateLabel: formatShortDate(
      addDaysToIsoDate(plan.weekStartDate, point.dayIndex),
    ),
  }));

  const selectedPoint =
    chartData.find((p) => p.dayIndex === selectedDayIndex) ?? chartData[0];

  const handleChartClick = (state: unknown) => {
    if (!state || typeof state !== 'object') return;
    const record = state as { activeLabel?: string | number };
    if (record.activeLabel === undefined) return;
    const matched = chartData.find(
      (pt) => pt.shortName === String(record.activeLabel),
    );
    if (matched) {
      onSelectDay(matched.dayIndex);
    }
  };

  return (
    <section
      id="section-calorie-trend"
      aria-label="Weekly Caloric Intake vs Target Trend"
      className="print-section-gap mb-6 border border-[#35285b] rounded-md bg-[#110c23]/90 p-4 space-y-3"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 className="font-display text-lg font-bold tracking-wide text-[#faf7ff]">
              7-Day Caloric Intake vs. Target
            </h2>
            <span className="text-xs font-mono tabular-nums text-[#b7a8d9]">
              {trend.loggedDaysCount > 0
                ? `Avg ${trend.avgIntake.toLocaleString('en-US')} kcal/day · ${trend.loggedDaysCount}/7 days logged`
                : `Target ${plan.caloriesTarget.toLocaleString('en-US')} kcal/day · 0/7 days logged`}
            </span>
          </div>
          <p className="text-xs text-[#9f8ec7] mt-0.5">
            Past 7-day intake curve compared against your daily calorie goal.
            Click any day point to edit its log below.
          </p>
        </div>

        {/* Inline Legend + Action */}
        <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1.5 shrink-0">
          <div className="flex items-center gap-3 text-[11px] text-[#c5b8e3]">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="inline-block w-3.5 h-0.5 bg-[#ff4fa3] rounded-full"
              />
              <span>Total Intake</span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="inline-block w-3.5 border-t-2 border-dashed border-[#22d3ee]"
              />
              <span>Daily Target</span>
            </span>
          </div>

          {trend.loggedDaysCount === 0 ? (
            <button
              type="button"
              onClick={onLoadSampleWeek}
              className="px-2.5 py-1 text-[11px] font-semibold text-[#faf7ff] bg-[#241945] border border-[#4c397f] rounded hover:border-[#ff4fa3] hover:bg-[#2d2057] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Load Sample 7-Day Log
            </button>
          ) : (
            <button
              type="button"
              onClick={onClearWeekProgress}
              className="text-[11px] font-medium text-[#c5b8e3] hover:text-[#ffd166] underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Clear 7-day log
            </button>
          )}
        </div>
      </div>

      {/* Recharts Line Graph */}
      <div
        data-testid="weekly-calorie-trend-chart"
        className="w-full h-[220px] min-w-0"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 16, left: 2, bottom: 4 }}
            onClick={handleChartClick}
          >
            <CartesianGrid
              stroke="#2d2150"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="shortName"
              stroke="#9f8ec7"
              tick={{
                fill: '#c5b8e3',
                fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
              axisLine={{ stroke: '#35285b' }}
              tickLine={false}
              dy={4}
            />
            <YAxis
              domain={[0, trend.yAxisMax]}
              width={54}
              stroke="#9f8ec7"
              tick={{
                fill: '#9f8ec7',
                fontSize: 11,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) =>
                value === 0
                  ? '0'
                  : value >= 1000
                    ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
                    : `${value}`
              }
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: '#4c397f', strokeDasharray: '4 4' }}
            />
            <Line
              type="monotone"
              dataKey="target"
              name="Daily Target"
              stroke="#22d3ee"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#22d3ee',
                stroke: '#110c23',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="intake"
              name="Total Intake"
              stroke="#ff4fa3"
              strokeWidth={2.5}
              dot={{
                r: 4,
                fill: '#ff4fa3',
                stroke: '#110c23',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: '#ffd166',
                stroke: '#110c23',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Quiet Tabular Summary Strip */}
      <div className="pt-2.5 border-t border-[#2d2150] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums text-[#9f8ec7]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            7-Day Total:{' '}
            <strong className="text-[#faf7ff] font-semibold">
              {trend.weeklyTotalIntake.toLocaleString('en-US')}
            </strong>{' '}
            / {trend.weeklyTotalTarget.toLocaleString('en-US')} kcal
          </span>
          <span aria-hidden="true" className="text-[#5b478a]">
            ·
          </span>
          <span>
            On-Target Days:{' '}
            <strong className="text-[#34d399] font-semibold">
              {trend.daysOnTarget}/7
            </strong>
          </span>
        </div>

        <span className="text-[#c5b8e3]">
          Selected: {selectedPoint.dayName} (
          <strong className="text-[#ff6ea8] font-semibold">
            {selectedPoint.intake.toLocaleString('en-US')} kcal
          </strong>
          )
        </span>
      </div>
    </section>
  );
}
