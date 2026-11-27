import { useMemo, useState } from 'react';
import type { WeeklyPlan } from '../types/plan';
import type { StoredBmiState } from '../utils/localProfileLogic';
import {
  FITNESS_TIPS,
  TIP_CATEGORIES,
  calculateBmiFromImperial,
  calculateBmiFromMetric,
  cmToFeetInches,
  feetInchesToCm,
  filterFitnessTips,
  kgToLbs,
  lbsToKg,
  pickContextualTip,
  type BmiCategory,
  type FitnessTip,
  type TipCategory,
  type UnitSystem,
} from '../utils/fitnessToolsLogic';
import { BookmarkIcon } from './Icons';

interface FitnessTipsAndBmiProps {
  plan: WeeklyPlan;
  bookmarkedIds: string[];
  bmiState: StoredBmiState;
  onChangeBookmarkedIds: (updater: (prev: string[]) => string[]) => void;
  onChangeBmiState: (updater: (prev: StoredBmiState) => StoredBmiState) => void;
  onApplyMacroTargets: (calories: number, protein: number) => void;
  onOpenCoach: () => void;
}

function getCategoryColorClass(category: BmiCategory): string {
  switch (category) {
    case 'Underweight':
      return 'text-[#38e8ff]';
    case 'Healthy Weight':
      return 'text-[#34d399]';
    case 'Overweight':
      return 'text-[#ffd166]';
    case 'Obese':
      return 'text-[#ff6ea8]';
  }
}

function getTipCategoryAccent(category: TipCategory): string {
  switch (category) {
    case 'Strength':
      return 'text-[#ff6ea8]';
    case 'Nutrition':
      return 'text-[#38e8ff]';
    case 'Recovery':
      return 'text-[#34d399]';
    case 'Habit':
      return 'text-[#ffd166]';
  }
}

