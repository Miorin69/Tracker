import type { WeeklyPlan } from '../types/plan.ts';

export type UnitSystem = 'metric' | 'imperial';

export type BmiCategory =
  | 'Underweight'
  | 'Healthy Weight'
  | 'Overweight'
  | 'Obese';

export type NutritionGoal = 'fat-loss' | 'maintain' | 'lean-bulk';

export interface BmiResult {
  valid: boolean;
  error?: string;
  bmi: number;
  category: BmiCategory;
  scalePercent: number;
  heightCm: number;
  weightKg: number;
  healthyWeightMinKg: number;
  healthyWeightMaxKg: number;
  healthyWeightMinLbs: number;
  healthyWeightMaxLbs: number;
  guidance: string;
  suggestedCalories: number;
  suggestedProtein: number;
}

export type TipCategory = 'Strength' | 'Nutrition' | 'Recovery' | 'Habit';

export interface FitnessTip {
  id: string;
  category: TipCategory;
  topic: string;
  title: string;
  summary: string;
  actionStep: string;
}

const MIN_BMI_SCALE = 15;
const MAX_BMI_SCALE = 40;
const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return roundToOneDecimal(kg / KG_PER_LB);
}

export function lbsToKg(lbs: number): number {
  return roundToOneDecimal(lbs * KG_PER_LB);
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return roundToOneDecimal((feet * 12 + inches) * CM_PER_INCH);
}

export function classifyBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy Weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

export function computeSuggestedTargets(
  weightKg: number,
  goal: NutritionGoal,
): { calories: number; protein: number } {
  // Practical training baseline (~31 kcal/kg maintenance for active lifters)
  const maintenance = weightKg * 31;
  const rawCalories =
    goal === 'fat-loss'
      ? maintenance - 400
      : goal === 'lean-bulk'
        ? maintenance + 250
        : maintenance;

  const calories = Math.min(
    5000,
    Math.max(1300, Math.round(rawCalories / 50) * 50),
  );

  // Protein between 1.8g/kg (lean bulk) and 2.1g/kg (fat loss) capped safely
  const proteinPerKg =
    goal === 'fat-loss' ? 2.1 : goal === 'maintain' ? 1.9 : 1.8;
  const protein = Math.min(
    320,
    Math.max(70, Math.round((weightKg * proteinPerKg) / 5) * 5),
  );

  return { calories, protein };
}

function getBmiGuidance(category: BmiCategory): string {
  switch (category) {
    case 'Underweight':
      return 'Prioritize progressive strength training with a steady 250–350 kcal surplus and calorie-dense whole foods to build lean mass.';
    case 'Healthy Weight':
      return 'Solid baseline for performance. Keep protein consistent at every meal and focus on progressive overload across your weekly split.';
    case 'Overweight':
      return 'Pair a sustainable 300–450 kcal daily deficit with high protein to preserve strength. Note: muscular lifters can read higher on BMI.';
    case 'Obese':
      return 'Focus on high-protein whole-food meals, daily walking steps, and joint-friendly resistance work for steady, sustainable fat loss.';
  }
}

