import type { DayIndex, DaySchedule, WeeklyPlan } from '../types/plan.ts';

export type FocusCategory = 'push' | 'pull' | 'legs' | 'full-body';
export type VisualMode = 'infographic' | 'illustration';
export type FocusScope = 'week' | DayIndex;

export interface YouTubeResource {
  title: string;
  url: string;
  videoId?: string;
  channel?: string;
  source: 'ai-grounded' | 'custom' | 'search';
}

export interface WorkoutFocusSummary {
  scope: FocusScope;
  category: FocusCategory;
  categoryLabel: string;
  focusTitle: string;
  splitLabel: string;
  focusSubtitle: string;
  dayName?: string;
  durationMinutes: number;
  totalWeeklyMinutes: number;
  activeDaysCount: number;
  restDaysCount: number;
  caloriesTarget: number;
  proteinTarget: number;
  keyExercises: string[];
  warmupCues: string;
  targetMuscles: string[];
  defaultFormCues: string[];
  tempoNote: string;
  youtubeSearchQuery: string;
  youtubeSearchUrl: string;
}

export interface WorkoutVisualAiBrief {
  headline: string;
  intensityNote: string;
  formCues: string[];
  targetMuscles: string[];
  videos: YouTubeResource[];
  searchQuery: string;
}

const CATEGORY_METADATA: Record<
  FocusCategory,
  {
    label: string;
    muscles: string[];
    cues: string[];
    tempo: string;
    fallbackWarmup: string;
  }
> = {
  push: {
    label: 'Push · Upper Anterior',
    muscles: ['Upper & Mid Chest', 'Anterior Delts', 'Triceps', 'Serratus'],
    cues: [
      'Retract shoulder blades and pin upper back into the bench before unracking.',
      'Lower with a controlled 2–3 second eccentric and tuck elbows ~45° from torso.',
      'Drive feet firmly into the floor and press cleanly without flaring ribs.',
    ],
    tempo: '3-1-1-0 Eccentric Control · 90–120s Rest on Compounds',
    fallbackWarmup: 'Arm circles, band pull-aparts, scapular push-ups (5 mins)',
  },
  pull: {
    label: 'Pull · Posterior Chain & Back',
    muscles: ['Lats', 'Rhomboids & Mid-Traps', 'Rear Delts', 'Biceps'],
    cues: [
      'Initiate every rep by depressing and retracting your scapulae—lead with elbows.',
      'Pause 1 second at peak contraction to eliminate momentum swinging.',
      'Control the full stretch at the bottom without shrugging shoulders to ears.',
    ],
    tempo: '2-1-1-1 Peak Squeeze · 90s Rest on Heavy Pulls',
    fallbackWarmup: 'Dead hangs, thoracic rotations, band face pulls (5 mins)',
  },
  legs: {
    label: 'Lower Body · Quads, Glutes & Hams',
    muscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core Bracing'],
    cues: [
      'Brace 360° through your midsection and root big toe, pinky toe, and heel.',
      'Track knees smoothly over mid-foot while maintaining a stacked neutral spine.',
      'Drive through mid-foot out of the hole with deliberate hip and knee extension.',
    ],
    tempo: '3-1-1-0 Controlled Depth · 2–3 min Rest on Primary Lifts',
    fallbackWarmup: '90/90 hip switches, ankle rocks, bodyweight squats (6 mins)',
  },
  'full-body': {
    label: 'Full Body · Athletic Strength & Conditioning',
    muscles: ['Posterior Chain', 'Core & Trunk', 'Shoulders', 'Legs & Conditioning'],
    cues: [
      'Snap hips through on hinges and keep ribs stacked over pelvis during overhead work.',
      'Maintain crisp rep quality under fatigue—stop 1–2 reps shy of technical breakdown.',
      'Use nasal recovery breaths between rounds to bring heart rate down quickly.',
    ],
    tempo: 'Crisp Explosive Concentrics · 60–90s Rest Between Stations',
    fallbackWarmup: 'World’s greatest stretch, inchworms, light kettlebell halos (5 mins)',
  },
};

const SPLIT_LABELS: Record<WeeklyPlan['splitPreset'], string> = {
  ppl: 'Push / Pull / Legs',
  'upper-lower': 'Upper / Lower Split',
  'full-body': 'Full Body Strength',
  'holiday-maintenance': 'Holiday Maintenance',
};

