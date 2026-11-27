import { useEffect, useRef, useState } from 'react';
import type { DayIndex, WeeklyPlan } from '../types/plan';
import {
  buildCoachCacheKey,
  parseExercisesFromText,
} from '../utils/coachLogic';
import type {
  CoachBrief,
  CoachSelection,
  MealSlotKey,
} from '../utils/coachLogic';
import { VISUAL_ASSETS } from '../data/visualAssets';
import { fetchJsonWithRetry } from '../utils/apiFetch';
import type { ChatMessage } from '../utils/chatLogic';
import { getEffectiveDayMeals } from '../utils/planLogic';
import { ChatThread } from './ChatThread';
import { CloseIcon } from './Icons';
import { ResilientImage } from './ResilientImage';

const COACH_CHAT_STARTERS: readonly string[] = [
  'Review my current weekly split for recovery gaps',
  'How can I hit my daily protein target on vegetarian days?',
  'Give me a 5-min mobility warm-up for tight hips before legs',
];

interface CoachDrawerProps {
  isOpen: boolean;
  plan: WeeklyPlan;
  selectedDayIndex: DayIndex;
  selection: CoachSelection | null;
  onSelectItem: (item: CoachSelection) => void;
  onClose: () => void;
}

const MEAL_SLOT_LABELS: Record<MealSlotKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Pre / Post Snack',
};

const COACH_SESSION_CACHE_KEY = 'wtm_coach_brief_cache_v1';

