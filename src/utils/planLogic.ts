import {
  DAY_NAMES,
  GYM_STAPLES_MEALS,
  PREP_TIME_LIMITS,
  SPLIT_PRESETS,
  buildDaysFromPreset,
  buildDefaultChecklist,
} from '../data/presets.ts';
import type {
  ChecklistItem,
  DaySchedule,
  PrepTimeLimit,
  SplitPresetId,
  StapleMeals,
  WeeklyPlan,
} from '../types/plan.ts';
import { sanitizeDailyProgress } from './macroProgressLogic.ts';
import { recommendWarmupForSession } from './warmupLogic.ts';

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatIsoDate(year: number, monthIndex: number, day: number): string {
  const yyyy = String(year).padStart(4, '0');
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseIsoDateParts(isoDate: string): { year: number; monthIndex: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, monthIndex, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== monthIndex ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, monthIndex, day };
}

/**
 * Returns the upcoming Monday (or today if today is Monday) in YYYY-MM-DD format.
 */
export function getUpcomingMonday(referenceDate: Date = new Date()): string {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();
  const day = referenceDate.getDate();
  const dayOfWeek = referenceDate.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const daysUntilMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
  const target = new Date(Date.UTC(year, monthIndex, day + daysUntilMonday));
  return formatIsoDate(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
}

export function addDaysToIsoDate(isoDate: string, offsetDays: number): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return isoDate;
  const next = new Date(Date.UTC(parts.year, parts.monthIndex, parts.day + offsetDays));
  return formatIsoDate(
    next.getUTCFullYear(),
    next.getUTCMonth(),
    next.getUTCDate(),
  );
}

export function formatShortDate(isoDate: string): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return isoDate;
  return `${MONTH_SHORT[parts.monthIndex]} ${parts.day}`;
}

export function formatWeekRange(weekStartDate: string): string {
  const startParts = parseIsoDateParts(weekStartDate);
  if (!startParts) return 'Invalid Date Range';
  const endIso = addDaysToIsoDate(weekStartDate, 6);
  const endParts = parseIsoDateParts(endIso);
  if (!endParts) return 'Invalid Date Range';

  const startDayOfWeek = new Date(
    Date.UTC(startParts.year, startParts.monthIndex, startParts.day),
  ).getUTCDay();
  const endDayOfWeek = new Date(
    Date.UTC(endParts.year, endParts.monthIndex, endParts.day),
  ).getUTCDay();
  const wkDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

  const startLabel = `${wkDays[startDayOfWeek]}, ${MONTH_SHORT[startParts.monthIndex]} ${startParts.day}`;
  const endLabel = `${wkDays[endDayOfWeek]}, ${MONTH_SHORT[endParts.monthIndex]} ${endParts.day}, ${endParts.year}`;

  if (startParts.year !== endParts.year) {
    return `${startLabel}, ${startParts.year} – ${endLabel}`;
  }
  return `${startLabel} – ${endLabel}`;
}

export function createDefaultPlan(referenceDate: Date = new Date()): WeeklyPlan {
  return {
    version: 1,
    weekStartDate: getUpcomingMonday(referenceDate),
    holidayTag: 'Normal Week',
    caloriesTarget: 2200,
    proteinTarget: 160,
    splitPreset: 'ppl',
    prepTimeLimit: '60 mins',
    stapleMeals: { ...GYM_STAPLES_MEALS },
    days: buildDaysFromPreset('ppl'),
    checklist: buildDefaultChecklist('60 mins'),
  };
}

export function getEffectiveDayMeals(plan: WeeklyPlan, day: DaySchedule): StapleMeals {
  return {
    breakfast: day.mealOverrides?.breakfast?.trim() || plan.stapleMeals.breakfast,
    lunch: day.mealOverrides?.lunch?.trim() || plan.stapleMeals.lunch,
    dinner: day.mealOverrides?.dinner?.trim() || plan.stapleMeals.dinner,
    snack: day.mealOverrides?.snack?.trim() || plan.stapleMeals.snack,
  };
}