export function classifyFocusCategory(text: string): FocusCategory {
  const normalized = text.toLowerCase();

  let pushScore = 0;
  let pullScore = 0;
  let legsScore = 0;
  let fullScore = 0;

  const pushTerms = [
    'push',
    'bench',
    'chest',
    'incline',
    'shoulder',
    'ohp',
    'overhead press',
    'tricep',
    'dip',
    'fly',
    'lateral raise',
    'pec',
  ];
  const pullTerms = [
    'pull',
    'row',
    'lat',
    'back',
    'bicep',
    'chin-up',
    'pull-up',
    'pullup',
    'face pull',
    'curl',
    'shrug',
    'rear delt',
  ];
  const legTerms = [
    'leg',
    'lower',
    'squat',
    'rdl',
    'romanian',
    'lunge',
    'split squat',
    'hamstring',
    'quad',
    'glute',
    'calf',
    'hip thrust',
    'leg press',
    'deadlift',
  ];
  const fullTerms = [
    'full body',
    'full-body',
    'conditioning',
    'kettlebell',
    'circuit',
    'hiit',
    'athletic',
    'metcon',
    'carry',
    'thruster',
    'swing',
    'burpee',
    'mobility',
    'maintenance',
  ];

  for (const term of pushTerms) {
    if (normalized.includes(term)) pushScore += term === 'push' ? 3 : 1;
  }
  for (const term of pullTerms) {
    if (normalized.includes(term)) pullScore += term === 'pull' ? 3 : 1;
  }
  for (const term of legTerms) {
    if (normalized.includes(term)) {
      legsScore += term === 'leg' || term === 'lower' || term === 'squat' ? 3 : 1;
    }
  }
  for (const term of fullTerms) {
    if (normalized.includes(term)) {
      fullScore += term === 'full body' || term === 'full-body' ? 4 : 2;
    }
  }

  // If "upper" is present without a clear push/pull bias, push is the classic representative visual
  if (normalized.includes('upper') && pushScore === 0 && pullScore === 0) {
    pushScore += 2;
  }

  const ranked: Array<{ category: FocusCategory; score: number }> = [
    { category: 'full-body', score: fullScore },
    { category: 'legs', score: legsScore },
    { category: 'push', score: pushScore },
    { category: 'pull', score: pullScore },
  ];

  ranked.sort((a, b) => b.score - a.score);
  if (ranked[0].score === 0) return 'full-body';
  return ranked[0].category;
}

export function extractExerciseList(rawExercises: string, limit = 6): string[] {
  return rawExercises
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, limit);
}

