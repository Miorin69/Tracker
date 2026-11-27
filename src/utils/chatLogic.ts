import type { WeeklyPlan } from '../types/plan.ts';
import type { CoachSelection } from './coachLogic.ts';

export type ChatPersona = 'coach' | 'adjuster';
export type ChatRole = 'user' | 'model';

export interface ChatTurn {
  role: ChatRole;
  text: string;
}

export interface ChatMessage extends ChatTurn {
  id: string;
  timestamp: string;
  appliedToPlan?: boolean;
}

export interface GeminiHistoryEntry {
  role: ChatRole;
  parts: Array<{ text: string }>;
}

/**
 * Validates and trims raw conversation history sent from the browser so
 * multi-turn Gemini chats remain clean, bounded, and safe.
 */
export function sanitizeChatHistory(
  raw: unknown,
  maxMessages = 20,
): ChatTurn[] {
  if (!Array.isArray(raw)) return [];

  const cleaned: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const role: ChatRole | null =
      obj.role === 'user' || obj.role === 'model' ? obj.role : null;
    const text = typeof obj.text === 'string' ? obj.text.trim() : '';
    if (!role || !text) continue;
    cleaned.push({ role, text: text.slice(0, 2000) });
  }

  // Keep the most recent turns and ensure history starts with a user turn (Gemini requirement)
  const sliced = cleaned.slice(-Math.max(1, maxMessages));
  const firstUserIdx = sliced.findIndex((m) => m.role === 'user');
  if (firstUserIdx === -1) return [];
  return sliced.slice(firstUserIdx);
}

/**
 * Converts sanitized turns into @google/genai Content history entries for ai.chats.create().
 */
export function buildGeminiChatHistory(
  turns: readonly ChatTurn[],
): GeminiHistoryEntry[] {
  return turns.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));
}

function formatPlanDigest(plan?: WeeklyPlan | null): string {
  if (!plan) return 'No active weekly plan provided.';

  const daysSummary = plan.days
    .map((d) => {
      const dur = d.durationMinutes > 0 ? `${d.durationMinutes}m` : 'Rest';
      const customNote =
        d.mealOverrides &&
        Object.values(d.mealOverrides).some((v) => v && v.trim())
          ? ' [custom day menu]'
          : '';
      return `  - ${d.shortName}: ${d.workoutTitle} (${dur})${customNote} | ${d.exercises || 'Rest'}`;
    })
    .join('\n');

  const lines = [
    `ACTIVE WEEKLY PLAN CONTEXT:`,
    `- Week Start: ${plan.weekStartDate} | Mode/Theme: ${plan.holidayTag || 'Normal Week'}`,
  ];

  if (plan.holidayNotes?.trim()) {
    lines.push(`- Holiday Strategy Notes: ${plan.holidayNotes.trim()}`);
  }

  lines.push(
    `- Targets: ${plan.caloriesTarget} kcal/day, ${plan.proteinTarget}g protein/day | Prep Budget: ${plan.prepTimeLimit}`,
    `- Staple Meals:`,
    `  - Breakfast: ${plan.stapleMeals.breakfast}`,
    `  - Lunch: ${plan.stapleMeals.lunch}`,
    `  - Dinner: ${plan.stapleMeals.dinner}`,
    `  - Snack: ${plan.stapleMeals.snack}`,
    `- 7-Day Split:`,
    daysSummary,
  );

  return lines.join('\n');
}

/**
 * Builds role-specific system instructions for the multi-turn Gemini chatbots.
 */
export function buildChatSystemInstruction(
  persona: ChatPersona,
  plan?: WeeklyPlan | null,
  selection?: CoachSelection | null,
): string {
  const planDigest = formatPlanDigest(plan);

  if (persona === 'coach') {
    const focusBlock = selection
      ? [
          '',
          `CURRENTLY SELECTED SHEET ITEM:`,
          `- Type: ${selection.kind} (${selection.dayName}${selection.mealSlot ? ` · ${selection.mealSlot}` : ''})`,
          `- Item: ${selection.title}`,
          selection.workoutContext
            ? `- Day Workout: ${selection.workoutContext}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    return [
      'You are Coach Hishay, a certified strength & conditioning specialist (CSCS) and sports nutritionist.',
      'You are chatting directly with a lifter about their weekly training split, exercise technique, warm-ups, recovery, and high-protein meal prep (including vegetarian or mixed-diet options).',
      'Rules:',
      '- Be encouraging, direct, evidence-based, and practical. Avoid filler or robotic disclaimers.',
      '- Keep replies crisp and scannable (typically 3-6 concise sentences or short bullet points) unless the user asks for an in-depth breakdown.',
      '- Reference their actual weekly workouts, macros, warm-ups, and meals below whenever relevant, and remember earlier turns in the conversation.',
      '',
      planDigest,
      focusBlock,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'You are the AI Training & Diet Plan Architect inside the Weekly Training & Meal Prep Sheet Generator.',
    'Your role is to collaborate with the user across a multi-turn conversation to refine their weekly workout schedule, warm-ups, session lengths, custom holiday routines, and high-protein meals (including full vegetarian, flex-vegetarian on specific days, eggetarian, or vegan menus).',
    'Rules:',
    '- Give concrete, specific recommendations tailored to their active plan below (exact workout titles, rep ranges, session durations, and specific high-protein dishes with practical gram portions).',
    '- Keep replies concise, structured, and actionable (short bullets or 1-2 tight paragraphs) so the user can review and click "Apply to Plan" to push your proposal directly onto their Weekly Command Sheet.',
    '- Remember earlier turns in the conversation so follow-ups like "make Thursday shorter too" or "swap tofu for paneer" build smoothly on prior suggestions.',
    '- End with a short one-line prompt if anything else can be refined (or remind them they can click "Apply to Plan" when ready).',
    '',
    planDigest,
  ].join('\n');
}

/**
 * Distills a multi-turn adjuster conversation into a crisp, concrete instruction
 * string for /api/ai/adjust-plan when the user clicks "Apply to Plan".
 */
export function buildApplyInstructionFromChat(
  messages: readonly ChatMessage[],
  targetAssistantMessageId?: string,
): string {
  const userPrompts = messages
    .filter((m) => m.role === 'user')
    .slice(-4)
    .map((m) => m.text.trim())
    .filter(Boolean);

  const targetAssistant = targetAssistantMessageId
    ? messages.find(
        (m) => m.id === targetAssistantMessageId && m.role === 'model',
      )
    : [...messages].reverse().find((m) => m.role === 'model');

  const parts: string[] = [];
  if (userPrompts.length > 0) {
    parts.push(`User requests from chat: ${userPrompts.join(' -> ')}`);
  }
  if (targetAssistant?.text.trim()) {
    parts.push(
      `Apply this agreed plan recommendation concretely to the weekly schedule and meals: ${targetAssistant.text.trim().slice(0, 1200)}`,
    );
  }
  return parts.join('\n\n').trim();
}