export function computeWeeklyTrainingSummary(days: DaySchedule[]): {
  trainingDays: number;
  restDays: number;
  totalMinutes: number;
} {
  let trainingDays = 0;
  let restDays = 0;
  let totalMinutes = 0;

  for (const day of days) {
    const mins = Number.isFinite(day.durationMinutes)
      ? Math.max(0, Math.round(day.durationMinutes))
      : 0;
    totalMinutes += mins;
    if (day.isRestDay || mins === 0) {
      restDays += 1;
    } else {
      trainingDays += 1;
    }
  }

  return { trainingDays, restDays, totalMinutes };
}

export function applySplitPresetToPlan(
  plan: WeeklyPlan,
  presetId: SplitPresetId,
): WeeklyPlan {
  const newDays = buildDaysFromPreset(presetId).map((day, idx) => ({
    ...day,
    mealOverrides: plan.days[idx]?.mealOverrides,
  }));

  return {
    ...plan,
    splitPreset: presetId,
    customSplitLabel: undefined,
    days: newDays,
  };
}

export function deriveChecklistFromMeals(
  meals: StapleMeals,
  prepLimit: PrepTimeLimit,
): ChecklistItem[] {
  const rawMealValues = [
    meals.breakfast,
    meals.lunch,
    meals.dinner,
    meals.snack,
  ];

  const seen = new Set<string>();
  const groceryTexts: string[] = [];

  for (const mealText of rawMealValues) {
    // Expand parenthetical ingredient lists cleanly so commas inside (...) don't leave dangling parens
    const cleanedMeal = mealText.replace(/\(([^)]*)\)/g, (match, inner: string) => {
      // Keep short quantity annotations like (250g) attached; expand comma-separated lists
      if (inner.includes(',') || inner.includes('&')) {
        return `, ${inner}`;
      }
      return ` ${match}`;
    });

    const tokens = cleanedMeal
      .split(/,|&|\+|\/|\band\b/i)
      .map((part) => {
        let s = part.replace(/\s+/g, ' ').trim();
        // Remove any stray unmatched parentheses
        const opens = (s.match(/\(/g) ?? []).length;
        const closes = (s.match(/\)/g) ?? []).length;
        if (opens !== closes) {
          s = s.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
        }
        return s;
      })
      .filter((part) => part.length >= 3);

    for (const token of tokens) {
      const normalized = token.toLowerCase().replace(/\([^)]*\)/g, '').trim();
      if (normalized.length < 3 || seen.has(normalized)) continue;
      seen.add(normalized);
      const capitalized = token.charAt(0).toUpperCase() + token.slice(1);
      groceryTexts.push(capitalized);
    }
  }

  if (groceryTexts.length === 0) {
    return buildDefaultChecklist(prepLimit);
  }

  const prepSteps: string[] =
    prepLimit === '30 mins'
      ? [
          `Assemble grab-and-go breakfast portions (${meals.breakfast.slice(0, 48)}${meals.breakfast.length > 48 ? '…' : ''}) — 8 mins`,
          `Portion quick-cook protein & carbs for lunches (${meals.lunch.slice(0, 48)}${meals.lunch.length > 48 ? '…' : ''}) — 12 mins`,
          'Wash produce and pack pre/post-workout snacks into 5 daily portions — 10 mins',
        ]
      : prepLimit === '60 mins'
        ? [
            `Batch-cook main lunch protein & carbs (${meals.lunch.slice(0, 52)}${meals.lunch.length > 52 ? '…' : ''}) — 25 mins`,
            `Prep dinner base ingredients (${meals.dinner.slice(0, 52)}${meals.dinner.length > 52 ? '…' : ''}) — 20 mins`,
            'Portion breakfast staples into Mon–Thu containers — 10 mins',
            'Pack pre/post-workout snacks and gym shakers — 5 mins',
          ]
        : [
            `Marinate & batch-cook lunch proteins (${meals.lunch.slice(0, 52)}${meals.lunch.length > 52 ? '…' : ''}) — 35 mins`,
            `Cook dinner mains & roast vegetables (${meals.dinner.slice(0, 52)}${meals.dinner.length > 52 ? '…' : ''}) — 30 mins`,
            `Prep 5 breakfast jars/containers (${meals.breakfast.slice(0, 52)}${meals.breakfast.length > 52 ? '…' : ''}) — 15 mins`,
            'Portion daily snacks, sauces, and label containers Mon–Fri — 10 mins',
          ];

  const timestamp = Date.now();
  const prepItems: ChecklistItem[] = prepSteps.map((text, idx) => ({
    id: `prep-gen-${timestamp}-${idx}`,
    category: 'prep',
    text,
    checked: false,
  }));

  const groceryItems: ChecklistItem[] = groceryTexts
    .slice(0, 14)
    .map((text, idx) => ({
      id: `grocery-gen-${timestamp}-${idx}`,
      category: 'grocery',
      text,
      checked: false,
    }));

  return [...prepItems, ...groceryItems];
}