function readSessionBriefCache(): Map<string, CoachBrief> {
  const map = new Map<string, CoachBrief>();
  try {
    const raw = window.sessionStorage.getItem(COACH_SESSION_CACHE_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw) as Record<string, CoachBrief>;
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        if (value && typeof value === 'object' && typeof value.headline === 'string') {
          map.set(key, value);
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return map;
}

function writeSessionBriefCache(map: Map<string, CoachBrief>): void {
  try {
    const entries = Array.from(map.entries()).slice(-60);
    window.sessionStorage.setItem(
      COACH_SESSION_CACHE_KEY,
      JSON.stringify(Object.fromEntries(entries)),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function CoachDrawer({
  isOpen,
  plan,
  selectedDayIndex,
  selection,
  onSelectItem,
  onClose,
}: CoachDrawerProps) {
  const [activeTab, setActiveTab] = useState<'brief' | 'chat'>('brief');
  const [brief, setBrief] = useState<CoachBrief | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedFollowUp, setFailedFollowUp] = useState<string | null>(null);
  const [questionInput, setQuestionInput] = useState('');
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatSending, setIsChatSending] = useState(false);
  const [isChatRetrying, setIsChatRetrying] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [failedChatPrompt, setFailedChatPrompt] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, CoachBrief> | null>(null);
  if (!cacheRef.current) {
    cacheRef.current = readSessionBriefCache();
  }
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const activeDayIndex = (selection?.dayIndex ?? selectedDayIndex) as DayIndex;
  const activeDay = plan.days[activeDayIndex] ?? plan.days[0];
  const activeDayExercises = parseExercisesFromText(activeDay.exercises);
  const activeDayMeals = getEffectiveDayMeals(plan, activeDay);

  const fetchCoachBrief = async (
    target: CoachSelection,
    followUpQuestion?: string,
  ) => {
    const cacheKey = buildCoachCacheKey(target);

    if (!followUpQuestion) {
      const cached = cacheRef.current?.get(cacheKey);
      if (cached) {
        setBrief(cached);
        setErrorMessage(null);
        setFailedFollowUp(null);
        setIsLoading(false);
        return;
      }
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setErrorMessage(null);
    setFailedFollowUp(null);
    setIsRetrying(false);
    if (followUpQuestion) {
      setIsAskingFollowUp(true);
    } else {
      setBrief(null);
      setIsLoading(true);
    }

    try {
      const result = await fetchJsonWithRetry<{
        brief?: CoachBrief;
        error?: string;
        retryable?: boolean;
      }>('/api/ai/coach-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        maxRetries: 1,
        baseDelayMs: 900,
        onRetry: () => setIsRetrying(true),
        body: JSON.stringify({
          selection: target,
          planContext: {
            caloriesTarget: plan.caloriesTarget,
            proteinTarget: plan.proteinTarget,
            prepTimeLimit: plan.prepTimeLimit,
            holidayTag: plan.holidayTag,
          },
          followUpQuestion,
        }),
      });

      if (!result.ok || !result.data?.brief) {
        setErrorMessage(
          result.error || 'Could not load coaching notes. Please try again.',
        );
        if (followUpQuestion) {
          setFailedFollowUp(followUpQuestion);
        }
        return;
      }

      if (!followUpQuestion && cacheRef.current) {
        cacheRef.current.set(cacheKey, result.data.brief);
        writeSessionBriefCache(cacheRef.current);
      }
      setBrief(result.data.brief);
      if (followUpQuestion) {
        setQuestionInput('');
        bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setErrorMessage(
        'Network error reaching Coach Hishay. Please try again.',
      );
      if (followUpQuestion) {
        setFailedFollowUp(followUpQuestion);
      }
    } finally {
      if (abortRef.current === controller) {
        setIsLoading(false);
        setIsAskingFollowUp(false);
        setIsRetrying(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!selection) {
      setActiveTab('chat');
      return;
    }
    setActiveTab('brief');
    setQuestionInput('');
    setQuestionError(null);
    setFailedFollowUp(null);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    void fetchCoachBrief(selection);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    selection?.kind,
    selection?.dayIndex,
    selection?.mealSlot,
    selection?.title,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selection) return;
    const trimmed = questionInput.trim();
    if (!trimmed) {
      setQuestionError('Enter a question for Coach Hishay.');
      return;
    }
    setQuestionError(null);
    void fetchCoachBrief(selection, trimmed);
  };

  const handleSendChatMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isChatSending) return;

    const priorHistory = chatMessages.map((m) => ({
      role: m.role,
      text: m.text,
    }));
    const userMsg: ChatMessage = {
      id: `coach-u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatError(null);
    setFailedChatPrompt(null);
    setIsChatSending(true);
    setIsChatRetrying(false);

    try {
      const result = await fetchJsonWithRetry<{
        reply?: string;
        error?: string;
        retryable?: boolean;
      }>('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        maxRetries: 1,
        baseDelayMs: 900,
        onRetry: () => setIsChatRetrying(true),
        body: JSON.stringify({
          persona: 'coach',
          message: trimmed,
          history: priorHistory,
          currentPlan: plan,
          selection,
        }),
      });

      if (!result.ok || !result.data?.reply) {
        setChatMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setChatError(
          result.error || 'Could not reach Coach Hishay right now. Please try again.',
        );
        setFailedChatPrompt(trimmed);
        return;
      }

      const replyMsg: ChatMessage = {
        id: `coach-m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'model',
        text: result.data.reply,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, replyMsg]);
    } catch {
      setChatMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setChatError('Network error reaching Coach Hishay. Please try again.');
      setFailedChatPrompt(trimmed);
    } finally {
      setIsChatSending(false);
      setIsChatRetrying(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setChatError(null);
    setFailedChatPrompt(null);
  };

  return (
    <aside
      id="coach-drawer"
      aria-label="Coach Hishay — Trainer and Nutritionist"
      className="no-print fixed inset-y-0 right-0 z-40 w-full sm:w-[430px] bg-[#150f29] text-[#f6f2ff] border-l border-[#35285b] shadow-[0_0_48px_rgba(7,3,18,0.85)] flex flex-col"
    >
      {/* Persona Header */}
      <div className="relative px-5 py-4 bg-[#100a20] text-[#faf7ff] flex items-start justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <ResilientImage
            src={VISUAL_ASSETS.coachAvatar}
            alt="Coach Hishay portrait"
            fallbackLabel="CH"
            className="w-11 h-11 rounded-full object-cover object-top border border-[#ff6ea8]/60 shrink-0"
          />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider text-[#faf7ff] leading-tight truncate">
              Coach Hishay
            </h2>
            <p className="text-xs text-[#c5b8e3] truncate">
              Strength Coach (CSCS) · Sports Nutritionist
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Coach Hishay panel"
          className="p-1.5 text-[#c5b8e3] hover:text-[#faf7ff] hover:bg-[#241a46] rounded-md transition-colors cursor-pointer shrink-0"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
        <div className="vice-horizon-line absolute inset-x-0 bottom-0" />
      </div>

      {/* Mode Tabs */}
      <div
        role="tablist"
        aria-label="Coach Hishay modes"
        className="grid grid-cols-2 border-b border-[#2d2150] bg-[#110c23] shrink-0"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'brief'}
          onClick={() => setActiveTab('brief')}
          className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'brief'
              ? 'border-[#ff4fa3] text-[#faf7ff] bg-[#1b1436]'
              : 'border-transparent text-[#9f8ec7] hover:text-[#e6ddf8]'
          }`}
        >
          Item Brief
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
          className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'chat'
              ? 'border-[#22d3ee] text-[#faf7ff] bg-[#1b1436]'
              : 'border-transparent text-[#9f8ec7] hover:text-[#e6ddf8]'
          }`}
        >
          Coach Chat{chatMessages.length > 0 ? ` (${chatMessages.length})` : ''}
        </button>
      </div>

      {activeTab === 'chat' ? (
        <div className="flex-1 min-h-0 flex flex-col p-4">
          {selection && (
            <div className="mb-2.5 px-3 py-2 bg-[#1b1436] border border-[#35285b] rounded-md flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <div className="text-[10px] font-medium text-[#9f8ec7]">
                  Active context · {selection.dayName}
                </div>
                <div className="text-xs font-semibold text-[#faf7ff] truncate">
                  {selection.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('brief')}
                className="text-[11px] font-medium text-[#38e8ff] hover:underline underline-offset-2 shrink-0 cursor-pointer"
              >
                View brief
              </button>
            </div>
          )}
          <ChatThread
            messages={chatMessages}
            isSending={isChatSending}
            isRetrying={isChatRetrying}
            errorMessage={chatError}
            assistantName="Coach Hishay"
            placeholder="Ask about form, warm-ups, recovery, or high-protein meals..."
            emptyHeading="Chat with Coach Hishay"
            emptyDescription="Ask multi-turn training, technique, warm-up, or nutrition questions grounded in your active weekly sheet."
            starterPrompts={COACH_CHAT_STARTERS}
            inputId="coach-chat-input"
            inputLabel="Message Coach Hishay"
            threadHeightClass="flex-1 min-h-0"
            onSend={(text) => void handleSendChatMessage(text)}
            onRetry={
              failedChatPrompt
                ? () => void handleSendChatMessage(failedChatPrompt)
                : undefined
            }
            onClear={handleClearChat}
          />
        </div>
      ) : (
      <>
      {/* Scrollable Body */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Selected Item Header */}
        {selection ? (
          <div className="pb-4 border-b border-[#2d2150]">
            <div className="flex items-center gap-2 text-xs text-[#9f8ec7] mb-1">
              <span className="font-semibold text-[#ff6ea8]">
                {selection.kind === 'exercise'
                  ? 'Selected Exercise'
                  : `Selected Meal · ${MEAL_SLOT_LABELS[selection.mealSlot ?? 'lunch']}`}
              </span>
              <span aria-hidden="true">·</span>
              <span>{selection.dayName}</span>
            </div>
            <h3 className="text-base font-bold text-[#faf7ff] leading-snug">
              {selection.title}
            </h3>
          </div>
        ) : (
          <div className="pb-4 border-b border-[#2d2150] space-y-1.5">
            <h3 className="text-sm font-semibold text-[#faf7ff]">
              Select an Exercise or Meal
            </h3>
            <p className="text-xs text-[#c5b8e3] leading-relaxed">
              Click any exercise or meal directly on your Weekly Command Sheet—or
              choose one from {activeDay.dayName} below—for form cues, macro
              estimates, and practical swaps.
            </p>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div
            role="status"
            aria-label="Loading coaching brief"
            className="space-y-3"
          >
            {isRetrying && (
              <p className="text-xs text-[#ffd166]">
                Service busy — retrying automatically...
              </p>
            )}
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-[#2a1f4d] rounded w-2/3" />
              <div className="h-14 bg-[#1f173c] rounded" />
              <div className="h-24 bg-[#1f173c] rounded" />
              <div className="h-16 bg-[#1f173c] rounded" />
            </div>
          </div>
        )}

        {/* Error State */}
        {errorMessage && !isLoading && (
          <div
            role="alert"
            className="p-3 text-xs text-[#fda4af] bg-[#3b1224] border border-[#881337] rounded-md space-y-2"
          >
            <p>{errorMessage}</p>
            {selection && (
              <button
                type="button"
                onClick={() =>
                  void fetchCoachBrief(selection, failedFollowUp ?? undefined)
                }
                className="font-semibold text-[#ffd166] underline underline-offset-2 cursor-pointer"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* Coaching Brief Output */}
        {brief && !isLoading && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[#faf7ff]">
                {brief.headline}
              </h4>
              <p className="text-xs text-[#d4c8ef] leading-relaxed">
                {brief.coachNote}
              </p>
            </div>

            {brief.followUpAnswer && (
              <div className="p-3 bg-[#1b1436] border border-[#3e2f6b] rounded-md space-y-1">
                <div className="text-xs font-semibold text-[#38e8ff]">
                  Coach&apos;s Answer
                </div>
                <p className="text-xs text-[#e6ddf8] leading-relaxed">
                  {brief.followUpAnswer}
                </p>
              </div>
            )}

            {/* EXERCISE BRIEF */}
            {brief.kind === 'exercise' && (
              <>
                {brief.targetMuscles && brief.targetMuscles.length > 0 && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <h5 className="text-xs font-semibold text-[#ffd166] mb-1">
                      Target Muscles
                    </h5>
                    <p className="text-xs text-[#e6ddf8]">
                      {brief.targetMuscles.join(' · ')}
                    </p>
                  </div>
                )}

                {brief.formCues && brief.formCues.length > 0 && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <h5 className="text-xs font-semibold text-[#faf7ff] mb-1.5">
                      Form &amp; Execution Cues
                    </h5>
                    <ul className="space-y-1.5 text-xs text-[#d4c8ef] leading-relaxed list-disc pl-4">
                      {brief.formCues.map((cue, idx) => (
                        <li key={idx}>{cue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.commonMistakes && brief.commonMistakes.length > 0 && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <h5 className="text-xs font-semibold text-[#ff6ea8] mb-1.5">
                      Watch Out For
                    </h5>
                    <ul className="space-y-1.5 text-xs text-[#d4c8ef] leading-relaxed list-disc pl-4">
                      {brief.commonMistakes.map((mistake, idx) => (
                        <li key={idx}>{mistake}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.progressionTip && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <h5 className="text-xs font-semibold text-[#38e8ff] mb-1">
                      Progression Strategy
                    </h5>
                    <p className="text-xs text-[#d4c8ef] leading-relaxed">
                      {brief.progressionTip}
                    </p>
                  </div>
                )}

                {brief.alternatives && brief.alternatives.length > 0 && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <h5 className="text-xs font-semibold text-[#faf7ff] mb-1.5">
                      Smart Alternatives
                    </h5>
                    <ul className="space-y-1 text-xs text-[#d4c8ef] list-disc pl-4">
                      {brief.alternatives.map((alt, idx) => (
                        <li key={idx}>{alt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* MEAL BRIEF */}
            {brief.kind === 'meal' && (
              <>
                {brief.estimatedMacros && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <div className="flex items-baseline justify-between mb-2">
                      <h5 className="text-xs font-semibold text-[#faf7ff]">
                        Estimated Macros
                      </h5>
                      <span className="text-[11px] text-[#9f8ec7]">
                        Approx. per serving
                      </span>
                    </div>
                    <dl className="grid grid-cols-4 gap-2 p-3 bg-[#110c23] border border-[#35285b] rounded-md">
                      <div>
                        <dt className="text-[11px] text-[#9f8ec7]">Calories</dt>
                        <dd className="text-sm font-bold text-[#ff875e] font-mono tabular-nums">
                          {brief.estimatedMacros.calories}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#9f8ec7]">Protein</dt>
                        <dd className="text-sm font-bold text-[#38e8ff] font-mono tabular-nums">
                          {brief.estimatedMacros.proteinGrams}g
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#9f8ec7]">Carbs</dt>
                        <dd className="text-sm font-bold text-[#ffd166] font-mono tabular-nums">
                          {brief.estimatedMacros.carbsGrams}g
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#9f8ec7]">Fat</dt>
                        <dd className="text-sm font-bold text-[#faf7ff] font-mono tabular-nums">
                          {brief.estimatedMacros.fatGrams}g
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}

                {brief.goalFitNote && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <h5 className="text-xs font-semibold text-[#38e8ff] mb-1">
                      Target Fit
                    </h5>
                    <p className="text-xs text-[#d4c8ef] leading-relaxed">
                      {brief.goalFitNote}
                    </p>
                  </div>
                )}

                {brief.timingAndMicros && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <h5 className="text-xs font-semibold text-[#ffd166] mb-1">
                      Timing &amp; Micronutrients
                    </h5>
                    <p className="text-xs text-[#d4c8ef] leading-relaxed">
                      {brief.timingAndMicros}
                    </p>
                  </div>
                )}

                {brief.prepTips && brief.prepTips.length > 0 && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <h5 className="text-xs font-semibold text-[#faf7ff] mb-1.5">
                      Prep &amp; Flavor Tips
                    </h5>
                    <ul className="space-y-1.5 text-xs text-[#d4c8ef] leading-relaxed list-disc pl-4">
                      {brief.prepTips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.smartSwaps && brief.smartSwaps.length > 0 && (
                  <div className="pt-3 border-t border-[#2d2150]">
                    <h5 className="text-xs font-semibold text-[#ff6ea8] mb-1.5">
                      Vegetarian &amp; Macro Swaps
                    </h5>
                    <ul className="space-y-1.5 text-xs text-[#d4c8ef] leading-relaxed list-disc pl-4">
                      {brief.smartSwaps.map((swap, idx) => (
                        <li key={idx}>{swap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="pt-3 border-t border-[#2d2150]">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="text-xs font-semibold text-[#38e8ff] hover:underline underline-offset-2 cursor-pointer"
              >
                Discuss this in Coach Chat &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Quick-Pick Switcher for Active Day */}
        <div className="pt-4 border-t border-[#2d2150] space-y-3">
          <div className="text-xs font-semibold text-[#faf7ff]">
            Inspect {activeDay.dayName} Items
          </div>

          {activeDayExercises.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-[#9f8ec7]">
                Exercises ({activeDay.workoutTitle})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeDayExercises.map((ex, idx) => {
                  const isCurrent =
                    selection?.kind === 'exercise' &&
                    selection.dayIndex === activeDay.dayIndex &&
                    selection.title === ex;
                  return (
                    <button
                      key={`${ex}-${idx}`}
                      type="button"
                      onClick={() =>
                        onSelectItem({
                          kind: 'exercise',
                          dayIndex: activeDay.dayIndex,
                          dayName: activeDay.dayName,
                          title: ex,
                          workoutContext: activeDay.workoutTitle,
                        })
                      }
                      className={`px-2.5 py-1 text-xs rounded border text-left transition-colors cursor-pointer ${
                        isCurrent
                          ? 'vice-sunset-btn border-transparent font-semibold'
                          : 'bg-[#1b1436] text-[#e6ddf8] border-[#35285b] hover:bg-[#261c4b] hover:border-[#ff6ea8]/60'
                      }`}
                    >
                      {ex}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-[11px] font-medium text-[#9f8ec7]">Meals</div>
            <div className="grid grid-cols-1 gap-1.5">
              {(
                ['breakfast', 'lunch', 'dinner', 'snack'] as const
              ).map((slot) => {
                const mealText = activeDayMeals[slot];
                const isCurrent =
                  selection?.kind === 'meal' &&
                  selection.dayIndex === activeDay.dayIndex &&
                  selection.mealSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      onSelectItem({
                        kind: 'meal',
                        dayIndex: activeDay.dayIndex,
                        dayName: activeDay.dayName,
                        mealSlot: slot,
                        title: mealText,
                        workoutContext: activeDay.workoutTitle,
                      })
                    }
                    className={`px-2.5 py-1.5 text-xs rounded border text-left transition-colors cursor-pointer truncate ${
                      isCurrent
                        ? 'vice-sunset-btn border-transparent font-semibold'
                        : 'bg-[#1b1436] text-[#e6ddf8] border-[#35285b] hover:bg-[#261c4b] hover:border-[#38e8ff]/60'
                    }`}
                  >
                    <span className="font-semibold mr-1.5">
                      {MEAL_SLOT_LABELS[slot]}:
                    </span>
                    <span>{mealText}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up Question Bar */}
      {selection && (
        <form
          onSubmit={handleFollowUpSubmit}
          className="p-4 border-t border-[#2d2150] bg-[#100a20] space-y-1.5 shrink-0"
        >
          <label
            htmlFor="coach-followup-input"
            className="block text-xs font-medium text-[#d4c8ef]"
          >
            Ask Coach Hishay about this {selection.kind}
          </label>
          <div className="flex gap-2">
            <input
              id="coach-followup-input"
              type="text"
              value={questionInput}
              onChange={(e) => {
                setQuestionInput(e.target.value);
                if (questionError) setQuestionError(null);
              }}
              placeholder={
                selection.kind === 'exercise'
                  ? 'e.g., How do I protect my lower back?'
                  : 'e.g., How can I make this vegetarian?'
              }
              className="flex-1 min-w-0 h-9 px-3 text-xs text-[#faf7ff] bg-[#191233] border border-[#3e2f6b] rounded-md placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
            />
            <button
              type="submit"
              disabled={isAskingFollowUp || isLoading}
              className="px-3.5 h-9 text-xs font-bold rounded-md vice-sunset-btn disabled:opacity-60 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAskingFollowUp ? 'Asking...' : 'Ask'}
            </button>
          </div>
          {questionError && (
            <p role="alert" className="text-xs text-[#fda4af]">
              {questionError}
            </p>
          )}
        </form>
      )}
      </>
      )}
    </aside>
  );
}
