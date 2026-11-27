import { useState } from 'react';
import { DAY_NAMES } from '../data/presets';
import type { DayIndex, WeeklyPlan } from '../types/plan';
import {
  summarizePlanChanges,
  type AdjustmentScope,
  type DietMode,
  type PlanChangeSummary,
} from '../utils/aiPlanMerge';
import { fetchJsonWithRetry } from '../utils/apiFetch';
import {
  buildApplyInstructionFromChat,
  type ChatMessage,
} from '../utils/chatLogic';
import { ChatThread } from './ChatThread';
import { RotateCcwIcon, SlidersIcon } from './Icons';

const ADJUSTER_CHAT_STARTERS: readonly string[] = [
  'Suggest a 4-day split with 40-min workouts and 2 veg days',
  'How can I boost my daily protein by 25g without meat?',
  'Adapt my week for hotel dumbbells and 30-min meal prep',
];

interface AiPlanAdjusterProps {
  plan: WeeklyPlan;
  canUndo: boolean;
  lastSummary: string | null;
  lastChanges: PlanChangeSummary | null;
  onApplyAiPlan: (
    nextPlan: WeeklyPlan,
    summary: string,
    changes: PlanChangeSummary,
  ) => void;
  onUndoAiPlan: () => void;
  onJumpToSheet: () => void;
}

