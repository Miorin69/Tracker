import { VISUAL_ASSETS } from '../data/visualAssets';
import { CloseIcon } from './Icons';
import { ResilientImage } from './ResilientImage';

interface WelcomeBannerProps {
  onDismiss: () => void;
  onJumpToSection: (sectionId: string) => void;
  onOpenCoach: () => void;
}

const FEATURE_STEPS = [
  {
    number: '01.',
    title: 'Splits & Auto Warm-ups',
    description:
      'Pick Push/Pull/Legs, Upper/Lower, or Full Body with muscle-group warm-ups matched automatically to every lift day.',
  },
  {
    number: '02.',
    title: 'AI Training & Veg Adjuster',
    description:
      'Tell the planner to tweak volume, shorten busy days, or convert full weeks or specific days to high-protein vegetarian.',
  },
  {
    number: '03.',
    title: 'Coach Hishay On-Demand',
    description:
      'Click any exercise or meal right on the weekly sheet for form cues, progression advice, macro estimates, and swaps.',
  },
  {
    number: '04.',
    title: 'Print, Share & Go Offline',
    description:
      'Check off meals, workouts, prep steps, and groceries, save reusable presets locally, or export to PDF, Markdown, JSON, or HTML.',
  },
] as const;

export function WelcomeBanner({
  onDismiss,
  onJumpToSection,
  onOpenCoach,
}: WelcomeBannerProps) {
  return (
    <section
      id="welcome-banner"
      aria-label="Welcome and Quick-Start Guide"
      className="no-print max-w-[1440px] mx-auto px-4 sm:px-6 pt-5"
    >
      <div className="bg-[#16102b]/95 border border-[#35285b] rounded-lg overflow-hidden">
        {/* Top 2-Column Editorial Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Column: Welcome Copy & 4-Step Feature Guide */}
          <div className="lg:col-span-7 xl:col-span-7 p-5 sm:p-7 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-[#b7a8d9]">
                  <span className="text-[#ff7a45]">Welcome, training partners</span>
                  <span aria-hidden="true" className="mx-1.5 text-[#5b478a]">
                    ·
                  </span>
                  <span>Offline-ready</span>
                  <span aria-hidden="true" className="mx-1.5 text-[#5b478a]">
                    ·
                  </span>
                  <span>Single-page printable sheet</span>
                </p>
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Hide welcome guide"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#b7a8d9] hover:text-white hover:bg-[#251a46] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Hide guide</span>
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-[#f7f7f7] border border-[#ffd166]/65 shadow-[0_8px_24px_rgba(0,0,0,0.45)] shrink-0 mt-0.5">
                  <ResilientImage
                    src={VISUAL_ASSETS.appLogoMascot}
                    alt="Prep Split Fit Duck mascot crest"
                    fallbackLabel="Prep Split"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
                <div className="space-y-2 min-w-0">
                  <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wide text-[#faf7ff] leading-[1.08] [text-wrap:balance] max-w-2xl">
                    One weekly command sheet for your lifts, warm-ups, and meal prep.
                  </h1>
                  <p className="text-sm text-[#c5b8e3] leading-relaxed max-w-2xl">
                    Set your calorie and protein targets on the left, tailor your
                    workouts and staple meals, and watch your printable 7-day plan
                    and adherence tracker update live on the right.
                  </p>
                </div>
              </div>
            </div>

            {/* 4-Step Feature Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 pt-4 border-t border-[#2d2150]">
              {FEATURE_STEPS.map((step) => (
                <div key={step.number} className="space-y-0.5">
                  <h2 className="text-xs font-semibold text-[#faf7ff]">
                    <span className="font-mono text-[#ff6ea8] mr-1.5 tabular-nums">
                      {step.number}
                    </span>
                    {step.title}
                  </h2>
                  <p className="text-xs text-[#b7a8d9] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Primary & Secondary Quick-Start Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onJumpToSection('section-training-split')}
                className="inline-flex items-center justify-center px-4 h-9 text-xs font-bold vice-sunset-btn rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22d3ee] transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                Customize My Week
              </button>
              <button
                type="button"
                onClick={() => onJumpToSection('section-ai-adjuster')}
                className="inline-flex items-center justify-center px-3.5 h-9 text-xs font-medium text-[#ede7fc] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] hover:border-[#ff4fa3]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22d3ee] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Try AI Adjuster
              </button>
              <button
                type="button"
                onClick={onOpenCoach}
                className="inline-flex items-center justify-center px-2.5 h-9 text-xs font-semibold text-[#22d3ee] hover:text-[#67e8f9] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Meet Coach Hishay
              </button>
            </div>
          </div>

          {/* Right Column: Athletic Editorial Photography & Coach Spotlight */}
          <div className="lg:col-span-5 xl:col-span-5 relative min-h-[220px] sm:min-h-[260px] lg:min-h-0 bg-[#0d081c] border-t lg:border-t-0 lg:border-l border-[#35285b]">
            <ResilientImage
              src={VISUAL_ASSETS.heroGymPrep}
              alt="Athlete performing a barbell back squat in a sunlit strength training studio"
              fallbackLabel="Strength Training Studio"
              className="w-full h-full object-cover object-center lg:absolute lg:inset-0"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#120924]/95 via-[#240e3b]/40 to-[#ff2e93]/10"
            />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex items-end justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ResilientImage
                  src={VISUAL_ASSETS.coachAvatar}
                  alt="Coach Hishay portrait"
                  fallbackLabel="CH"
                  className="w-10 h-10 rounded-full object-cover object-top border border-[#22d3ee]/60 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white tracking-wide truncate">
                    Coach Hishay · CSCS &amp; Nutritionist
                  </p>
                  <p className="text-xs text-[#d6cbef] truncate">
                    Tap any lift or meal below for instant coaching cues
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenCoach}
                className="px-3 py-1.5 text-xs font-bold vice-sunset-btn rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ask Coach
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Visual Quick-Jump Strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#2d2150] border-t border-[#2d2150] bg-[#100a20]/85">
          <button
            type="button"
            onClick={() => onJumpToSection('section-training-split')}
            className="group flex items-center gap-4 p-3.5 sm:px-5 text-left hover:bg-[#1e153a] transition-colors cursor-pointer"
          >
            <div className="w-24 sm:w-28 aspect-[4/3] rounded-md overflow-hidden border border-[#35285b] shrink-0 bg-[#0d081c]">
              <ResilientImage
                src={VISUAL_ASSETS.strengthTraining}
                alt="Loaded barbell with matte charcoal plates and lifting chalk"
                fallbackLabel="Training"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-xs font-semibold text-[#faf7ff] group-hover:text-[#ffd166] transition-colors">
                Strength Splits &amp; Muscle-Matched Warm-ups
              </div>
              <p className="text-xs text-[#b7a8d9] leading-snug">
                Switch between 3-day, 4-day, or 6-day splits and customize daily
                lifts, durations, and targeted 5-minute warm-ups.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onJumpToSection('section-meals-prep')}
            className="group flex items-center gap-4 p-3.5 sm:px-5 text-left hover:bg-[#1e153a] transition-colors cursor-pointer"
          >
            <div className="w-24 sm:w-28 aspect-[4/3] rounded-md overflow-hidden border border-[#35285b] shrink-0 bg-[#0d081c]">
              <ResilientImage
                src={VISUAL_ASSETS.mealPrep}
                alt="Glass meal prep containers with grilled chicken, rice, broccoli, tofu stir-fry, and berry oat bowls"
                fallbackLabel="Meal Prep"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-xs font-semibold text-[#faf7ff] group-hover:text-[#22d3ee] transition-colors">
                High-Protein &amp; Vegetarian Meal Prep
              </div>
              <p className="text-xs text-[#b7a8d9] leading-snug">
                Set staple meals, override specific vegetarian days, and
                auto-sync your weekly prep steps and grocery checklist.
              </p>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