export function generateMarkdown(plan: WeeklyPlan): string {
  const weekRange = formatWeekRange(plan.weekStartDate);
  const summary = computeWeeklyTrainingSummary(plan.days);
  const splitLabel =
    plan.customSplitLabel?.trim() ||
    SPLIT_PRESETS.find((s) => s.id === plan.splitPreset)?.label ||
    plan.splitPreset;

  const lines: string[] = [];
  lines.push(`# Weekly Training & Meal Prep Command Sheet`);
  lines.push('');
  lines.push(`- **Week:** ${weekRange}`);
  lines.push(`- **Theme / Event:** ${plan.holidayTag.trim() || 'Normal Week'}`);
  if (plan.holidayNotes?.trim()) {
    lines.push(`- **Holiday Strategy:** ${plan.holidayNotes.trim()}`);
  }
  lines.push(
    `- **Daily Targets:** ${plan.caloriesTarget.toLocaleString('en-US')} kcal | ${plan.proteinTarget}g protein`,
  );
  lines.push(
    `- **Training Split:** ${splitLabel} (${summary.trainingDays} training days, ${summary.totalMinutes} mins total)`,
  );
  lines.push(`- **Prep Time Budget:** ${plan.prepTimeLimit}`);
  lines.push('');
  lines.push('## 7-Day Training & Meal Schedule');
  lines.push('');

  for (const day of plan.days) {
    const dayDate = formatShortDate(
      addDaysToIsoDate(plan.weekStartDate, day.dayIndex),
    );
    const meals = getEffectiveDayMeals(plan, day);
    const durationText =
      day.durationMinutes > 0 ? `${day.durationMinutes} min` : 'Rest';
    lines.push(
      `### ${day.dayName} (${dayDate}) — ${day.workoutTitle} [${durationText}]`,
    );
    if (day.warmup?.trim()) {
      lines.push(`- **Warm-up:** ${day.warmup.trim()}`);
    }
    if (day.exercises.trim()) {
      lines.push(`- **Session:** ${day.exercises.trim()}`);
    }
    lines.push(`- **Breakfast:** ${meals.breakfast}`);
    lines.push(`- **Lunch:** ${meals.lunch}`);
    lines.push(`- **Dinner:** ${meals.dinner}`);
    lines.push(`- **Pre/Post Snack:** ${meals.snack}`);
    lines.push('');
  }

  const prepItems = plan.checklist.filter((item) => item.category === 'prep');
  const groceryItems = plan.checklist.filter(
    (item) => item.category === 'grocery',
  );

  lines.push('## Meal Prep Steps');
  if (prepItems.length === 0) {
    lines.push('- (No meal prep steps listed)');
  } else {
    for (const item of prepItems) {
      lines.push(`- [${item.checked ? 'x' : ' '}] ${item.text}`);
    }
  }
  lines.push('');

  lines.push('## Consolidated Grocery List');
  if (groceryItems.length === 0) {
    lines.push('- (No grocery items listed)');
  } else {
    for (const item of groceryItems) {
      lines.push(`- [${item.checked ? 'x' : ' '}] ${item.text}`);
    }
  }

  return lines.join('\n');
}