const DIET_OPTIONS: ReadonlyArray<{ id: DietMode; label: string }> = [
  { id: 'keep', label: 'Keep Current' },
  { id: 'vegetarian', label: 'Full Vegetarian' },
  { id: 'flex-vegetarian', label: 'Specific Veg Days' },
  { id: 'eggetarian', label: 'Eggetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'omnivore', label: 'Omnivore' },
];

const SCOPE_OPTIONS: ReadonlyArray<{ id: AdjustmentScope; label: string }> = [
  { id: 'both', label: 'Training & Food' },
  { id: 'training', label: 'Training Only' },
  { id: 'food', label: 'Food Only' },
];

const QUICK_SUGGESTIONS: ReadonlyArray<{
  label: string;
  dietMode: DietMode;
  scope: AdjustmentScope;
  vegDays?: DayIndex[];
  prompt: string;
}> = [
  {
    label: 'High-protein vegetarian week',
    dietMode: 'vegetarian',
    scope: 'food',
    prompt:
      'Convert all meals to high-protein vegetarian staples (paneer, tofu, Greek yogurt, lentils, soya chunks) hitting my calorie and protein targets.',
  },
  {
    label: 'Veg on Tue & Thu + busy workouts',
    dietMode: 'flex-vegetarian',
    scope: 'both',
    vegDays: [1, 3],
    prompt:
      'Make Tuesday and Thursday high-protein vegetarian days, and keep weekday workouts under 45 minutes focusing on compound lifts.',
  },
  {
    label: 'Extra shoulders & pull-up volume',
    dietMode: 'keep',
    scope: 'training',
    prompt:
      'Add extra shoulder and pull-up volume across upper-body days while reducing lower-back fatigue.',
  },
];

export function AiPlanAdjuster({
  plan,
  canUndo,
  lastSummary,
  lastChanges,
  onApplyAiPlan,
  onUndoAiPlan,
  onJumpToSheet,
}: AiPlanAdjusterProps) {
  const [mode, setMode] = useState<'form' | 'chat'>('form');
  const [scope, setScope] = useState<AdjustmentScope>('both');
  const [dietMode, setDietMode] = useState<DietMode>('keep');
  const [vegetarianDays, setVegetarianDays] = useState<DayIndex[]>([1, 3]);
  const [instruction, setInstruction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatSending, setIsChatSending] = useState(false);
  const [isChatRetrying, setIsChatRetrying] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [failedChatPrompt, setFailedChatPrompt] = useState<string | null>(null);
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(
    null,
  );
  const [applyError, setApplyError] = useState<string | null>(null);

  const toggleVegDay = (dayIdx: DayIndex) => {
    setVegetarianDays((prev) =>
      prev.includes(dayIdx)
        ? prev.filter((d) => d !== dayIdx)
        : [...prev, dayIdx].sort((a, b) => a - b),
    );
  };

  const applyQuickSuggestion = (
    suggestion: (typeof QUICK_SUGGESTIONS)[number],
  ) => {
    setDietMode(suggestion.dietMode);
    setScope(suggestion.scope);
    if (suggestion.vegDays) {
      setVegetarianDays(suggestion.vegDays);
    }
    setInstruction(suggestion.prompt);
    setErrorMessage(null);
  };

  const handleScopeChange = (nextScope: AdjustmentScope) => {
    setScope(nextScope);
    if (nextScope === 'training' && dietMode !== 'keep') {
      setDietMode('keep');
    }
    if (errorMessage) setErrorMessage(null);
  };

  const handleDietModeChange = (nextMode: DietMode) => {
    setDietMode(nextMode);
    if (nextMode !== 'keep' && scope === 'training') {
      setScope('both');
    }
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = instruction.trim();

    if (!trimmed && dietMode === 'keep') {
      setErrorMessage(
        'Describe how to adjust training or food, or choose a dietary mode.',
      );
      return;
    }

    if (
      scope !== 'training' &&
      dietMode === 'flex-vegetarian' &&
      vegetarianDays.length === 0
    ) {
      setErrorMessage('Select at least one vegetarian day below.');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    setIsRetrying(false);

    const requestScope: AdjustmentScope =
      scope === 'training' && dietMode !== 'keep' ? 'both' : scope;

    try {
      const result = await fetchJsonWithRetry<{
        plan?: WeeklyPlan;
        summary?: string;
        changes?: PlanChangeSummary;
        error?: string;
        retryable?: boolean;
      }>('/api/ai/adjust-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        maxRetries: 1,
        baseDelayMs: 900,
        onRetry: () => setIsRetrying(true),
        body: JSON.stringify({
          currentPlan: plan,
          instruction: trimmed,
          dietMode: requestScope === 'training' ? 'keep' : dietMode,
          vegetarianDays:
            requestScope !== 'training' && dietMode === 'flex-vegetarian'
              ? vegetarianDays
              : [],
          scope: requestScope,
        }),
      });

      if (!result.ok || !result.data?.plan) {
        setErrorMessage(
          result.error ||
            'Could not generate plan adjustments. Please try again.',
        );
        return;
      }

      const nextPlan = result.data.plan;
      const computedChanges =
        result.data.changes && typeof result.data.changes.hasChanges === 'boolean'
          ? result.data.changes
          : summarizePlanChanges(plan, nextPlan);

      if (!computedChanges.hasChanges) {
        setErrorMessage(
          'No concrete changes were generated for that request. Try describing specific workouts or meals, or switch "What to Adjust" to Training & Food.',
        );
        return;
      }

      onApplyAiPlan(
        nextPlan,
        result.data.summary || 'Plan adjusted with AI.',
        computedChanges,
      );
    } catch {
      setErrorMessage(
        'Network error reaching the AI planner. Check your connection and try again.',
      );
    } finally {
      setIsGenerating(false);
      setIsRetrying(false);
    }
  };

  const handleSendChatMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isChatSending) return;

    const priorHistory = chatMessages.map((m) => ({
      role: m.role,
      text: m.text,
    }));
    const userMsg: ChatMessage = {
      id: `adj-u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatError(null);
    setApplyError(null);
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
          persona: 'adjuster',
          message: trimmed,
          history: priorHistory,
          currentPlan: plan,
        }),
      });

      if (!result.ok || !result.data?.reply) {
        setChatMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setChatError(
          result.error ||
            'Could not reach the AI planner right now. Please try again.',
        );
        setFailedChatPrompt(trimmed);
        return;
      }

      const replyMsg: ChatMessage = {
        id: `adj-m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'model',
        text: result.data.reply,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, replyMsg]);
    } catch {
      setChatMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setChatError(
        'Network error reaching the AI planner. Check your connection and try again.',
      );
      setFailedChatPrompt(trimmed);
    } finally {
      setIsChatSending(false);
      setIsChatRetrying(false);
    }
  };

  const handleApplyChatSuggestion = async (assistantMessageId: string) => {
    if (applyingMessageId || isChatSending) return;

    const combinedInstruction = buildApplyInstructionFromChat(
      chatMessages,
      assistantMessageId,
    );
    if (!combinedInstruction) return;

    setApplyError(null);
    setApplyingMessageId(assistantMessageId);

    try {
      const result = await fetchJsonWithRetry<{
        plan?: WeeklyPlan;
        summary?: string;
        changes?: PlanChangeSummary;
        error?: string;
      }>('/api/ai/adjust-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        maxRetries: 1,
        baseDelayMs: 900,
        body: JSON.stringify({
          currentPlan: plan,
          instruction: combinedInstruction,
          dietMode: 'keep',
          vegetarianDays: [],
          scope: 'both',
        }),
      });

      if (!result.ok || !result.data?.plan) {
        setApplyError(
          result.error ||
            'Could not apply that chat recommendation to your plan. Please try again.',
        );
        return;
      }

      const nextPlan = result.data.plan;
      const computedChanges =
        result.data.changes && typeof result.data.changes.hasChanges === 'boolean'
          ? result.data.changes
          : summarizePlanChanges(plan, nextPlan);

      if (!computedChanges.hasChanges) {
        setApplyError(
          'That reply did not produce a concrete schedule or meal change yet. Ask for specific workout or meal swaps, then click Apply to Plan.',
        );
        return;
      }

      onApplyAiPlan(
        nextPlan,
        result.data.summary || 'Plan updated from AI Chat.',
        computedChanges,
      );
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId ? { ...m, appliedToPlan: true } : m,
        ),
      );
    } catch {
      setApplyError(
        'Network error applying changes to your sheet. Please try again.',
      );
    } finally {
      setApplyingMessageId(null);
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setChatError(null);
    setApplyError(null);
    setFailedChatPrompt(null);
  };

  return (
    <section
      id="section-ai-adjuster"
      aria-label="AI Training and Meal Adjuster"
      className="p-5 space-y-4 bg-[#191233]/85"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-[#faf7ff] flex items-center gap-1.5">
            <SlidersIcon className="w-4 h-4 text-[#ff6ea8] shrink-0" />
            <span>AI Training &amp; Diet Adjuster</span>
          </h2>
          <p className="text-xs text-[#b5a7d6] mt-0.5">
            Tailor workouts and meals with one-shot controls or a multi-turn AI
            planning chat.
          </p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div
        role="tablist"
        aria-label="AI adjuster mode"
        className="grid grid-cols-2 gap-1 p-1 bg-[#110c23] border border-[#35285b] rounded-md"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'form'}
          onClick={() => setMode('form')}
          className={`py-1.5 px-2 text-xs font-semibold rounded transition-all cursor-pointer ${
            mode === 'form'
              ? 'vice-sunset-btn'
              : 'text-[#c5b8e3] hover:bg-[#221942] hover:text-[#faf7ff]'
          }`}
        >
          Quick Adjust
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'chat'}
          onClick={() => setMode('chat')}
          className={`py-1.5 px-2 text-xs font-semibold rounded transition-all cursor-pointer ${
            mode === 'chat'
              ? 'vice-sunset-btn'
              : 'text-[#c5b8e3] hover:bg-[#221942] hover:text-[#faf7ff]'
          }`}
        >
          AI Chat{chatMessages.length > 0 ? ` (${chatMessages.length})` : ''}
        </button>
      </div>

      {mode === 'chat' ? (
        <div className="space-y-3">
          <ChatThread
            messages={chatMessages}
            isSending={isChatSending}
            isRetrying={isChatRetrying}
            errorMessage={chatError}
            assistantName="Plan Architect"
            placeholder="Describe workout or meal changes to discuss..."
            emptyHeading="Plan Your Week Together"
            emptyDescription="Iterate on workouts, warm-ups, or vegetarian swaps over multiple turns, then push any reply straight onto your sheet."
            starterPrompts={ADJUSTER_CHAT_STARTERS}
            inputId="adjuster-chat-input"
            inputLabel="Message AI Plan Architect"
            threadHeightClass="h-[300px]"
            onSend={(text) => void handleSendChatMessage(text)}
            onRetry={
              failedChatPrompt
                ? () => void handleSendChatMessage(failedChatPrompt)
                : undefined
            }
            onClear={handleClearChat}
            renderAssistantAction={(msg) =>
              msg.appliedToPlan ? (
                <span className="inline-block text-[11px] font-semibold text-[#6ee7b7] px-1">
                  Applied to sheet &#10003;
                </span>
              ) : (
                <button
                  type="button"
                  disabled={Boolean(applyingMessageId) || isChatSending}
                  onClick={() => void handleApplyChatSuggestion(msg.id)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-[#faf7ff] bg-[#241a46] border border-[#4a397a] rounded hover:bg-[#2f2259] hover:border-[#ff6ea8] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {applyingMessageId === msg.id
                    ? 'Applying to sheet...'
                    : 'Apply to Plan'}
                </button>
              )
            }
          />

          {applyError && (
            <p
              role="alert"
              className="px-3 py-2 text-xs text-[#fda4af] bg-[#3b1224] border border-[#881337] rounded-md"
            >
              {applyError}
            </p>
          )}

          {canUndo && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onUndoAiPlan}
                disabled={Boolean(applyingMessageId) || isChatSending}
                className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium text-[#e6ddf8] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RotateCcwIcon className="w-3.5 h-3.5" />
                <span>Undo last plan update</span>
              </button>
            </div>
          )}
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Scope selector */}
        <div>
          <span className="block text-xs font-medium text-[#d4c8ef] mb-1.5">
            What to Adjust
          </span>
          <div
            role="group"
            aria-label="AI adjustment scope"
            className="grid grid-cols-3 gap-1 p-1 bg-[#110c23] border border-[#35285b] rounded-md"
          >
            {SCOPE_OPTIONS.map((opt) => {
              const active = scope === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleScopeChange(opt.id)}
                  className={`py-1.5 px-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#2c2052] text-[#38e8ff] border border-[#38e8ff]/50'
                      : 'text-[#c5b8e3] border border-transparent hover:bg-[#21183e] hover:text-[#faf7ff]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {scope !== 'both' && (
            <p className="text-[11px] text-[#9f8ec7] mt-1">
              {scope === 'training'
                ? 'Only workouts, warm-ups, and durations will be updated.'
                : 'Only meals, targets, and the checklist will be updated.'}
            </p>
          )}
        </div>

        {/* Dietary preference (hidden only if Training Only) */}
        {scope !== 'training' && (
          <div className="space-y-2.5">
            <div>
              <label
                htmlFor="ai-diet-mode"
                className="block text-xs font-medium text-[#d4c8ef] mb-1"
              >
                Food / Vegetarian Mode
              </label>
              <select
                id="ai-diet-mode"
                value={dietMode}
                onChange={(e) =>
                  handleDietModeChange(e.target.value as DietMode)
                }
                className="w-full h-9 px-3 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3] cursor-pointer"
              >
                {DIET_OPTIONS.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    className="bg-[#150f29] text-[#faf7ff]"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {dietMode === 'flex-vegetarian' && (
              <div>
                <span className="block text-xs font-medium text-[#d4c8ef] mb-1.5">
                  Select Vegetarian Days
                </span>
                <div
                  role="group"
                  aria-label="Select vegetarian days"
                  className="grid grid-cols-7 gap-1"
                >
                  {DAY_NAMES.map((day, idx) => {
                    const dayIdx = idx as DayIndex;
                    const active = vegetarianDays.includes(dayIdx);
                    return (
                      <button
                        key={day.short}
                        type="button"
                        aria-pressed={active}
                        aria-label={`Vegetarian on ${day.full}`}
                        onClick={() => toggleVegDay(dayIdx)}
                        className={`py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#0f3d35] text-[#6ee7b7] border-[#34d399]'
                            : 'bg-[#110c23] text-[#c5b8e3] border-[#3e2f6b] hover:bg-[#21183e] hover:text-[#faf7ff]'
                        }`}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom prompt input */}
        <div>
          <label
            htmlFor="ai-adjustment-prompt"
            className="block text-xs font-medium text-[#d4c8ef] mb-1"
          >
            Custom Training or Food Instructions
          </label>
          <textarea
            id="ai-adjustment-prompt"
            rows={3}
            value={instruction}
            onChange={(e) => {
              setInstruction(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="e.g., Swap squats for knee-friendly leg work, shorten Thu to 30 mins, and give me high-protein vegetarian meals on Tue & Sat..."
            className="w-full px-3 py-2 text-sm text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md leading-snug placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3] resize-y"
          />
        </div>

        {/* Quick presets */}
        <div className="space-y-1.5">
          <span className="block text-[11px] font-medium text-[#9f8ec7]">
            Quick presets
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SUGGESTIONS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => applyQuickSuggestion(item)}
                className="px-2.5 py-1 text-xs font-medium text-[#d4c8ef] bg-[#110c23] border border-[#35285b] rounded-md hover:bg-[#241a46] hover:text-[#faf7ff] hover:border-[#ff6ea8]/60 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="px-3 py-2 text-xs text-[#fda4af] bg-[#3b1224] border border-[#881337] rounded-md"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isGenerating}
            className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-4 text-xs font-bold rounded-md vice-sunset-btn disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6ea8] transition-all cursor-pointer whitespace-nowrap"
          >
            <span>
              {isGenerating
                ? isRetrying
                  ? 'Retrying automatically...'
                  : 'Adjusting Plan...'
                : 'Generate Adjustments'}
            </span>
          </button>

          {canUndo && (
            <button
              type="button"
              onClick={onUndoAiPlan}
              disabled={isGenerating}
              className="inline-flex items-center gap-1 h-9 px-3 text-xs font-medium text-[#e6ddf8] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcwIcon className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}
        </div>
      </form>
      )}

      {lastSummary && (
        <div
          role="status"
          className="px-3 py-2.5 text-xs text-[#e6ddf8] bg-[#102b2a] border border-[#34d399]/50 rounded-md space-y-2"
        >
          <p className="leading-relaxed">
            <span className="font-semibold text-[#6ee7b7]">Plan updated: </span>
            {lastSummary}
          </p>
          {lastChanges && lastChanges.highlights.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-[#c5b8e3] list-disc pl-4">
              {lastChanges.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onJumpToSheet}
            className="text-[11px] font-semibold text-[#38e8ff] hover:underline underline-offset-2 cursor-pointer"
          >
            View updated sheet &rarr;
          </button>
        </div>
      )}
    </section>
  );
}
