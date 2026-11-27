export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SplitPresetId =
  | 'ppl'
  | 'upper-lower'
  | 'full-body'
  | 'holiday-maintenance';

export type PrepTimeLimit = '30 mins' | '60 mins' | '90+ mins';

export type ChecklistCategory = 'prep' | 'grocery';

export interface StapleMeals {
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
}

export interface DayMealOverrides {
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  snack?: string;
}

export interface DaySchedule {
  dayIndex: DayIndex;
  dayName: string;
  shortName: string;
  workoutTitle: string;
  warmup?: string;
  exercises: string;
  durationMinutes: number;
  isRestDay: boolean;
  mealOverrides?: DayMealOverrides;
}

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  text: string;
  checked: boolean;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface DayMacroProgress {
  completedMeals: MealSlot[];
  extraCalories: number;
  extraProtein: number;
  workoutCompleted?: boolean;
}

export interface WeeklyPlan {
  version: number;
  weekStartDate: string; // YYYY-MM-DD
  holidayTag: string;
  holidayNotes?: string;
  activeHolidayPlanId?: string;
  caloriesTarget: number;
  proteinTarget: number;
  splitPreset: SplitPresetId;
  customSplitLabel?: string;
  prepTimeLimit: PrepTimeLimit;
  stapleMeals: StapleMeals;
  days: DaySchedule[];
  checklist: ChecklistItem[];
  dailyProgress?: Partial<Record<DayIndex, DayMacroProgress>>;
}

export interface CustomHolidayPlan {
  id: string;
  name: string;
  notes: string;
  caloriesTarget: number;
  proteinTarget: number;
  prepTimeLimit: PrepTimeLimit;
  splitPreset: SplitPresetId;
  customSplitLabel?: string;
  stapleMeals: StapleMeals;
  days: DaySchedule[];
  checklist: ChecklistItem[];
  updatedAt: string;
}

export interface SavedPreset {
  id: string;
  name: string;
  savedAt: string;
  plan: WeeklyPlan;
}
