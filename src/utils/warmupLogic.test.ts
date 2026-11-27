import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferMuscleGroup,
  recommendWarmupForSession,
} from './warmupLogic.ts';

test('inferMuscleGroup identifies muscle groups from titles and exercises', () => {
  assert.equal(
    inferMuscleGroup('Push A — Chest & Shoulders', 'Flat Bench 4×6', false),
    'push-chest',
  );
  assert.equal(
    inferMuscleGroup('Push B — Overhead & Upper Chest', 'Overhead Press 4×6', false),
    'push-overhead',
  );
  assert.equal(
    inferMuscleGroup('Pull A — Back & Biceps', 'Weighted Pull-Ups 4×6', false),
    'pull-back',
  );
  assert.equal(
    inferMuscleGroup('Pull B — Posterior & Width', 'Deadlift 3×5, Lat Pulldown', false),
    'pull-posterior',
  );
  assert.equal(
    inferMuscleGroup('Legs A — Quad Focus', 'Back Squat 4×6', false),
    'legs-quad',
  );
  assert.equal(
    inferMuscleGroup('Legs B — Hamstring & Glute', 'Hip Thrust 4×10', false),
    'legs-hamstring',
  );
  assert.equal(
    inferMuscleGroup('Upper A — Strength', 'Barbell Bench, Pendlay Row', false),
    'upper',
  );
  assert.equal(
    inferMuscleGroup('Full Body A', 'Back Squat, Bench Press, Barbell Row', false),
    'full-body',
  );
  assert.equal(
    inferMuscleGroup('Arms & Core', 'Hammer Curls, Plank', false),
    'arms-core',
  );
  assert.equal(
    inferMuscleGroup('Active Recovery & Mobility', '35-min walk', true),
    'rest',
  );
});

test('inferMuscleGroup falls back to exercises when workout title is generic', () => {
  assert.equal(
    inferMuscleGroup('Monday Session', 'Back Squat 4×6, Leg Extension 3×15', false),
    'legs-quad',
  );
  assert.equal(
    inferMuscleGroup('Day 2', 'Barbell Row 4×8, Lat Pulldown 4×10', false),
    'pull-back',
  );
});

test('recommendWarmupForSession returns specific movements for training days and empty string for rest days', () => {
  const pushWarmup = recommendWarmupForSession('Push A — Chest & Shoulders', 'Flat Bench 4×6', false);
  assert.match(pushWarmup, /band pull-aparts|scapular/i);

  const legWarmup = recommendWarmupForSession('Legs A — Quad Focus', 'Back Squat 4×6', false);
  assert.match(legWarmup, /ankle|squat|leg swings/i);

  const restWarmup = recommendWarmupForSession('Full Rest Day', 'Hydrate', true);
  assert.equal(restWarmup, '');
});
