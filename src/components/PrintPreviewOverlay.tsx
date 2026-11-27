import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  ChecklistCategory,
  DayIndex,
  MealSlot,
  WeeklyPlan,
} from '../types/plan';
import type { CoachSelection } from '../utils/coachLogic';
import {
  PAPER_SPECS,
  estimatePrintPageFit,
  type PrintPaperSize,
} from '../utils/printPreviewLogic';
import { CommandSheet } from './CommandSheet';
import { CloseIcon, PrinterIcon } from './Icons';

interface PrintPreviewOverlayProps {
  isOpen: boolean;
  plan: WeeklyPlan;
  selectedDayIndex: DayIndex;
  onClose: () => void;
  onPrint: () => void;
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

export function PrintPreviewOverlay({
  isOpen,
  plan,
  selectedDayIndex,
  onClose,
  onPrint,
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
}: PrintPreviewOverlayProps) {
  const [paperSize, setPaperSize] = useState<PrintPaperSize>('letter');
  const [showMarginGuides, setShowMarginGuides] = useState(true);
  const [sheetHeightPx, setSheetHeightPx] = useState<number>(0);

  const paperRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const paperSpec = PAPER_SPECS[paperSize];
  const pageFit = estimatePrintPageFit(sheetHeightPx, paperSpec);

  // Lock page background scroll and bind Escape key while Print Preview is active
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    closeBtnRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Measure rendered paper height to display live page-fit estimate & page break guide
  useLayoutEffect(() => {
    if (!isOpen || !paperRef.current) return;
    const node = paperRef.current;

    const measure = () => {
      setSheetHeightPx(node.scrollHeight);
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen, paperSize, plan]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print Preview"
      data-testid="print-preview-overlay"
      className="no-print print-preview-overlay fixed inset-0 z-50 flex flex-col bg-[#080512]/95 backdrop-blur-md"
    >
      {/* Sticky Print Preview Control Toolbar */}
      <header className="shrink-0 bg-[#120c24] border-b border-[#35285b] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#231845] border border-[#38e8ff]/50 text-[#38e8ff] shrink-0">
              <PrinterIcon className="w-4 h-4" />
            </span>
            <h2 className="font-display text-lg sm:text-xl font-bold uppercase tracking-wide text-[#faf7ff] whitespace-nowrap">
              Print Preview
            </h2>
          </div>

          <span className="text-xs font-mono text-[#c5b8e3] whitespace-nowrap">
            {paperSpec.label} ({paperSpec.dimensionsLabel} ·{' '}
            {paperSpec.marginLabel})
          </span>

          <span
            data-testid="print-page-fit-status"
            className={`text-xs font-mono font-semibold whitespace-nowrap ${
              pageFit.fitsSinglePage ? 'text-[#34d399]' : 'text-[#ffd166]'
            }`}
          >
            · {pageFit.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Paper Format Switcher */}
          <div
            role="group"
            aria-label="Preview paper size"
            className="inline-flex p-0.5 bg-[#0d081c] border border-[#35285b] rounded-md"
          >
            {(['letter', 'a4'] as const).map((sizeId) => {
              const active = paperSize === sizeId;
              return (
                <button
                  key={sizeId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPaperSize(sizeId)}
                  className={`px-2.5 h-7 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#2a1f4d] text-[#38e8ff]'
                      : 'text-[#b5a7d6] hover:text-[#faf7ff]'
                  }`}
                >
                  {PAPER_SPECS[sizeId].label}
                </button>
              );
            })}
          </div>

          {/* Margin Guide Toggle */}
          <button
            type="button"
            aria-pressed={showMarginGuides}
            onClick={() => setShowMarginGuides((prev) => !prev)}
            className={`px-2.5 h-8 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
              showMarginGuides
                ? 'bg-[#21183e] text-[#ffd166] border-[#ffd166]/50'
                : 'bg-[#17112e] text-[#b5a7d6] border-[#35285b] hover:text-[#faf7ff]'
            }`}
          >
            Margin Guides
          </button>

          {/* Physical Print Trigger */}
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-3.5 h-8 text-xs font-bold vice-sunset-btn rounded-md transition-all whitespace-nowrap cursor-pointer"
          >
            <PrinterIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Print / Save PDF</span>
          </button>

          {/* Exit Preview */}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-semibold text-[#ede7fc] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] hover:border-[#ff4fa3]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38e8ff] transition-colors whitespace-nowrap cursor-pointer"
          >
            <CloseIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Exit Preview</span>
          </button>
        </div>
      </header>

      {/* Scrollable Paper Desk Canvas */}
      <div
        className="flex-1 overflow-auto px-4 sm:px-8 py-6 sm:py-8"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="mx-auto flex flex-col items-center gap-3"
          style={{ maxWidth: `${paperSpec.widthPx}px` }}
        >
          {/* Physical Paper Sheet Simulation */}
          <div
            ref={paperRef}
            data-testid="print-preview-paper"
            data-paper-size={paperSize}
            className={`print-preview-paper relative w-full bg-white text-[#0f172a] shadow-[0_24px_70px_rgba(0,0,0,0.75)] ring-1 ring-slate-300/80 ${
              showMarginGuides ? 'print-preview-margins-visible' : ''
            }`}
            style={{
              width: `${paperSpec.widthPx}px`,
              maxWidth: '100%',
              minHeight: `${paperSpec.pageHeightPx}px`,
            }}
          >
            <div className="print-preview-sheet">
              <CommandSheet
                plan={plan}
                selectedDayIndex={selectedDayIndex}
                activeCoachSelection={null}
                isPrintPreview
                onSelectDay={onSelectDay}
                onInspectWithCoach={onInspectWithCoach}
                onToggleMealCompleted={onToggleMealCompleted}
                onToggleWorkoutCompleted={onToggleWorkoutCompleted}
                onUpdateExtraIntake={onUpdateExtraIntake}
                onResetDayProgress={onResetDayProgress}
                onLoadSampleWeek={onLoadSampleWeek}
                onClearWeekProgress={onClearWeekProgress}
                onToggleChecklistItem={onToggleChecklistItem}
                onAddChecklistItem={onAddChecklistItem}
                onRemoveChecklistItem={onRemoveChecklistItem}
                onDeleteChecklistItems={onDeleteChecklistItems}
                onMoveChecklistItems={onMoveChecklistItems}
                onAutoGenerateChecklist={onAutoGenerateChecklist}
                onSortChecklist={onSortChecklist}
              />
            </div>

            {/* Page-1 Boundary Indicator if content exceeds one physical page */}
            {!pageFit.fitsSinglePage && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-amber-500/85 flex justify-end pr-3"
                style={{ top: `${paperSpec.pageHeightPx}px` }}
              >
                <span className="-mt-2.5 bg-amber-100 text-amber-900 border border-amber-400 px-2 py-0.5 text-[10px] font-mono font-semibold rounded">
                  Page 1 Break ({paperSpec.dimensionsLabel})
                </span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#a698c9] text-center">
            Ink-saving print layout · Interactive editor panels and buttons are
            hidden automatically · Press Esc to exit
          </p>
        </div>
      </div>
    </div>
  );
}
