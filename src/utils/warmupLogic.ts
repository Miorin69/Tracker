export type MuscleGroupFocus =
  | 'push-chest'
  | 'push-overhead'
  | 'pull-back'
  | 'pull-posterior'
  | 'legs-quad'
  | 'legs-hamstring'
  | 'upper'
  | 'lower'
  | 'full-body'
  | 'arms-core'
  | 'quick-circuit'
  | 'rest';

const WARMUP_BY_FOCUS: Record<MuscleGroupFocus, string> = {
  'push-chest':
    '5 min: Band pull-aparts 2×15, scapular wall slides 2×10, arm circles & 2 light press ramp-up sets',
  'push-overhead':
    '5 min: Thoracic extensions 2×8, band external rotations 2×12, Y-T-W raises & empty-bar OHP',
  'pull-back':
    '5 min: Dead hangs 2×20s, scapular pull-ups 2×10, band face pulls 2×15 & light row ramp-up',
  'pull-posterior':
    '6 min: Cat-cow 1×10, glute bridges 2×12, dowel hip hinges 2×10 & light deadlift ramp-up',
  'legs-quad':
    '6 min: Leg swings 2×10/side, ankle rocks 2×10, goblet squat pry 2×8 & 2 light squat sets',
  'legs-hamstring':
    '6 min: 90/90 hip switches 2×8, glute bridges 2×12, inchworms 2×6 & light hinge ramp-up',
  upper:
    '5 min: Band dislocates 2×12, band pull-aparts 2×15, scapular push-ups 2×10 & light ramp-up',
  lower:
    "6 min: World's greatest stretch 2×5/side, glute bridges 2×12, bodyweight squats 2×10 & ramp-up",
  'full-body':
    "6 min: World's greatest stretch 2×5/side, band pull-aparts 2×15, bodyweight squats 2×10 & empty-bar ramp-up",
  'arms-core':
    '4 min: Band curls & pushdowns 2×15, wrist circles, dead bugs 2×8 & light ramp-up',
  'quick-circuit':
    "3 min: Jumping jacks 45s, arm circles, bodyweight squats ×10 & world's greatest stretch",
  rest: '',
};

/**
 * Infers the primary muscle group focus from a workout title and exercise list
 * so warm-up recommendations match the session's target joints and tissues.
 */
export function inferMuscleGroup(
  workoutTitle: string,
  exercises: string,
  isRestDay: boolean,
): MuscleGroupFocus {
  if (isRestDay) return 'rest';

  const title = workoutTitle.toLowerCase();
  const combined = `${title} ${exercises.toLowerCase()}`;

  // Explicit rest/recovery wording when not flagged
  if (/\b(full rest|rest day|off day)\b/.test(title)) {
    return 'rest';
  }

  // Express / circuit sessions
  if (/\b(express|circuit|hiit|quick)\b/.test(title)) {
    if (/\b(lower|leg|squat|glute|hamstring)\b/.test(title)) return 'lower';
    if (/\b(upper|push|pull|chest|back|shoulder)\b/.test(title)) return 'upper';
    return 'quick-circuit';
  }

  // Full body
  if (/\bfull[\s-]?body\b/.test(title)) {
    return 'full-body';
  }

  // Upper / Lower split titles
  if (/\bupper\b/.test(title) && !/\bupper chest\b/.test(title)) {
    return 'upper';
  }
  if (/\blower\b/.test(title)) {
    if (/\b(deadlift|hinge|hamstring|glute|posterior)\b/.test(title)) {
      return 'legs-hamstring';
    }
    return 'lower';
  }

  // Push / Chest / Shoulders
  if (/\b(push|chest|pec|bench|shoulder|delt|overhead)\b/.test(title)) {
    if (/\b(overhead|shoulder|delt|ohp)\b/.test(title) && !/\bchest\s*&\s*shoulder/.test(title)) {
      return 'push-overhead';
    }
    return 'push-chest';
  }

  // Pull / Back / Posterior
  if (/\b(pull|back|lat|row|posterior)\b/.test(title)) {
    if (/\b(posterior|deadlift|hinge)\b/.test(title) || /\bdeadlift\b/.test(combined)) {
      return 'pull-posterior';
    }
    return 'pull-back';
  }

  // Legs / Quads / Hamstrings / Glutes
  if (/\b(leg|quad|squat|hamstring|glute|calf|calves)\b/.test(title)) {
    if (/\b(hamstring|glute|posterior|hip thrust|rdl)\b/.test(title)) {
      return 'legs-hamstring';
    }
    return 'legs-quad';
  }

  // Arms / Core specialization
  if (/\b(arm|bicep|tricep|core|ab|abs)\b/.test(title)) {
    return 'arms-core';
  }

  // Fallback: infer from exercises when title is custom/generic (e.g., "Day 1")
  const hasSquatQuad = /\b(squat|leg press|leg extension|lunge|split squat)\b/.test(combined);
  const hasHingeHam = /\b(deadlift|rdl|hip thrust|leg curl|glute)\b/.test(combined);
  const hasPress = /\b(bench|press|dip|flye|push-up|pushdown|lateral raise)\b/.test(combined);
  const hasPull = /\b(pull-up|chin-up|row|pulldown|face pull|curl)\b/.test(combined);

  const hasLower = hasSquatQuad || hasHingeHam;
  const hasUpper = hasPress || hasPull;

  if (hasLower && hasUpper) return 'full-body';
  if (hasLower) return hasHingeHam && !hasSquatQuad ? 'legs-hamstring' : 'legs-quad';
  if (hasPress && hasPull) return 'upper';
  if (hasPress) return 'push-chest';
  if (hasPull) return 'pull-back';

  return 'full-body';
}

/**
 * Returns a brief, muscle-group-specific warm-up recommendation for a training session,
 * or an empty string for rest days.
 */
export function recommendWarmupForSession(
  workoutTitle: string,
  exercises: string,
  isRestDay: boolean,
): string {
  const focus = inferMuscleGroup(workoutTitle, exercises, isRestDay);
  return WARMUP_BY_FOCUS[focus];
}