export function parseImportedPlan(
  rawJson: string,
): { ok: true; plan: WeeklyPlan } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON file. Please select a valid exported plan backup.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'File does not contain a valid Weekly Plan object.',
    };
  }

  const obj = parsed as Record<string, unknown>;

  if (
    typeof obj.weekStartDate !== 'string' ||
    !parseIsoDateParts(obj.weekStartDate)
  ) {
    return {
      ok: false,
      error: 'Missing or invalid weekStartDate (expected YYYY-MM-DD).',
    };
  }

  if (!Array.isArray(obj.days) || obj.days.length !== 7) {
    return {
      ok: false,
      error: 'Plan must contain exactly 7 days (Monday through Sunday).',
    };
  }

  const caloriesTarget =
    typeof obj.caloriesTarget === 'number' &&
    Number.isFinite(obj.caloriesTarget) &&
    obj.caloriesTarget >= 800 &&
    obj.caloriesTarget <= 10000
      ? Math.round(obj.caloriesTarget)
      : 2200;

  const proteinTarget =
    typeof obj.proteinTarget === 'number' &&
    Number.isFinite(obj.proteinTarget) &&
    obj.proteinTarget >= 30 &&
    obj.proteinTarget <= 500
      ? Math.round(obj.proteinTarget)
      : 160;

  const validSplitIds = new Set<string>(SPLIT_PRESETS.map((p) => p.id));
  const splitPreset: SplitPresetId =
    typeof obj.splitPreset === 'string' && validSplitIds.has(obj.splitPreset)
      ? (obj.splitPreset as SplitPresetId)
      : 'ppl';

  const validPrepLimits = new Set<string>(PREP_TIME_LIMITS);
  const prepTimeLimit: PrepTimeLimit =
    typeof obj.prepTimeLimit === 'string' &&
    validPrepLimits.has(obj.prepTimeLimit)
      ? (obj.prepTimeLimit as PrepTimeLimit)
      : '60 mins';

  const rawMeals =
    obj.stapleMeals && typeof obj.stapleMeals === 'object'
      ? (obj.stapleMeals as Record<string, unknown>)
      : {};

  const stapleMeals: StapleMeals = {
    breakfast:
      typeof rawMeals.breakfast === 'string'
        ? rawMeals.breakfast
        : GYM_STAPLES_MEALS.breakfast,
    lunch:
      typeof rawMeals.lunch === 'string'
        ? rawMeals.lunch
        : GYM_STAPLES_MEALS.lunch,
    dinner:
      typeof rawMeals.dinner === 'string'
        ? rawMeals.dinner
        : GYM_STAPLES_MEALS.dinner,
    snack:
      typeof rawMeals.snack === 'string'
        ? rawMeals.snack
        : GYM_STAPLES_MEALS.snack,
  };

  const days: DaySchedule[] = obj.days.map((rawDay, idx) => {
    const d =
      rawDay && typeof rawDay === 'object'
        ? (rawDay as Record<string, unknown>)
        : {};
    const durationMinutes =
      typeof d.durationMinutes === 'number' &&
      Number.isFinite(d.durationMinutes)
        ? Math.max(0, Math.min(300, Math.round(d.durationMinutes)))
        : 0;
    const rawOverrides =
      d.mealOverrides && typeof d.mealOverrides === 'object'
        ? (d.mealOverrides as Record<string, unknown>)
        : undefined;

    const mealOverrides = rawOverrides
      ? {
          breakfast:
            typeof rawOverrides.breakfast === 'string'
              ? rawOverrides.breakfast
              : undefined,
          lunch:
            typeof rawOverrides.lunch === 'string'
              ? rawOverrides.lunch
              : undefined,
          dinner:
            typeof rawOverrides.dinner === 'string'
              ? rawOverrides.dinner
              : undefined,
          snack:
            typeof rawOverrides.snack === 'string'
              ? rawOverrides.snack
              : undefined,
        }
      : undefined;

    const workoutTitle =
      typeof d.workoutTitle === 'string' && d.workoutTitle.trim()
        ? d.workoutTitle
        : 'Rest Day';
    const exercises = typeof d.exercises === 'string' ? d.exercises : '';
    const isRestDay =
      typeof d.isRestDay === 'boolean' ? d.isRestDay : durationMinutes === 0;
    const warmup =
      typeof d.warmup === 'string'
        ? d.warmup.trim()
        : isRestDay || durationMinutes === 0
          ? ''
          : recommendWarmupForSession(workoutTitle, exercises, isRestDay);

    return {
      dayIndex: idx as DaySchedule['dayIndex'],
      dayName: DAY_NAMES[idx].full,
      shortName: DAY_NAMES[idx].short,
      workoutTitle,
      warmup,
      exercises,
      durationMinutes,
      isRestDay,
      mealOverrides,
    };
  });

  const checklist: ChecklistItem[] = Array.isArray(obj.checklist)
    ? obj.checklist
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object',
        )
        .map(
          (item, idx): ChecklistItem => ({
            id:
              typeof item.id === 'string' && item.id.trim()
                ? item.id
                : `imported-item-${idx}`,
            category: item.category === 'prep' ? 'prep' : 'grocery',
            text: typeof item.text === 'string' ? item.text.trim() : '',
            checked: Boolean(item.checked),
          }),
        )
        .filter((item) => item.text.length > 0)
    : buildDefaultChecklist(prepTimeLimit);

  return {
    ok: true,
    plan: {
      version: 1,
      weekStartDate: obj.weekStartDate,
      holidayTag:
        typeof obj.holidayTag === 'string' && obj.holidayTag.trim()
          ? obj.holidayTag.trim()
          : 'Normal Week',
      holidayNotes:
        typeof obj.holidayNotes === 'string' && obj.holidayNotes.trim()
          ? obj.holidayNotes.trim()
          : undefined,
      activeHolidayPlanId:
        typeof obj.activeHolidayPlanId === 'string' &&
        obj.activeHolidayPlanId.trim()
          ? obj.activeHolidayPlanId.trim()
          : undefined,
      caloriesTarget,
      proteinTarget,
      splitPreset,
      customSplitLabel:
        typeof obj.customSplitLabel === 'string' && obj.customSplitLabel.trim()
          ? obj.customSplitLabel.trim()
          : undefined,
      prepTimeLimit,
      stapleMeals,
      days,
      checklist,
      dailyProgress: sanitizeDailyProgress(obj.dailyProgress),
    },
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a 100% standalone single-file offline HTML document of the current Weekly Command Sheet.
 */
export function generateStandaloneHtml(plan: WeeklyPlan): string {
  const weekRange = formatWeekRange(plan.weekStartDate);
  const summary = computeWeeklyTrainingSummary(plan.days);
  const splitLabel =
    plan.customSplitLabel?.trim() ||
    SPLIT_PRESETS.find((s) => s.id === plan.splitPreset)?.label ||
    plan.splitPreset;
  const prepItems = plan.checklist.filter((i) => i.category === 'prep');
  const groceryItems = plan.checklist.filter((i) => i.category === 'grocery');

  const rowsHtml = plan.days
    .map((day) => {
      const dateLabel = formatShortDate(
        addDaysToIsoDate(plan.weekStartDate, day.dayIndex),
      );
      const meals = getEffectiveDayMeals(plan, day);
      const dur = day.durationMinutes > 0 ? `${day.durationMinutes} min` : 'Rest';
      return `
        <tr>
          <td class="day-col">
            <div class="day-name">${escapeHtml(day.shortName)}</div>
            <div class="day-date">${escapeHtml(dateLabel)}</div>
          </td>
          <td class="train-col">
            <div class="workout-header">
              <strong>${escapeHtml(day.workoutTitle)}</strong>
              <span class="dur">${escapeHtml(dur)}</span>
            </div>
            ${day.warmup?.trim() ? `<div class="warmup"><strong>Warm-up:</strong> ${escapeHtml(day.warmup.trim())}</div>` : ''}
            <div class="exercises">${escapeHtml(day.exercises || '—')}</div>
          </td>
          <td class="meal-col">
            <div><span class="slot">B:</span> ${escapeHtml(meals.breakfast)}</div>
            <div><span class="slot">L:</span> ${escapeHtml(meals.lunch)}</div>
            <div><span class="slot">D:</span> ${escapeHtml(meals.dinner)}</div>
            <div><span class="slot">S:</span> ${escapeHtml(meals.snack)}</div>
          </td>
        </tr>`;
    })
    .join('\n');

  const renderList = (items: ChecklistItem[]) =>
    items
      .map(
        (item) => `
          <li>
            <label>
              <input type="checkbox" data-id="${escapeHtml(item.id)}" ${item.checked ? 'checked' : ''} />
              <span>${escapeHtml(item.text)}</span>
            </label>
          </li>`,
      )
      .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Weekly Command Sheet — ${escapeHtml(weekRange)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 24px; }
    .sheet { max-width: 960px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; }
    .toolbar { max-width: 960px; margin: 0 auto 12px; display: flex; justify-content: flex-end; }
    .btn { background: #0f172a; color: #fff; border: 0; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .header { border: 1px solid #e2e8f0; background: #f8fafc; padding: 14px 16px; border-radius: 6px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: -0.02em; }
    .meta { font-size: 13px; color: #475569; }
    .metrics { display: flex; gap: 20px; font-variant-numeric: tabular-nums; }
    .metric-label { font-size: 11px; color: #64748b; }
    .metric-val { font-size: 14px; font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th { text-align: left; font-size: 11px; color: #475569; border-bottom: 1.5px solid #cbd5e1; padding: 8px; background: #f8fafc; }
    td { vertical-align: top; border-bottom: 1px solid #e2e8f0; padding: 8px; font-size: 12px; line-height: 1.35; }
    .day-col { width: 82px; white-space: nowrap; }
    .day-name { font-weight: 700; }
    .day-date { font-size: 11px; color: #64748b; }
    .train-col { width: 38%; }
    .workout-header { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
    .dur { font-family: ui-monospace, monospace; font-size: 11px; color: #475569; white-space: nowrap; }
    .warmup { color: #475569; font-size: 10.5px; margin-bottom: 3px; }
    .exercises { color: #334155; font-size: 11.5px; }
    .meal-col div { margin-bottom: 2px; }
    .slot { font-weight: 700; color: #475569; margin-right: 4px; }
    .checklists { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .checklists h2 { font-size: 13px; margin: 0 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { margin-bottom: 6px; font-size: 12px; }
    label { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; }
    input:checked + span { text-decoration: line-through; color: #94a3b8; }
    @media print {
      @page { size: letter portrait; margin: 0.35in; }
      body { background: #fff; padding: 0; }
      .toolbar { display: none; }
      .sheet { border: 0; padding: 0; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button class="btn" onclick="window.print()">Print / Save PDF</button></div>
  <main class="sheet">
    <header class="header">
      <div>
        <h1>Weekly Command Sheet</h1>
        <div class="meta">${escapeHtml(weekRange)} &middot; ${escapeHtml(plan.holidayTag || 'Normal Week')} &middot; ${escapeHtml(splitLabel)}</div>
        ${plan.holidayNotes?.trim() ? `<div class="meta" style="margin-top:4px;">${escapeHtml(plan.holidayNotes.trim())}</div>` : ''}
      </div>
      <div class="metrics">
        <div><div class="metric-label">Daily Calories</div><div class="metric-val">${plan.caloriesTarget.toLocaleString('en-US')} kcal</div></div>
        <div><div class="metric-label">Daily Protein</div><div class="metric-val">${plan.proteinTarget} g</div></div>
        <div><div class="metric-label">Prep Budget</div><div class="metric-val">${escapeHtml(plan.prepTimeLimit)}</div></div>
        <div><div class="metric-label">Training</div><div class="metric-val">${summary.trainingDays}d / ${summary.totalMinutes}m</div></div>
      </div>
    </header>
    <table>
      <thead>
        <tr><th>Day</th><th>Training Focus &amp; Key Lifts</th><th>Planned Meals</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <section class="checklists">
      <div><h2>Meal Prep Steps</h2><ul>${renderList(prepItems)}</ul></div>
      <div><h2>Grocery List</h2><ul>${renderList(groceryItems)}</ul></div>
    </section>
  </main>
  <script>
    const key = 'standalone-sheet-${escapeHtml(plan.weekStartDate)}';
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    document.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      const id = cb.dataset.id;
      if (id in saved) cb.checked = saved[id];
      cb.addEventListener('change', () => {
        saved[id] = cb.checked;
        localStorage.setItem(key, JSON.stringify(saved));
      });
    });
  </script>
</body>
</html>`;
}
