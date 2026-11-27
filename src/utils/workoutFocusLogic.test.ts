import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultPlan, applySplitPresetToPlan } from './planLogic.ts';
import {
  analyzeWorkoutFocus,
  classifyFocusCategory,
  extractYouTubeLinksFromGrounding,
  parseYouTubeUrl,
} from './workoutFocusLogic.ts';

test('classifyFocusCategory detects push, pull, legs, and full-body accurately', () => {
  assert.equal(
    classifyFocusCategory('Push (Chest / Shoulders / Triceps) Bench Press, Incline DB Press'),
    'push',
  );
  assert.equal(
    classifyFocusCategory('Pull (Back / Biceps) Weighted Pull-Ups, Barbell Row, Face Pulls'),
    'pull',
  );
  assert.equal(
    classifyFocusCategory('Legs (Quads / Hamstrings) Barbell Back Squat, RDL, Walking Lunges'),
    'legs',
  );
  assert.equal(
    classifyFocusCategory('Full Body Conditioning Kettlebell Swings & Circuit'),
    'full-body',
  );
});

test('analyzeWorkoutFocus derives weekly focus and specific day focus from active plan', () => {
  const pplPlan = createDefaultPlan();
  const weekFocus = analyzeWorkoutFocus(pplPlan, 'week');

  assert.equal(weekFocus.scope, 'week');
  assert.equal(weekFocus.activeDaysCount > 0, true);
  assert.equal(weekFocus.totalWeeklyMinutes > 0, true);
  assert.equal(weekFocus.keyExercises.length > 0, true);
  assert.match(weekFocus.youtubeSearchUrl, /^https:\/\/www\.youtube\.com\/results\?search_query=/);

  const legDayIndex = pplPlan.days.findIndex((d) =>
    d.workoutTitle.toLowerCase().includes('leg'),
  );
  assert.ok(legDayIndex >= 0, 'Default PPL plan should have a Legs day');
  const legFocus = analyzeWorkoutFocus(pplPlan, legDayIndex as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  assert.equal(legFocus.category, 'legs');
  assert.equal(legFocus.scope, legDayIndex);
  assert.ok(legFocus.targetMuscles.includes('Quadriceps'));

  const fullBodyPlan = applySplitPresetToPlan(pplPlan, 'full-body');
  const fullFocus = analyzeWorkoutFocus(fullBodyPlan, 'week');
  assert.equal(fullFocus.category, 'full-body');
});

test('parseYouTubeUrl validates and normalizes YouTube URLs while rejecting invalid/unsafe inputs', () => {
  const standard = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s');
  assert.equal(standard.ok, true);
  if (standard.ok) {
    assert.equal(standard.videoId, 'dQw4w9WgXcQ');
    assert.equal(standard.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  }

  const shortLink = parseYouTubeUrl('youtu.be/abcDEF12345');
  assert.equal(shortLink.ok, true);
  if (shortLink.ok) {
    assert.equal(shortLink.videoId, 'abcDEF12345');
    assert.equal(shortLink.url, 'https://www.youtube.com/watch?v=abcDEF12345');
  }

  const shorts = parseYouTubeUrl('https://m.youtube.com/shorts/xyz98765432');
  assert.equal(shorts.ok, true);
  if (shorts.ok) {
    assert.equal(shorts.videoId, 'xyz98765432');
  }

  const nonYouTube = parseYouTubeUrl('https://vimeo.com/12345678');
  assert.equal(nonYouTube.ok, false);

  const xss = parseYouTubeUrl('javascript:alert(1)');
  assert.equal(xss.ok, false);
});

test('extractYouTubeLinksFromGrounding extracts unique verified YouTube URLs only', () => {
  const chunks = [
    {
      web: {
        uri: 'https://www.youtube.com/watch?v=abcDEF12345',
        title: 'Perfect Push Day Form - YouTube',
      },
    },
    {
      web: {
        uri: 'https://example.com/not-youtube',
        title: 'Random Blog',
      },
    },
    {
      web: {
        uri: 'https://youtu.be/abcDEF12345',
        title: 'Duplicate Video',
      },
    },
  ];

  const text =
    'Check out https://www.youtube.com/watch?v=zyxWVU98765 for bench press technique.';
  const links = extractYouTubeLinksFromGrounding(chunks, text, 'Push Guide');

  assert.equal(links.length, 2);
  assert.equal(links[0].title, 'Perfect Push Day Form');
  assert.equal(links[0].videoId, 'abcDEF12345');
  assert.equal(links[1].videoId, 'zyxWVU98765');
});
