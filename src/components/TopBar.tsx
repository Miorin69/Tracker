import { VISUAL_ASSETS } from '../data/visualAssets';
import type { LocalProfile } from '../utils/localProfileLogic';
import { PrinterIcon } from './Icons';
import { ProfileMenu } from './ProfileMenu';
import { ResilientImage } from './ResilientImage';

interface TopBarProps {
  profiles: LocalProfile[];
  activeProfile: LocalProfile;
  onSelectProfile: (id: string) => void;
  onAddProfile: (name: string) => { ok: boolean; error?: string };
  onRenameProfile: (id: string, name: string) => { ok: boolean; error?: string };
  onDeleteProfile: (id: string) => { ok: boolean; error?: string };
  onPrint: () => void;
  onJumpToSection: (sectionId: string) => void;
}

export function TopBar({
  profiles,
  activeProfile,
  onSelectProfile,
  onAddProfile,
  onRenameProfile,
  onDeleteProfile,
  onPrint,
  onJumpToSection,
}: TopBarProps) {
  return (
    <header className="no-print sticky top-0 z-20 bg-[#110b22]/90 backdrop-blur-md border-b border-[#34265c]">
      <div className="max-w-[1440px] mx-auto px-3.5 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Brand Logo & Single-line Wordmark */}
        <a
          href="#weekly-command-sheet"
          onClick={(e) => {
            e.preventDefault();
            onJumpToSection('weekly-command-sheet');
          }}
          className="inline-flex items-center gap-2.5 min-w-0 group"
        >
          <span className="w-9 h-9 rounded-lg overflow-hidden bg-[#f7f7f7] border border-[#ffd166]/65 shrink-0 block">
            <ResilientImage
              src={VISUAL_ASSETS.appLogoMascot}
              alt="Prep Split Fit Duck logo"
              fallbackLabel="PS"
              className="w-full h-full object-cover object-center"
            />
          </span>
          <span className="font-display text-lg sm:text-xl xl:text-2xl font-extrabold tracking-wide vice-gradient-text whitespace-nowrap truncate">
            Weekly Training &amp; Meal Prep
          </span>
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Workspace sections"
          className="hidden lg:flex items-center gap-5 text-sm font-medium text-[#c5b8e3] shrink-0"
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

        {/* Zone 3: Local Profile Switcher & Print Action */}
        <div className="flex items-center gap-2 shrink-0">
          <ProfileMenu
            profiles={profiles}
            activeProfile={activeProfile}
            onSelectProfile={onSelectProfile}
            onAddProfile={onAddProfile}
            onRenameProfile={onRenameProfile}
            onDeleteProfile={onDeleteProfile}
          />
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 h-8 sm:h-9 text-xs sm:text-sm font-bold vice-sunset-btn rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22d3ee] transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PrinterIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Print / Save PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
}