export function calculateBmiFromMetric(
  heightCm: number,
  weightKg: number,
  goal: NutritionGoal = 'maintain',
): BmiResult {
  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
    return {
      valid: false,
      error: 'Enter a height between 100 and 250 cm.',
      bmi: 0,
      category: 'Healthy Weight',
      scalePercent: 0,
      heightCm: 0,
      weightKg: 0,
      healthyWeightMinKg: 0,
      healthyWeightMaxKg: 0,
      healthyWeightMinLbs: 0,
      healthyWeightMaxLbs: 0,
      guidance: '',
      suggestedCalories: 2200,
      suggestedProtein: 160,
    };
  }

  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) {
    return {
      valid: false,
      error: 'Enter a weight between 30 and 300 kg.',
      bmi: 0,
      category: 'Healthy Weight',
      scalePercent: 0,
      heightCm,
      weightKg: 0,
      healthyWeightMinKg: 0,
      healthyWeightMaxKg: 0,
      healthyWeightMinLbs: 0,
      healthyWeightMaxLbs: 0,
      guidance: '',
      suggestedCalories: 2200,
      suggestedProtein: 160,
    };
  }

  const heightMeters = heightCm / 100;
  const rawBmi = weightKg / (heightMeters * heightMeters);
  const bmi = roundToOneDecimal(rawBmi);
  const category = classifyBmi(bmi);

  const clampedForScale = Math.min(MAX_BMI_SCALE, Math.max(MIN_BMI_SCALE, rawBmi));
  const scalePercent = Math.round(
    ((clampedForScale - MIN_BMI_SCALE) / (MAX_BMI_SCALE - MIN_BMI_SCALE)) * 100,
  );

  const healthyWeightMinKg = roundToOneDecimal(18.5 * heightMeters * heightMeters);
  const healthyWeightMaxKg = roundToOneDecimal(24.9 * heightMeters * heightMeters);
  const healthyWeightMinLbs = Math.round(healthyWeightMinKg / KG_PER_LB);
  const healthyWeightMaxLbs = Math.round(healthyWeightMaxKg / KG_PER_LB);

  const targets = computeSuggestedTargets(weightKg, goal);

  return {
    valid: true,
    bmi,
    category,
    scalePercent,
    heightCm: roundToOneDecimal(heightCm),
    weightKg: roundToOneDecimal(weightKg),
    healthyWeightMinKg,
    healthyWeightMaxKg,
    healthyWeightMinLbs,
    healthyWeightMaxLbs,
    guidance: getBmiGuidance(category),
    suggestedCalories: targets.calories,
    suggestedProtein: targets.protein,
  };
}

export function calculateBmiFromImperial(
  feet: number,
  inches: number,
  weightLbs: number,
  goal: NutritionGoal = 'maintain',
): BmiResult {
  if (
    !Number.isFinite(feet) ||
    !Number.isFinite(inches) ||
    feet < 3 ||
    feet > 8 ||
    inches < 0 ||
    inches >= 12
  ) {
    return {
      valid: false,
      error: 'Enter height between 3 ft 0 in and 8 ft 11 in.',
      bmi: 0,
      category: 'Healthy Weight',
      scalePercent: 0,
      heightCm: 0,
      weightKg: 0,
      healthyWeightMinKg: 0,
      healthyWeightMaxKg: 0,
      healthyWeightMinLbs: 0,
      healthyWeightMaxLbs: 0,
      guidance: '',
      suggestedCalories: 2200,
      suggestedProtein: 160,
    };
  }

  if (!Number.isFinite(weightLbs) || weightLbs < 66 || weightLbs > 660) {
    return {
      valid: false,
      error: 'Enter a weight between 66 and 660 lb.',
      bmi: 0,
      category: 'Healthy Weight',
      scalePercent: 0,
      heightCm: 0,
      weightKg: 0,
      healthyWeightMinKg: 0,
      healthyWeightMaxKg: 0,
      healthyWeightMinLbs: 0,
      healthyWeightMaxLbs: 0,
      guidance: '',
      suggestedCalories: 2200,
      suggestedProtein: 160,
    };
  }

  const heightCm = (feet * 12 + inches) * CM_PER_INCH;
  const weightKg = weightLbs * KG_PER_LB;
  return calculateBmiFromMetric(heightCm, weightKg, goal);
}

