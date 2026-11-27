import { PrinterIcon } from './Icons';

interface TopBarProps {
  onPrint: () => void;
  onJumpToSection: (sectionId: string) => void;
}

export function TopBar({ onPrint, onJumpToSection }: TopBarProps) {
  return (
    <header className="no-print sticky top-0 z-20 bg-[#110b22]/90 backdrop-blur-md border-b border-[#34265c]">
      <div className="max-w-[1440px] mx-auto px-3.5 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-8">
        {/* Zone 1: Single-line Wordmark */}
        <a
          href="#weekly-command-sheet"
          onClick={(e) => {
            e.preventDefault();
            onJumpToSection('weekly-command-sheet');
          }}
          className="font-display text-xl sm:text-2xl font-extrabold tracking-wide vice-gradient-text whitespace-nowrap min-w-0 truncate"
        >
          Weekly Training &amp; Meal Prep
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Workspace sections"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#c5b8e3] shrink-0"
        >
          <button
            type="button"
            onClick={() => onJumpToSection('section-weekly-snapshot')}
            className="hover:text-[#ffd166] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Snapshot
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('section-ai-adjuster')}
            className="hover:text-[#ffd166] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            AI Adjuster
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('section-training-split')}
            className="hover:text-[#ffd166] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Training
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('section-meals-prep')}
            className="hover:text-[#ffd166] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Meals
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('section-checklist')}
            className="hover:text-[#ffd166] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Checklist
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('section-workout-visual')}
            className="hover:text-[#ffd166] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Visuals
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('section-tips-bmi')}
            className="hover:text-[#ffd166] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tips &amp; BMI
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold vice-sunset-btn rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22d3ee] transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PrinterIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
}