export function FitnessTipsAndBmi({
  plan,
  bookmarkedIds,
  bmiState,
  onChangeBookmarkedIds,
  onChangeBmiState,
  onApplyMacroTargets,
  onOpenCoach,
}: FitnessTipsAndBmiProps) {
  // Fitness Tips filter UI state
  const [selectedCategory, setSelectedCategory] = useState<'All' | TipCategory>(
    'All',
  );
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTips, setShowAllTips] = useState(false);
  const [spotlightId, setSpotlightId] = useState<string>(
    () => pickContextualTip(plan, FITNESS_TIPS).id,
  );

  const filteredTips = useMemo(
    () =>
      filterFitnessTips(
        FITNESS_TIPS,
        selectedCategory,
        searchQuery,
        showSavedOnly,
        bookmarkedIds,
      ),
    [selectedCategory, searchQuery, showSavedOnly, bookmarkedIds],
  );

  const spotlightTip: FitnessTip =
    FITNESS_TIPS.find((t) => t.id === spotlightId) ?? FITNESS_TIPS[0];

  const isSpotlightSaved = bookmarkedIds.includes(spotlightTip.id);

  const toggleBookmark = (id: string) => {
    onChangeBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleNextTip = () => {
    const pool = filteredTips.length > 0 ? filteredTips : FITNESS_TIPS;
    const currentIndex = pool.findIndex((t) => t.id === spotlightTip.id);
    const nextTip = pool[(currentIndex + 1) % pool.length];
    if (nextTip) setSpotlightId(nextTip.id);
  };

  const handleSwitchUnit = (nextUnit: UnitSystem) => {
    if (nextUnit === bmiState.unit) return;

    if (nextUnit === 'imperial') {
      const cm = Number(bmiState.heightCm);
      const kg = Number(bmiState.weightKg);
      const convertedHeight =
        Number.isFinite(cm) && cm >= 100 && cm <= 250
          ? cmToFeetInches(cm)
          : { feet: 5, inches: 9 };
      const convertedLbs =
        Number.isFinite(kg) && kg >= 30 && kg <= 300
          ? Math.round(kgToLbs(kg))
          : 159;

      onChangeBmiState((prev) => ({
        ...prev,
        unit: 'imperial',
        feet: String(convertedHeight.feet),
        inches: String(convertedHeight.inches),
        weightLbs: String(convertedLbs),
      }));
    } else {
      const ft = Number(bmiState.feet);
      const inch = Number(bmiState.inches);
      const lbs = Number(bmiState.weightLbs);
      const convertedCm =
        Number.isFinite(ft) && Number.isFinite(inch) && ft >= 3 && ft <= 8
          ? Math.round(feetInchesToCm(ft, Math.max(0, Math.min(11, inch))))
          : 175;
      const convertedKg =
        Number.isFinite(lbs) && lbs >= 66 && lbs <= 660
          ? Math.round(lbsToKg(lbs) * 10) / 10
          : 72;

      onChangeBmiState((prev) => ({
        ...prev,
        unit: 'metric',
        heightCm: String(convertedCm),
        weightKg: String(convertedKg),
      }));
    }
  };

  const bmiResult = useMemo(() => {
    if (bmiState.unit === 'metric') {
      return calculateBmiFromMetric(
        Number(bmiState.heightCm),
        Number(bmiState.weightKg),
        bmiState.goal,
      );
    }
    return calculateBmiFromImperial(
      Number(bmiState.feet),
      Number(bmiState.inches),
      Number(bmiState.weightLbs),
      bmiState.goal,
    );
  }, [bmiState]);

  const visibleTips = showAllTips ? filteredTips : filteredTips.slice(0, 4);

  return (
    <section
      id="section-tips-bmi"
      aria-label="Fitness Tips and BMI Calculator"
      className="no-print max-w-[1440px] mx-auto px-4 sm:px-6 pb-10"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6 items-start">
        {/* LEFT CARD: FITNESS TIPS */}
        <div
          id="section-fitness-tips"
          className="bg-[#150f29]/95 border border-[#35285b] rounded-lg overflow-hidden shadow-[0_14px_40px_rgba(7,3,18,0.55)]"
        >
          <div className="h-[3px] w-full vice-horizon-line" aria-hidden="true" />

          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#faf7ff] leading-none">
                  Fitness Tips
                </h2>
                <p className="text-xs text-[#b5a7d6] mt-1">
                  Actionable lifting, macro, recovery, and habit cues to pair
                  with your weekly command sheet.
                </p>
              </div>
              <button
                type="button"
                onClick={handleNextTip}
                className="px-3 h-8 text-xs font-semibold text-[#ffd4ec] bg-[#241942] border border-[#ff2e93]/45 rounded-md hover:bg-[#ff2e93]/20 hover:border-[#ff2e93]/75 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Next Tip &rarr;
              </button>
            </div>

            {/* Featured Spotlight Tip */}
            <div
              data-testid="featured-fitness-tip"
              className="p-4 rounded-lg bg-[#1b1338] border border-[#4a397a] space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider">
                  <span className={getTipCategoryAccent(spotlightTip.category)}>
                    {spotlightTip.category}
                  </span>
                  <span aria-hidden="true" className="mx-1.5 text-[#5b478a]">
                    ·
                  </span>
                  <span className="text-[#c5b8e3]">{spotlightTip.topic}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBookmark(spotlightTip.id)}
                  aria-pressed={isSpotlightSaved}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded border transition-colors cursor-pointer ${
                    isSpotlightSaved
                      ? 'bg-[#2c2052] text-[#ffd166] border-[#ffd166]/60'
                      : 'bg-[#120c26] text-[#c5b8e3] border-[#35285b] hover:text-[#faf7ff] hover:border-[#ff6ea8]/60'
                  }`}
                >
                  <BookmarkIcon className="w-3 h-3" />
                  <span>{isSpotlightSaved ? 'Saved' : 'Save Tip'}</span>
                </button>
              </div>

              <h3 className="text-base font-bold text-[#faf7ff] leading-snug">
                {spotlightTip.title}
              </h3>

              <p className="text-xs text-[#d4c8ef] leading-relaxed">
                {spotlightTip.summary}
              </p>

              <div className="pt-2 border-t border-[#2f2354] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs text-[#6ee7b7] leading-snug">
                  <span className="font-semibold text-[#34d399]">
                    Action step:{' '}
                  </span>
                  {spotlightTip.actionStep}
                </p>
                <button
                  type="button"
                  onClick={onOpenCoach}
                  className="self-start sm:self-center text-[11px] font-semibold text-[#38e8ff] hover:underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Ask Coach Hishay &rarr;
                </button>
              </div>
            </div>

            {/* Category Filter & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div
                role="group"
                aria-label="Filter fitness tips by category"
                className="flex flex-wrap items-center gap-1.5"
              >
                {TIP_CATEGORIES.map((cat) => {
                  const active = !showSavedOnly && selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setShowSavedOnly(false);
                        setSelectedCategory(cat);
                        setShowAllTips(false);
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'vice-sunset-btn border-transparent'
                          : 'bg-[#110c23] text-[#c5b8e3] border-[#35285b] hover:bg-[#21183e] hover:text-[#faf7ff]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={showSavedOnly}
                  onClick={() => {
                    setShowSavedOnly((prev) => !prev);
                    setShowAllTips(false);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    showSavedOnly
                      ? 'bg-[#2c2052] text-[#ffd166] border-[#ffd166]/65'
                      : 'bg-[#110c23] text-[#c5b8e3] border-[#35285b] hover:bg-[#21183e] hover:text-[#faf7ff]'
                  }`}
                >
                  Saved ({bookmarkedIds.length})
                </button>
              </div>

              <div className="sm:w-44 shrink-0">
                <label htmlFor="fitness-tips-search" className="sr-only">
                  Search fitness tips
                </label>
                <input
                  id="fitness-tips-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowAllTips(false);
                  }}
                  placeholder="Filter tips..."
                  className="w-full h-8 px-2.5 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
                />
              </div>
            </div>

            {/* Filtered Tips List */}
            {filteredTips.length === 0 ? (
              <div className="p-4 text-center rounded-md bg-[#110c23] border border-[#2d2150] space-y-2">
                <p className="text-xs text-[#b5a7d6]">
                  {showSavedOnly
                    ? 'No saved tips yet. Click Save on any tip to build your personal reference list.'
                    : 'No fitness tips matched your filter.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowSavedOnly(false);
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="text-xs font-semibold text-[#38e8ff] hover:underline underline-offset-2 cursor-pointer"
                >
                  Show all tips
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <ul className="divide-y divide-[#2d2150] border border-[#35285b] rounded-md bg-[#110c23]/90 overflow-hidden">
                  {visibleTips.map((tip) => {
                    const isSaved = bookmarkedIds.includes(tip.id);
                    const isFeatured = tip.id === spotlightTip.id;
                    return (
                      <li
                        key={tip.id}
                        className={`px-3.5 py-3 flex items-start justify-between gap-3 transition-colors ${
                          isFeatured ? 'bg-[#1d153b]' : 'hover:bg-[#191233]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSpotlightId(tip.id)}
                          className="flex-1 text-left min-w-0 space-y-1 cursor-pointer"
                        >
                          <div className="text-[11px] font-medium">
                            <span className={getTipCategoryAccent(tip.category)}>
                              {tip.category}
                            </span>
                            <span
                              aria-hidden="true"
                              className="mx-1.5 text-[#5b478a]"
                            >
                              ·
                            </span>
                            <span className="text-[#9f8ec7]">{tip.topic}</span>
                          </div>
                          <div className="text-xs font-semibold text-[#faf7ff] leading-snug">
                            {tip.title}
                          </div>
                          <p className="text-[11px] text-[#b5a7d6] leading-relaxed">
                            {tip.summary}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleBookmark(tip.id)}
                          aria-label={
                            isSaved
                              ? `Remove bookmark for ${tip.title}`
                              : `Save tip ${tip.title}`
                          }
                          aria-pressed={isSaved}
                          className={`p-1.5 rounded border transition-colors shrink-0 cursor-pointer ${
                            isSaved
                              ? 'bg-[#2c2052] text-[#ffd166] border-[#ffd166]/60'
                              : 'bg-[#150f29] text-[#9f8ec7] border-[#35285b] hover:text-[#faf7ff] hover:border-[#ff6ea8]/60'
                          }`}
                        >
                          <BookmarkIcon className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {filteredTips.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTips((prev) => !prev)}
                    className="w-full py-1.5 text-xs font-semibold text-[#38e8ff] bg-[#191233] border border-[#35285b] rounded-md hover:bg-[#221942] transition-colors cursor-pointer"
                  >
                    {showAllTips
                      ? 'Show fewer tips'
                      : `Show all ${filteredTips.length} matching tips`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CARD: BMI CALCULATOR */}
        <div
          id="section-bmi-calculator"
          className="bg-[#150f29]/95 border border-[#35285b] rounded-lg overflow-hidden shadow-[0_14px_40px_rgba(7,3,18,0.55)]"
        >
          <div className="h-[3px] w-full vice-horizon-line" aria-hidden="true" />

          <div className="p-5 space-y-4">
            {/* Header + Unit Toggle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#faf7ff] leading-none">
                  BMI Calculator
                </h2>

                <div
                  role="group"
                  aria-label="BMI measurement units"
                  className="inline-flex p-0.5 bg-[#110c23] border border-[#35285b] rounded-md shrink-0"
                >
                  <button
                    type="button"
                    aria-pressed={bmiState.unit === 'metric'}
                    onClick={() => handleSwitchUnit('metric')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                      bmiState.unit === 'metric'
                        ? 'vice-sunset-btn'
                        : 'text-[#c5b8e3] hover:text-[#faf7ff]'
                    }`}
                  >
                    Metric
                  </button>
                  <button
                    type="button"
                    aria-pressed={bmiState.unit === 'imperial'}
                    onClick={() => handleSwitchUnit('imperial')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                      bmiState.unit === 'imperial'
                        ? 'vice-sunset-btn'
                        : 'text-[#c5b8e3] hover:text-[#faf7ff]'
                    }`}
                  >
                    Imperial
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#b5a7d6]">
                Check Body Mass Index, healthy weight range, and suggested daily
                macro targets.
              </p>
            </div>

            {/* Measurement Inputs */}
            {bmiState.unit === 'metric' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="bmi-height-cm"
                    className="block text-xs font-medium text-[#d4c8ef] mb-1"
                  >
                    Height (cm)
                  </label>
                  <input
                    id="bmi-height-cm"
                    type="number"
                    min={100}
                    max={250}
                    step={1}
                    value={bmiState.heightCm}
                    onChange={(e) =>
                      onChangeBmiState((prev) => ({
                        ...prev,
                        heightCm: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md font-mono tabular-nums focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bmi-weight-kg"
                    className="block text-xs font-medium text-[#d4c8ef] mb-1"
                  >
                    Weight (kg)
                  </label>
                  <input
                    id="bmi-weight-kg"
                    type="number"
                    min={30}
                    max={300}
                    step={0.5}
                    value={bmiState.weightKg}
                    onChange={(e) =>
                      onChangeBmiState((prev) => ({
                        ...prev,
                        weightKg: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md font-mono tabular-nums focus:outline-none focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee]"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="bmi-height-ft"
                    className="block text-xs font-medium text-[#d4c8ef] mb-1"
                  >
                    Height (ft)
                  </label>
                  <input
                    id="bmi-height-ft"
                    type="number"
                    min={3}
                    max={8}
                    step={1}
                    value={bmiState.feet}
                    onChange={(e) =>
                      onChangeBmiState((prev) => ({ ...prev, feet: e.target.value }))
                    }
                    className="w-full h-10 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md font-mono tabular-nums focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bmi-height-in"
                    className="block text-xs font-medium text-[#d4c8ef] mb-1"
                  >
                    Height (in)
                  </label>
                  <input
                    id="bmi-height-in"
                    type="number"
                    min={0}
                    max={11}
                    step={1}
                    value={bmiState.inches}
                    onChange={(e) =>
                      onChangeBmiState((prev) => ({
                        ...prev,
                        inches: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md font-mono tabular-nums focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bmi-weight-lbs"
                    className="block text-xs font-medium text-[#d4c8ef] mb-1"
                  >
                    Weight (lb)
                  </label>
                  <input
                    id="bmi-weight-lbs"
                    type="number"
                    min={66}
                    max={660}
                    step={1}
                    value={bmiState.weightLbs}
                    onChange={(e) =>
                      onChangeBmiState((prev) => ({
                        ...prev,
                        weightLbs: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md font-mono tabular-nums focus:outline-none focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee]"
                  />
                </div>
              </div>
            )}

            {/* BMI Result Display */}
            {!bmiResult.valid ? (
              <div
                role="alert"
                className="p-3 text-xs text-[#fda4af] bg-[#3b1224] border border-[#881337] rounded-md"
              >
                {bmiResult.error}
              </div>
            ) : (
              <div
                data-testid="bmi-result-card"
                className="p-4 rounded-lg bg-[#110c23] border border-[#35285b] space-y-4"
              >
                {/* Main Readout */}
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-medium text-[#9f8ec7]">
                      Your Body Mass Index
                    </div>
                    <div className="flex items-baseline gap-2.5 mt-0.5">
                      <span
                        data-testid="bmi-value"
                        className="text-3xl font-extrabold font-mono tabular-nums text-[#faf7ff]"
                      >
                        {bmiResult.bmi.toFixed(1)}
                      </span>
                      <span
                        data-testid="bmi-category"
                        className={`text-sm font-bold ${getCategoryColorClass(bmiResult.category)}`}
                      >
                        {bmiResult.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#9f8ec7]">
                      Healthy Weight Range
                    </div>
                    <div className="text-xs font-mono font-semibold tabular-nums text-[#e6ddf8] mt-0.5">
                      {bmiState.unit === 'metric'
                        ? `${bmiResult.healthyWeightMinKg} – ${bmiResult.healthyWeightMaxKg} kg`
                        : `${bmiResult.healthyWeightMinLbs} – ${bmiResult.healthyWeightMaxLbs} lb`}
                    </div>
                  </div>
                </div>

                {/* 4-Zone Visual BMI Spectrum Gauge */}
                <div className="space-y-1.5">
                  <div
                    role="meter"
                    aria-label="BMI scale position"
                    aria-valuemin={15}
                    aria-valuemax={40}
                    aria-valuenow={bmiResult.bmi}
                    className="relative h-2.5 w-full rounded-full overflow-visible bg-[#241a42]"
                  >
                    <div className="h-full w-full rounded-full overflow-hidden flex">
                      {/* 15 -> 18.5 = 14% */}
                      <div className="h-full bg-[#22d3ee]" style={{ width: '14%' }} />
                      {/* 18.5 -> 25 = 26% */}
                      <div className="h-full bg-[#34d399]" style={{ width: '26%' }} />
                      {/* 25 -> 30 = 20% */}
                      <div className="h-full bg-[#ffd166]" style={{ width: '20%' }} />
                      {/* 30 -> 40 = 40% */}
                      <div
                        className="h-full bg-gradient-to-r from-[#ff6b4a] to-[#ff2e93]"
                        style={{ width: '40%' }}
                      />
                    </div>
                    <div
                      aria-hidden="true"
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#faf7ff] border-2 border-[#110c23] shadow-[0_0_10px_rgba(255,255,255,0.85)] transition-all duration-300"
                      style={{ left: `${bmiResult.scalePercent}%` }}
                    />
                  </div>
                  <div className="relative h-4 text-[10px] font-mono tabular-nums text-[#9f8ec7]">
                    <span className="absolute left-0">15</span>
                    <span
                      className="absolute -translate-x-1/2 text-[#34d399]"
                      style={{ left: '14%' }}
                    >
                      18.5
                    </span>
                    <span
                      className="absolute -translate-x-1/2 text-[#ffd166]"
                      style={{ left: '40%' }}
                    >
                      25
                    </span>
                    <span
                      className="absolute -translate-x-1/2 text-[#ff6ea8]"
                      style={{ left: '60%' }}
                    >
                      30
                    </span>
                    <span className="absolute right-0">40</span>
                  </div>
                </div>

                {/* Practical Coaching Note */}
                <p className="text-xs text-[#c5b8e3] leading-relaxed">
                  {bmiResult.guidance}
                </p>

                {/* Optional Suggested Daily Targets Sync */}
                <div className="pt-3 border-t border-[#2d2150] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#faf7ff]">
                      Suggested Daily Targets
                    </span>
                    <div
                      role="group"
                      aria-label="Target nutrition goal"
                      className="inline-flex gap-1"
                    >
                      {(
                        [
                          ['fat-loss', 'Fat Loss'],
                          ['maintain', 'Maintain'],
                          ['lean-bulk', 'Lean Bulk'],
                        ] as const
                      ).map(([goalId, label]) => (
                        <button
                          key={goalId}
                          type="button"
                          aria-pressed={bmiState.goal === goalId}
                          onClick={() =>
                            onChangeBmiState((prev) => ({ ...prev, goal: goalId }))
                          }
                          className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                            bmiState.goal === goalId
                              ? 'bg-[#2c2052] text-[#38e8ff] border-[#38e8ff]/55'
                              : 'bg-[#17112e] text-[#b5a7d6] border-[#2d2150] hover:text-[#faf7ff]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-mono tabular-nums text-[#e6ddf8]">
                      <span className="font-bold text-[#ff6ea8]">
                        {bmiResult.suggestedCalories.toLocaleString('en-US')}{' '}
                        kcal
                      </span>
                      <span aria-hidden="true" className="mx-1.5 text-[#5b478a]">
                        ·
                      </span>
                      <span className="font-bold text-[#38e8ff]">
                        {bmiResult.suggestedProtein}g protein
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onApplyMacroTargets(
                          bmiResult.suggestedCalories,
                          bmiResult.suggestedProtein,
                        )
                      }
                      className="px-3 h-8 text-xs font-bold rounded-md vice-sunset-btn transition-all whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Apply Targets to Plan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
