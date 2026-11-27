import type {
  ChecklistItem,
  DaySchedule,
  PrepTimeLimit,
  SplitPresetId,
  StapleMeals,
} from '../types/plan.ts';

export const DAY_NAMES: ReadonlyArray<{ full: string; short: string }> = [
  { full: 'Monday', short: 'Mon' },
  { full: 'Tuesday', short: 'Tue' },
  { full: 'Wednesday', short: 'Wed' },
  { full: 'Thursday', short: 'Thu' },
  { full: 'Friday', short: 'Fri' },
  { full: 'Saturday', short: 'Sat' },
  { full: 'Sunday', short: 'Sun' },
];

export const DEFAULT_WEEK_TAG = 'Normal Week';

export const PREP_TIME_LIMITS: ReadonlyArray<PrepTimeLimit> = [
  '30 mins',
  '60 mins',
  '90+ mins',
];

export interface SplitPresetDefinition {
  id: SplitPresetId;
  label: string;
  summary: string;
  days: Array<{
    workoutTitle: string;
    warmup: string;
    exercises: string;
    durationMinutes: number;
    isRestDay: boolean;
  }>;
}

export const SPLIT_PRESETS: ReadonlyArray<SplitPresetDefinition> = [
  {
    id: 'ppl',
    label: 'Push / Pull / Legs',
    summary: '6-day hypertrophy split + Sunday recovery',
    days: [
      {
        workoutTitle: 'Push A — Chest & Shoulders',
        warmup: '5 min: Band pull-aparts 2×15, scapular wall slides 2×10, arm circles & 2 light bench ramp-up sets',
        exercises: 'Flat Bench 4×6, Incline DB Press 3×10, Overhead Press 3×8, Lateral Raise 4×15, Triceps Pushdown 3×12',
        durationMinutes: 60,
        isRestDay: false,
      },
      {
        workoutTitle: 'Pull A — Back & Biceps',
        warmup: '5 min: Dead hangs 2×20s, scapular pull-ups 2×10, band face pulls 2×15 & light row ramp-up',
        exercises: 'Weighted Pull-Ups 4×6, Barbell Row 4×8, Seated Cable Row 3×12, Face Pulls 3×15, Hammer Curls 3×12',
        durationMinutes: 60,
        isRestDay: false,
      },
      {
        workoutTitle: 'Legs A — Quad Focus',
        warmup: '6 min: Leg swings 2×10/side, ankle rocks 2×10, goblet squat pry 2×8 & 2 light squat sets',
        exercises: 'Back Squat 4×6, Romanian Deadlift 3×8, Bulgarian Split Squat 3×10/leg, Leg Extension 3×15, Standing Calf Raise 4×15',
        durationMinutes: 65,
        isRestDay: false,
      },
      {
        workoutTitle: 'Push B — Overhead & Upper Chest',
        warmup: '5 min: Thoracic extensions 2×8, band external rotations 2×12, Y-T-W raises & empty-bar OHP',
        exercises: 'Overhead Press 4×6, Weighted Dips 3×8, Cable Flye 3×14, DB Lateral Raise 4×15, Overhead Triceps Ext. 3×12',
        durationMinutes: 55,
        isRestDay: false,
      },
      {
        workoutTitle: 'Pull B — Posterior & Width',
        warmup: '6 min: Cat-cow 1×10, glute bridges 2×12, dowel hip hinges 2×10 & light deadlift ramp-up',
        exercises: 'Deadlift 3×5, Lat Pulldown 4×10, Chest-Supported Row 3×10, Rear Delt Flye 3×15, EZ-Bar Curl 3×10',
        durationMinutes: 60,
        isRestDay: false,
      },
      {
        workoutTitle: 'Legs B — Hamstring & Glute',
        warmup: '6 min: 90/90 hip switches 2×8, glute bridges 2×12, inchworms 2×6 & light front-squat ramp-up',
        exercises: 'Front Squat 4×8, Hip Thrust 4×10, Lying Leg Curl 4×12, Walking Lunges 3×12/leg, Hanging Leg Raise 3×15',
        durationMinutes: 60,
        isRestDay: false,
      },
      {
        workoutTitle: 'Active Recovery & Mobility',
        warmup: '',
        exercises: '35-min Zone 2 brisk walk, thoracic spine opener, hip flexor stretch, foam rolling',
        durationMinutes: 35,
        isRestDay: true,
      },
    ],
  },
  {
    id: 'upper-lower',
    label: 'Upper / Lower (4-Day)',
    summary: '4 strength sessions + 3 recovery / conditioning days',
    days: [
      {
        workoutTitle: 'Upper A — Strength',
        warmup: '5 min: Band dislocates 2×12, band pull-aparts 2×15, scapular push-ups 2×10 & empty-bar bench',
        exercises: 'Barbell Bench 4×5, Pendlay Row 4×6, Overhead Press 3×8, Pull-Ups 3×AMRAP, Cable Curl & Pushdown superset 3×12',
        durationMinutes: 60,
        isRestDay: false,
      },
      {
        workoutTitle: 'Lower A — Squat & Hinge',
        warmup: '6 min: Leg swings 2×10/side, ankle rocks 2×10, glute bridges 2×12 & 2 light squat ramp-up sets',
        exercises: 'Back Squat 4×5, Romanian Deadlift 3×8, Leg Press 3×12, Seated Leg Curl 3×12, Plank 3×60s',
        durationMinutes: 60,
        isRestDay: false,
      },
      {
        workoutTitle: 'Rest & Zone 2 Cardio',
        warmup: '',
        exercises: '8,000–10,000 steps outdoor walk, 10-min shoulder & hip mobility',
        durationMinutes: 30,
        isRestDay: true,
      },
      {
        workoutTitle: 'Upper B — Hypertrophy',
        warmup: '5 min: Arm circles, band external rotations 2×12, scapular wall slides 2×10 & light DB press',
        exercises: 'Incline DB Press 4×10, Chest-Supported Row 4×10, DB Lateral Raise 4×15, Lat Pulldown 3×12, Face Pulls 3×15',
        durationMinutes: 55,
        isRestDay: false,
      },
      {
        workoutTitle: 'Lower B — Deadlift & Unilateral',
        warmup: "6 min: 90/90 hip switches 2×8, world's greatest stretch 2×5/side, dowel hinges 2×10 & light pulls",
        exercises: 'Trap Bar Deadlift 4×5, Bulgarian Split Squat 3×10/leg, Leg Extension 3×15, Calf Raise 4×15, Dead Bug 3×12',
        durationMinutes: 60,
        isRestDay: false,
      },
      {
        workoutTitle: 'Conditioning & Core',
        warmup: '',
        exercises: '25-min incline treadmill walk or cycling intervals, hanging knee raises 3×12',
        durationMinutes: 35,
        isRestDay: true,
      },
      {
        workoutTitle: 'Full Rest Day',
        warmup: '',
        exercises: 'Complete recovery, hydration focus, light stretching if stiff',
        durationMinutes: 0,
        isRestDay: true,
      },
    ],
  },
  {
    id: 'full-body',
    label: 'Full Body (3-Day)',
    summary: 'Mon / Wed / Fri compound lifts for busy schedules',
    days: [
      {
        workoutTitle: 'Full Body A',
        warmup: "6 min: World's greatest stretch 2×5/side, band pull-aparts 2×15, bodyweight squats 2×10 & bar ramp-up",
        exercises: 'Back Squat 3×6, Flat Bench Press 3×6, Barbell Row 3×8, DB Lateral Raise 3×15, Plank 3×60s',
        durationMinutes: 55,
        isRestDay: false,
      },
      {
        workoutTitle: 'Active Recovery',
        warmup: '',
        exercises: '30-min brisk walk, hip & ankle mobility routine',
        durationMinutes: 30,
        isRestDay: true,
      },
      {
        workoutTitle: 'Full Body B',
        warmup: '6 min: Glute bridges 2×12, dowel hip hinges 2×10, scapular wall slides 2×10 & light RDL ramp-up',
        exercises: 'Romanian Deadlift 3×8, Overhead Press 3×8, Weighted Pull-Ups 3×8, Walking Lunges 3×10/leg, Face Pulls 3×15',
        durationMinutes: 55,
        isRestDay: false,
      },
      {
        workoutTitle: 'Active Recovery',
        warmup: '',
        exercises: '30-min light cycling or outdoor steps, thoracic mobility',
        durationMinutes: 30,
        isRestDay: true,
      },
      {
        workoutTitle: 'Full Body C',
        warmup: '6 min: 90/90 hip switches 2×8, band dislocates 2×12, inchworms 2×6 & light trap-bar ramp-up',
        exercises: 'Trap Bar Deadlift 3×5, Incline DB Press 3×10, Seated Cable Row 3×10, Leg Press 3×12, Arms superset 3×12',
        durationMinutes: 55,
        isRestDay: false,
      },
      {
        workoutTitle: 'Optional Conditioning',
        warmup: '',
        exercises: '30-min recreational sport, hike, or Zone 2 jog',
        durationMinutes: 30,
        isRestDay: true,
      },
      {
        workoutTitle: 'Full Rest Day',
        warmup: '',
        exercises: 'Complete recovery & weekly meal prep window',
        durationMinutes: 0,
        isRestDay: true,
      },
    ],
  },
  {
    id: 'holiday-maintenance',
    label: 'Quick Maintenance / Express Sessions',
    summary: '25–30 min high-efficiency sessions to retain strength',
    days: [
      {
        workoutTitle: 'Quick Upper Push/Pull',
        warmup: '3 min: Arm circles, band pull-aparts 1×20, scapular push-ups 1×12 & 1 light DB ramp-up',
        exercises: 'Superset: Incline DB Press 3×10 + One-Arm DB Row 3×10, Push-Ups 2×AMRAP, Band Pull-Aparts 3×20',
        durationMinutes: 25,
        isRestDay: false,
      },
      {
        workoutTitle: 'Holiday Walk & Mobility',
        warmup: '',
        exercises: '25-min post-meal family walk, 5-min full-body decompression stretch',
        durationMinutes: 30,
        isRestDay: true,
      },
      {
        workoutTitle: 'Quick Lower & Core',
        warmup: '3 min: Leg swings ×10/side, glute bridges 1×15, bodyweight squats ×12 & ankle rocks',
        exercises: 'Goblet Squat 4×12, Single-Leg RDL 3×10/leg, Reverse Lunges 3×10/leg, Hollow Body Hold 3×40s',
        durationMinutes: 25,
        isRestDay: false,
      },
      {
        workoutTitle: 'Full Rest / Event Day',
        warmup: '',
        exercises: 'Enjoy festivities, aim for 7,000+ casual steps and protein-first plates',
        durationMinutes: 0,
        isRestDay: true,
      },
      {
        workoutTitle: 'Express Full Body Circuit',
        warmup: "3 min: Jumping jacks 45s, arm circles, bodyweight squats ×10 & world's greatest stretch",
        exercises: '3 rounds: KB Swings ×15, Overhead Press ×10, Pull-Ups or Inverted Row ×10, Split Squats ×10/leg',
        durationMinutes: 30,
        isRestDay: false,
      },
      {
        workoutTitle: 'Active Walk / Stretch',
        warmup: '',
        exercises: '30-min morning walk before social plans',
        durationMinutes: 30,
        isRestDay: true,
      },
      {
        workoutTitle: 'Full Rest Day',
        warmup: '',
        exercises: 'Sleep recovery, hydrate, reset routine for Monday',
        durationMinutes: 0,
        isRestDay: true,
      },
    ],
  },
];