export function buildYouTubeSearchUrl(query: string): string {
  const cleaned = query.trim().replace(/\s+/g, ' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    cleaned || 'strength training workout form guide',
  )}`;
}

export function analyzeWorkoutFocus(
  plan: WeeklyPlan,
  scope: FocusScope = 'week',
): WorkoutFocusSummary {
  const activeDays = plan.days.filter((d) => !d.isRestDay);
  const restDaysCount = plan.days.length - activeDays.length;
  const totalWeeklyMinutes = activeDays.reduce(
    (sum, d) => sum + (Number.isFinite(d.durationMinutes) ? d.durationMinutes : 0),
    0,
  );
  const splitLabel =
    plan.customSplitLabel?.trim() || SPLIT_LABELS[plan.splitPreset] || 'Weekly Training';

  // Single-day focus mode
  if (typeof scope === 'number') {
    const day: DaySchedule | undefined = plan.days.find((d) => d.dayIndex === scope);
    if (day && !day.isRestDay) {
      const combinedText = `${day.workoutTitle} ${day.exercises}`;
      const category = classifyFocusCategory(combinedText);
      const meta = CATEGORY_METADATA[category];
      const keyExercises = extractExerciseList(day.exercises, 6);
      const topLift = keyExercises[0]
        ?.replace(/\s+\d+\s*[x×]\s*[\d-]+.*$/i, '')
        .trim();
      const cleanTitle = day.workoutTitle.replace(/\s*[—–-]\s*/g, ' ').trim();
      const youtubeSearchQuery = topLift
        ? `${cleanTitle} ${topLift} proper form tutorial`
        : `${cleanTitle} workout form guide`;

      return {
        scope,
        category,
        categoryLabel: meta.label,
        focusTitle: day.workoutTitle || `${day.dayName} Training`,
        splitLabel,
        focusSubtitle: `${day.dayName} Session · ${day.durationMinutes} min`,
        dayName: day.dayName,
        durationMinutes: day.durationMinutes,
        totalWeeklyMinutes,
        activeDaysCount: activeDays.length,
        restDaysCount,
        caloriesTarget: plan.caloriesTarget,
        proteinTarget: plan.proteinTarget,
        keyExercises:
          keyExercises.length > 0 ? keyExercises : ['Compound strength movements'],
        warmupCues: day.warmup?.trim() || meta.fallbackWarmup,
        targetMuscles: meta.muscles,
        defaultFormCues: meta.cues,
        tempoNote: meta.tempo,
        youtubeSearchQuery,
        youtubeSearchUrl: buildYouTubeSearchUrl(youtubeSearchQuery),
      };
    }
  }

  // Weekly primary focus mode
  const categoryWeights: Record<FocusCategory, number> = {
    push: 0,
    pull: 0,
    legs: 0,
    'full-body': 0,
  };

  let primaryDay: DaySchedule | null = activeDays[0] ?? null;

  for (const day of activeDays) {
    const cat = classifyFocusCategory(`${day.workoutTitle} ${day.exercises}`);
    categoryWeights[cat] += Math.max(15, day.durationMinutes || 45);
    if (
      primaryDay &&
      day.durationMinutes > primaryDay.durationMinutes
    ) {
      primaryDay = day;
    }
  }

  let primaryCategory: FocusCategory = 'full-body';
  if (plan.splitPreset === 'full-body' || plan.splitPreset === 'holiday-maintenance') {
    primaryCategory = 'full-body';
  } else {
    const sortedCategories = (
      Object.entries(categoryWeights) as Array<[FocusCategory, number]>
    ).sort((a, b) => b[1] - a[1]);
    if (sortedCategories[0][1] > 0) {
      primaryCategory = sortedCategories[0][0];
    }
  }

  // Pick a representative day that matches primaryCategory if possible
  const representativeDay =
    activeDays.find(
      (d) => classifyFocusCategory(`${d.workoutTitle} ${d.exercises}`) === primaryCategory,
    ) ?? primaryDay;

  const meta = CATEGORY_METADATA[primaryCategory];

  // Build weekly headline routine items (1–2 lead lifts from each active day, up to 6)
  const weeklyKeyLifts: string[] = [];
  for (const day of activeDays) {
    const lifts = extractExerciseList(day.exercises, 2);
    if (lifts.length > 0) {
      weeklyKeyLifts.push(`${day.shortName}: ${lifts[0]}`);
    }
    if (weeklyKeyLifts.length >= 6) break;
  }

  const focusTitle =
    representativeDay && activeDays.length > 0
      ? `${splitLabel} — ${representativeDay.workoutTitle}`
      : `${splitLabel} Routine`;

  const cleanRepTitle = representativeDay?.workoutTitle
    .replace(/\s*[—–-]\s*/g, ' ')
    .trim();
  const youtubeSearchQuery = cleanRepTitle
    ? `${cleanRepTitle} workout form guide`
    : `${splitLabel} strength training workout guide`;

  return {
    scope: 'week',
    category: primaryCategory,
    categoryLabel: meta.label,
    focusTitle,
    splitLabel,
    focusSubtitle: `${activeDays.length} Training Days · ${totalWeeklyMinutes} min/wk · ${plan.holidayTag}`,
    durationMinutes: representativeDay?.durationMinutes ?? 45,
    totalWeeklyMinutes,
    activeDaysCount: activeDays.length,
    restDaysCount,
    caloriesTarget: plan.caloriesTarget,
    proteinTarget: plan.proteinTarget,
    keyExercises:
      weeklyKeyLifts.length > 0
        ? weeklyKeyLifts
        : ['Add exercises to your training days to populate this routine'],
    warmupCues: representativeDay?.warmup?.trim() || meta.fallbackWarmup,
    targetMuscles: meta.muscles,
    defaultFormCues: meta.cues,
    tempoNote: meta.tempo,
    youtubeSearchQuery,
    youtubeSearchUrl: buildYouTubeSearchUrl(youtubeSearchQuery),
  };
}

const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeUrl(
  rawInput: string,
): { ok: true; url: string; videoId?: string } | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: 'Paste a YouTube video or playlist URL.' };
  }

  // Reject javascript: or data: schemes early
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return { ok: false, error: 'Please enter a valid https://youtube.com or youtu.be link.' };
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: 'That does not look like a valid URL.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  if (host !== 'youtube.com' && host !== 'youtu.be' && host !== 'youtube-nocookie.com') {
    return {
      ok: false,
      error: 'URL must be a YouTube link (youtube.com or youtu.be).',
    };
  }

  let videoId: string | undefined;

  if (host === 'youtu.be') {
    const seg = parsed.pathname.split('/').filter(Boolean)[0];
    if (seg && YOUTUBE_VIDEO_ID_RE.test(seg)) {
      videoId = seg;
    }
  } else {
    const vParam = parsed.searchParams.get('v');
    if (vParam && YOUTUBE_VIDEO_ID_RE.test(vParam)) {
      videoId = vParam;
    } else {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (
        (pathParts[0] === 'shorts' || pathParts[0] === 'embed' || pathParts[0] === 'live') &&
        pathParts[1] &&
        YOUTUBE_VIDEO_ID_RE.test(pathParts[1])
      ) {
        videoId = pathParts[1];
      }
    }
  }

  if (videoId) {
    return {
      ok: true,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
    };
  }

  // Allow valid YouTube search results, playlists, or channel URLs
  if (
    parsed.pathname.startsWith('/results') ||
    parsed.pathname.startsWith('/playlist') ||
    parsed.pathname.startsWith('/@') ||
    parsed.pathname.startsWith('/c/') ||
    parsed.pathname.startsWith('/channel/')
  ) {
    return {
      ok: true,
      url: `https://www.youtube.com${parsed.pathname}${parsed.search}`,
    };
  }

  return {
    ok: false,
    error: 'Could not recognize a valid YouTube video, Shorts, or playlist URL.',
  };
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function extractYouTubeLinksFromGrounding(
  groundingChunks: unknown,
  responseText = '',
  fallbackTitle = 'Workout Form & Routine Guide',
): YouTubeResource[] {
  const results: YouTubeResource[] = [];
  const seenKeys = new Set<string>();

  const pushCandidate = (rawUrl: string, title?: string, channel?: string) => {
    const parsed = parseYouTubeUrl(rawUrl);
    if (!parsed.ok) return;
    const dedupKey = parsed.videoId ?? parsed.url;
    if (seenKeys.has(dedupKey)) return;
    seenKeys.add(dedupKey);
    results.push({
      title: (title || '').replace(/\s*-\s*YouTube\s*$/i, '').trim() || fallbackTitle,
      url: parsed.url,
      videoId: parsed.videoId,
      channel: channel?.trim() || undefined,
      source: 'ai-grounded',
    });
  };

  if (Array.isArray(groundingChunks)) {
    for (const chunk of groundingChunks) {
      if (!chunk || typeof chunk !== 'object') continue;
      const web = (chunk as { web?: { uri?: unknown; title?: unknown } }).web;
      if (web && typeof web.uri === 'string') {
        const title = typeof web.title === 'string' ? web.title : fallbackTitle;
        pushCandidate(web.uri, title);
      }
    }
  }

  // Also scan response text for direct YouTube URLs mentioned by the grounded response
  const urlMatches = responseText.match(
    /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s)"'<>]+|shorts\/[a-zA-Z0-9_-]{11})|youtu\.be\/[a-zA-Z0-9_-]{11})/gi,
  );
  if (urlMatches) {
    for (const rawUrl of urlMatches) {
      const cleaned = rawUrl.replace(/[.,;!?]+$/, '');
      pushCandidate(cleaned, fallbackTitle);
    }
  }

  return results.slice(0, 3);
}