export const FITNESS_TIPS: readonly FitnessTip[] = [
  {
    id: 'tip-double-progression',
    category: 'Strength',
    topic: 'Progressive Overload',
    title: 'Use double progression on compound lifts',
    summary:
      'Keep the weight fixed until you hit the top of your target rep range across all working sets with clean technique, then increase load by 2.5–5%.',
    actionStep:
      'Add 1 rep per set on your primary bench, row, or squat before adding plates next week.',
  },
  {
    id: 'tip-rir-calibration',
    category: 'Strength',
    topic: 'Intensity Control',
    title: 'Leave 1–2 reps in reserve on main sets',
    summary:
      'Training to 1–2 reps shy of technical failure stimulates near-maximal hypertrophy while protecting your joints and keeping session recovery predictable.',
    actionStep:
      'Stop your set the moment bar speed slows sharply and form begins to drift.',
  },
  {
    id: 'tip-specific-warmup',
    category: 'Strength',
    topic: 'Warm-Up Efficiency',
    title: 'Ramp up with the first movement of the day',
    summary:
      'Two to three progressive warm-up sets on your opening lift groove exact movement patterns far better than 20 minutes of generic cardio.',
    actionStep:
      'Perform 50% × 6, 70% × 3, and 85% × 1 of your working weight before set 1.',
  },
  {
    id: 'tip-controlled-eccentric',
    category: 'Strength',
    topic: 'Hypertrophy Technique',
    title: 'Control the lowering phase for 2–3 seconds',
    summary:
      'Slowing down the eccentric portion increases mechanical tension in the target muscle and eliminates momentum on rows, presses, and curls.',
    actionStep:
      'Count "one-thousand, two-thousand" on every descent during today’s accessory work.',
  },
  {
    id: 'tip-protein-anchor',
    category: 'Nutrition',
    topic: 'Protein Distribution',
    title: 'Anchor every meal with 35–45g of protein',
    summary:
      'Splitting daily protein evenly across 3–4 feedings maximizes muscle protein synthesis and makes hitting 150g+ effortless without late-night scrambling.',
    actionStep:
      'Check off Breakfast and Lunch early so you have at least 75g protein banked by 2 PM.',
  },
  {
    id: 'tip-preworkout-carbs',
    category: 'Nutrition',
    topic: 'Session Fuel',
    title: 'Eat easily digestible carbs 60–90 min before lifting',
    summary:
      'Pairing 30–50g of oats, rice, or fruit with lean protein before training keeps glycogen topped off and stabilizes strength on later sets.',
    actionStep:
      'Have a banana and whey shake or a rice bowl 1 hour before heavy lower-body days.',
  },
  {
    id: 'tip-hydration-electrolytes',
    category: 'Nutrition',
    topic: 'Hydration',
    title: 'Front-load water and sodium before training',
    summary:
      'Even mild 2% dehydration drops strength output and focus. A pinch of salt with 500 ml of water pre-session supports pump and endurance.',
    actionStep:
      'Drink 500 ml of water upon waking and another 500 ml during your workout.',
  },
  {
    id: 'tip-veg-protein-stacking',
    category: 'Nutrition',
    topic: 'Vegetarian Macros',
    title: 'Stack two plant or dairy proteins per veg meal',
    summary:
      'Combining tofu or paneer with Greek yogurt, lentils, edamame, or whey easily pushes vegetarian meals past 40g protein without excess calories.',
    actionStep:
      'Pair 150g grilled paneer or firm tofu with roasted edamame or high-protein yogurt dip.',
  },
  {
    id: 'tip-sleep-window',
    category: 'Recovery',
    topic: 'Sleep & CNS',
    title: 'Protect a consistent 7.5–8.5 hour sleep window',
    summary:
      'Muscle repair, growth hormone pulses, and neuromuscular coordination happen primarily during deep sleep; cutting sleep blunts strength gains.',
    actionStep:
      'Set a wind-down alarm 45 minutes before bed and keep screens dim.',
  },
  {
    id: 'tip-zone2-walks',
    category: 'Recovery',
    topic: 'Active Recovery',
    title: 'Walk 10 minutes after your two largest meals',
    summary:
      'Short post-meal walks improve glucose disposal, aid digestion, and add 2,000–3,000 low-fatigue steps without interfering with leg recovery.',
    actionStep:
      'Take a brisk 10-minute walk right after lunch and dinner on training days.',
  },
  {
    id: 'tip-deload-signals',
    category: 'Recovery',
    topic: 'Fatigue Management',
    title: 'Trim volume by 35% when joints ache for 2 weeks',
    summary:
      'A planned lighter week resets connective tissue and nervous system fatigue while keeping all your hard-earned strength intact.',
    actionStep:
      'Drop working sets from 4 to 2–3 while keeping bar weights crisp if performance stalls.',
  },
  {
    id: 'tip-rest-periods',
    category: 'Recovery',
    topic: 'Inter-Set Rest',
    title: 'Rest 2–3 minutes on heavy compounds',
    summary:
      'Rushing heavy squats, bench, or rows limits total volume and motor-unit recruitment. Save shorter 60-second rests for isolation exercises.',
    actionStep:
      'Use a 2-minute timer between heavy compound sets and 60–75s on arms or calves.',
  },
  {
    id: 'tip-batch-prep-30',
    category: 'Habit',
    topic: 'Fast Meal Prep',
    title: 'Batch-cook one protein + one carb twice a week',
    summary:
      'Prepping twice for 25 minutes beats a 3-hour marathon session: food stays fresher and you always have grab-and-go macro bowls ready.',
    actionStep:
      'Prep Sunday evening for Mon–Wed, then do a 25-minute refresh on Wednesday night.',
  },
  {
    id: 'tip-minimum-viable-day',
    category: 'Habit',
    topic: 'Consistency',
    title: 'Use a 20-minute fallback instead of skipping',
    summary:
      'On chaotic work or travel days, hitting 2 big movements and your protein target preserves momentum and keeps your weekly streak alive.',
    actionStep:
      'If short on time, superset one push and one pull movement for 3 hard sets each.',
  },
  {
    id: 'tip-environment-cues',
    category: 'Habit',
    topic: 'Friction Design',
    title: 'Pack your gym bag and shaker the night before',
    summary:
      'Removing tiny morning decisions makes showing up automatic, especially before early lifts or busy weekday commutes.',
    actionStep:
      'Place shoes, belt, and pre-scooped shaker by the door right after dinner.',
  },
  {
    id: 'tip-weekly-audit',
    category: 'Habit',
    topic: 'Adherence Tracking',
    title: 'Aim for 80%+ weekly adherence, not perfection',
    summary:
      'Averaging 80–90% on calories, protein, and workouts across months delivers dramatically better physique results than brief 100% sprints.',
    actionStep:
      'Review your Weekly Snapshot every Sunday night and tweak next week’s prep window.',
  },
];