export const GYM_STAPLES_MEALS: StapleMeals = {
  breakfast: 'Greek yogurt bowl (250g), rolled oats (60g), berries, whey scoop & chia seeds',
  lunch: 'Grilled chicken breast (180g), jasmine rice (180g cooked), roasted broccoli & olive oil',
  dinner: 'Lean ground turkey or paneer stir-fry (180g), sweet potato (200g) & mixed greens',
  snack: 'Whey protein shake (1 scoop), 1 banana & roasted almonds (25g)',
};

export const QUICK_STAPLES_30M: StapleMeals = {
  breakfast: 'Overnight protein oats (60g oats, 1 scoop whey, 200ml milk, frozen berries)',
  lunch: 'Rotisserie chicken wrap (160g chicken, high-protein tortilla, spinach, tzatziki)',
  dinner: 'Pan-seared salmon or tofu (170g), microwave jasmine rice pouch & steamed edamame',
  snack: 'Low-fat cottage cheese (200g) with pineapple or apple slices',
};

export function buildDaysFromPreset(presetId: SplitPresetId): DaySchedule[] {
  const preset =
    SPLIT_PRESETS.find((item) => item.id === presetId) ?? SPLIT_PRESETS[0];

  return preset.days.map((day, idx) => ({
    dayIndex: idx as DaySchedule['dayIndex'],
    dayName: DAY_NAMES[idx].full,
    shortName: DAY_NAMES[idx].short,
    workoutTitle: day.workoutTitle,
    warmup: day.warmup,
    exercises: day.exercises,
    durationMinutes: day.durationMinutes,
    isRestDay: day.isRestDay,
  }));
}