export function buildWorkoutVisualBriefPrompt(focus: WorkoutFocusSummary): string {
  return [
    'Use Google Search to find 2–3 real, reputable YouTube strength-training tutorial videos (e.g., from evidence-based coaches like Jeff Nippard, Renaissance Periodization, Squat University, Jeremy Ethier, or Athlean-X) that directly match this training focus.',
    '',
    `Focus Title: ${focus.focusTitle}`,
    `Split: ${focus.splitLabel}`,
    `Category: ${focus.categoryLabel}`,
    `Key Exercises: ${focus.keyExercises.join(' | ')}`,
    `Warm-up: ${focus.warmupCues}`,
    `Daily Targets: ${focus.caloriesTarget} kcal, ${focus.proteinTarget}g protein`,
    '',
    'Return ONLY a raw JSON object (no markdown fences) with this exact shape:',
    '{',
    '  "headline": "Short 4-7 word athletic poster headline for this routine",',
    '  "intensityNote": "Concise 1-sentence tempo/RPE and rest-period guidance",',
    '  "formCues": ["3 short biomechanics cues, max 16 words each"],',
    '  "targetMuscles": ["3 to 4 primary muscles worked"],',
    '  "searchQuery": "Best concise YouTube search query for this exact routine",',
    '  "videos": [',
    '    { "title": "Exact video title", "url": "https://www.youtube.com/watch?v=...", "channel": "Channel Name" }',
    '  ]',
    '}',
    'Only include real YouTube URLs confirmed from Google Search results. If no direct watch URL is confirmed, return an empty videos array and a sharp searchQuery.',
  ].join('\n');
}