export const TIP_CATEGORIES: readonly ('All' | TipCategory)[] = [
  'All',
  'Strength',
  'Nutrition',
  'Recovery',
  'Habit',
];

export function filterFitnessTips(
  tips: readonly FitnessTip[],
  category: 'All' | TipCategory,
  query: string,
  bookmarkedOnly: boolean,
  bookmarkedIds: readonly string[],
): FitnessTip[] {
  const normalizedQuery = query.trim().toLowerCase();
  const bookmarkSet = new Set(bookmarkedIds);

  return tips.filter((tip) => {
    if (bookmarkedOnly && !bookmarkSet.has(tip.id)) {
      return false;
    }
    if (category !== 'All' && tip.category !== category) {
      return false;
    }
    if (normalizedQuery) {
      const haystack =
        `${tip.title} ${tip.summary} ${tip.actionStep} ${tip.topic} ${tip.category}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }
    return true;
  });
}

export function pickContextualTip(
  plan: WeeklyPlan,
  tips: readonly FitnessTip[] = FITNESS_TIPS,
): FitnessTip {
  if (tips.length === 0) {
    return FITNESS_TIPS[0];
  }

  if (plan.prepTimeLimit === '30 mins') {
    const fastPrep = tips.find((t) => t.id === 'tip-batch-prep-30');
    if (fastPrep) return fastPrep;
  }

  if (plan.proteinTarget >= 170) {
    const proteinTip = tips.find((t) => t.id === 'tip-protein-anchor');
    if (proteinTip) return proteinTip;
  }

  const trainingDays = plan.days.filter((d) => !d.isRestDay).length;
  if (trainingDays >= 5) {
    const recoveryTip = tips.find((t) => t.id === 'tip-sleep-window');
    if (recoveryTip) return recoveryTip;
  }

  return tips[0];
}