export function buildDefaultChecklist(prepTimeLimit: PrepTimeLimit): ChecklistItem[] {
  const prepStepsByLimit: Record<PrepTimeLimit, string[]> = {
    '30 mins': [
      'Portion 4 jars of overnight protein oats (5 mins)',
      'Shred rotisserie chicken / portion pre-cooked protein into 4 lunch containers (10 mins)',
      'Wash & bag spinach, berries, and snack fruit for grab-and-go (5 mins)',
      'Pre-measure 4 whey protein scoops into shaker cups / travel funnels (5 mins)',
    ],
    '60 mins': [
      'Batch-cook 1.2kg chicken breast on sheet pan at 200°C / 400°F (25 mins)',
      'Cook 4 cups dry jasmine rice in rice cooker & cool into 5 containers (20 mins)',
      'Roast 2 trays of broccoli & cubed sweet potatoes alongside chicken (25 mins)',
      'Portion Greek yogurt & oat breakfast bowls for Mon–Thu (10 mins)',
      'Pre-bag almonds and pack gym shaker bottles (5 mins)',
    ],
    '90+ mins': [
      'Marinate & bake 1.4kg chicken breast + brown 800g lean turkey/paneer stir-fry (35 mins)',
      'Cook jasmine rice + roast sweet potatoes and two trays of seasonal vegetables (30 mins)',
      'Prep homemade high-protein yogurt sauce / vinaigrette dressing (10 mins)',
      'Assemble 5 labeled lunch boxes and 4 pre-portioned dinner trays (15 mins)',
      'Prep overnight oats jars & wash berries/greens for Mon–Fri (10 mins)',
    ],
  };

  const defaultGroceries: string[] = [
    'Chicken breast (1.2 kg) & lean ground turkey or paneer (800 g)',
    'Plain Greek yogurt (1 kg tub) & whey protein powder',
    'Jasmine rice (1 kg) & rolled oats (1 kg)',
    'Sweet potatoes (1.2 kg) & bananas (7 pcs)',
    'Broccoli crowns (3 heads), mixed salad greens & fresh/frozen berries',
    'Chia seeds, raw almonds (200 g) & extra-virgin olive oil',
  ];

  const prepItems: ChecklistItem[] = prepStepsByLimit[prepTimeLimit].map(
    (text, idx) => ({
      id: `prep-default-${idx + 1}`,
      category: 'prep',
      text,
      checked: false,
    }),
  );

  const groceryItems: ChecklistItem[] = defaultGroceries.map((text, idx) => ({
    id: `grocery-default-${idx + 1}`,
    category: 'grocery',
    text,
    checked: false,
  }));

  return [...prepItems, ...groceryItems];
}
