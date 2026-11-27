import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToIsoDate,
  applySplitPresetToPlan,
  computeWeeklyTrainingSummary,
  createDefaultPlan,
  deleteChecklistItems,
  deriveChecklistFromMeals,
  formatWeekRange,
  generateMarkdown,
  generateStandaloneHtml,
  getUpcomingMonday,
  moveChecklistItemsCategory,
  parseImportedPlan,
  sortChecklistByCategoryAndName,
} from './planLogic';

test('getUpcomingMonday computes the upcoming Monday accurately across all weekdays', () => {
  // Wednesday, Nov 25, 2026 -> Monday, Nov 30, 2026
  assert.equal(getUpcomingMonday(new Date(2026, 10, 25)), '2026-11-30');
  // Monday, Nov 30, 2026 -> stays Monday, Nov 30, 2026
  assert.equal(getUpcomingMonday(new Date(2026, 10, 30)), '2026-11-30');
  // Sunday, Nov 29, 2026 -> next day Monday, Nov 30, 2026
  assert.equal(getUpcomingMonday(new Date(2026, 10, 29)), '2026-11-30');
  // Tuesday, Dec 1, 2026 -> Monday, Dec 7, 2026
  assert.equal(getUpcomingMonday(new Date(2026, 11, 1)), '2026-12-07');
});

test('addDaysToIsoDate and formatWeekRange handle month and year transitions', () => {
  assert.equal(addDaysToIsoDate('2026-11-30', 6), '2026-12-06');
  assert.equal(
    formatWeekRange('2026-11-30'),
    'Mon, Nov 30 – Sun, Dec 6, 2026',
  );
  assert.equal(
    formatWeekRange('2026-12-28'),
    'Mon, Dec 28, 2026 – Sun, Jan 3, 2027',
  );
});

test('applySplitPresetToPlan populates 7 days and computes training summary', () => {
  const base = createDefaultPlan(new Date(2026, 10, 25));
  const pplSummary = computeWeeklyTrainingSummary(base.days);
  assert.equal(pplSummary.trainingDays, 6);
  assert.equal(pplSummary.restDays, 1);
  assert.equal(pplSummary.totalMinutes, 395);
  assert.ok(base.days[0].warmup && base.days[0].warmup.length > 10);
  assert.equal(base.days[6].warmup, '');

  const upperLower = applySplitPresetToPlan(base, 'upper-lower');
  assert.equal(upperLower.splitPreset, 'upper-lower');
  assert.equal(upperLower.days.length, 7);
  const ulSummary = computeWeeklyTrainingSummary(upperLower.days);
  assert.equal(ulSummary.trainingDays, 4);
  assert.equal(ulSummary.restDays, 3);
  for (const day of upperLower.days) {
    if (day.isRestDay) {
      assert.equal(day.warmup, '');
    } else {
      assert.ok(day.warmup && day.warmup.length > 10);
    }
  }

  const fullBody = applySplitPresetToPlan(base, 'full-body');
  assert.ok(fullBody.days[0].warmup && fullBody.days[0].warmup.length > 10);
  assert.equal(fullBody.days[1].warmup, '');

  const holiday = applySplitPresetToPlan(base, 'holiday-maintenance');
  const holSummary = computeWeeklyTrainingSummary(holiday.days);
  assert.equal(holSummary.trainingDays, 3);
  assert.equal(holSummary.restDays, 4);
  assert.ok(holiday.days[0].warmup && holiday.days[0].warmup.length > 10);
});

test('generateMarkdown includes header metadata, 7 days, and checklist items', () => {
  const plan = createDefaultPlan(new Date(2026, 10, 25));
  plan.holidayTag = 'Diwali Week';
  plan.caloriesTarget = 2400;
  plan.proteinTarget = 175;
  plan.checklist[0].checked = true;

  const md = generateMarkdown(plan);
  assert.match(md, /Mon, Nov 30 – Sun, Dec 6, 2026/);
  assert.match(md, /Diwali Week/);
  assert.match(md, /2,400 kcal \| 175g protein/);
  assert.match(md, /### Monday \(Nov 30\)/);
  assert.match(md, /- \*\*Warm-up:\*\*/);
  assert.match(md, /### Sunday \(Dec 6\)/);
  assert.match(md, /- \[x\] /);
  assert.match(md, /## Consolidated Grocery List/);
});

test('parseImportedPlan validates valid plans and rejects invalid JSON payloads', () => {
  const original = createDefaultPlan(new Date(2026, 10, 25));
  original.holidayTag = 'Travel Week';
  const roundTripped = parseImportedPlan(JSON.stringify(original));
  assert.equal(roundTripped.ok, true);
  if (roundTripped.ok) {
    assert.equal(roundTripped.plan.holidayTag, 'Travel Week');
    assert.equal(roundTripped.plan.days.length, 7);
  }

  const badJson = parseImportedPlan('{not-valid-json');
  assert.equal(badJson.ok, false);

  const missingDays = parseImportedPlan(
    JSON.stringify({ weekStartDate: '2026-11-30', days: [] }),
  );
  assert.equal(missingDays.ok, false);

  const badDate = parseImportedPlan(
    JSON.stringify({ weekStartDate: '2026-02-31', days: original.days }),
  );
  assert.equal(badDate.ok, false);

  // Legacy plans without a warmup field should auto-backfill warm-ups on training days
  const legacyPlan = structuredClone(original);
  for (const d of legacyPlan.days) {
    delete d.warmup;
  }
  const parsedLegacy = parseImportedPlan(JSON.stringify(legacyPlan));
  assert.equal(parsedLegacy.ok, true);
  if (parsedLegacy.ok) {
    assert.ok(parsedLegacy.plan.days[0].warmup && parsedLegacy.plan.days[0].warmup.length > 10);
    assert.equal(parsedLegacy.plan.days[6].warmup, '');
  }
});

test('deriveChecklistFromMeals produces deduplicated groceries without dangling parentheses', () => {
  const items = deriveChecklistFromMeals(
    {
      breakfast: 'Overnight protein oats (60g oats, 1 scoop whey, 200ml milk, frozen berries)',
      lunch: 'Chicken breast (180g), jasmine rice, broccoli',
      dinner: 'Chicken breast, sweet potato, spinach',
      snack: 'Whey shake & banana',
    },
    '30 mins',
  );

  const prep = items.filter((i) => i.category === 'prep');
  const grocery = items.filter((i) => i.category === 'grocery');
  assert.equal(prep.length, 3);
  assert.ok(grocery.length >= 6);
  // Chicken breast should be deduplicated
  const chickenMatches = grocery.filter((g) =>
    g.text.toLowerCase().includes('chicken breast'),
  );
  assert.equal(chickenMatches.length, 1);

  // Zero unmatched parentheses
  for (const item of grocery) {
    const opens = (item.text.match(/\(/g) ?? []).length;
    const closes = (item.text.match(/\)/g) ?? []).length;
    assert.equal(opens, closes, `Unmatched parentheses in "${item.text}"`);
  }
});

test('generateStandaloneHtml produces self-contained HTML with escaped user text', () => {
  const plan = createDefaultPlan(new Date(2026, 10, 25));
  plan.holidayTag = 'Christmas & <New Year>';
  const html = generateStandaloneHtml(plan);
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Christmas &amp; &lt;New Year&gt;/);
  assert.match(html, /<strong>Warm-up:<\/strong>/);
  assert.match(html, /@media print/);
});

test('sortChecklistByCategoryAndName groups by category and sorts alphabetically without mutating input', () => {
  const input = [
    { id: 'g-1', category: 'grocery' as const, text: 'Zucchini', checked: false },
    { id: 'p-1', category: 'prep' as const, text: 'Roast sweet potatoes', checked: true },
    { id: 'g-2', category: 'grocery' as const, text: 'avocados (3)', checked: true },
    { id: 'p-2', category: 'prep' as const, text: 'batch-cook chicken', checked: false },
    { id: 'g-3', category: 'grocery' as const, text: 'Broccoli crowns', checked: false },
    { id: 'p-3', category: 'prep' as const, text: 'Portion 2 snacks', checked: false },
    { id: 'p-4', category: 'prep' as const, text: 'Portion 10 lunches', checked: false },
  ];
  const snapshot = structuredClone(input);

  const sorted = sortChecklistByCategoryAndName(input);

  // Input must not be mutated
  assert.deepEqual(input, snapshot);

  // Prep items come first, sorted case-insensitively with natural numeric ordering
  assert.deepEqual(
    sorted.map((item) => [item.category, item.text, item.checked]),
    [
      ['prep', 'batch-cook chicken', false],
      ['prep', 'Portion 2 snacks', false],
      ['prep', 'Portion 10 lunches', false],
      ['prep', 'Roast sweet potatoes', true],
      ['grocery', 'avocados (3)', true],
      ['grocery', 'Broccoli crowns', false],
      ['grocery', 'Zucchini', false],
    ],
  );

  // Empty array stays empty
  assert.deepEqual(sortChecklistByCategoryAndName([]), []);
});

test('deleteChecklistItems removes multiple selected items across categories without mutating input', () => {
  const input = [
    { id: 'p-1', category: 'prep' as const, text: 'Batch-cook chicken', checked: true },
    { id: 'p-2', category: 'prep' as const, text: 'Cook rice', checked: false },
    { id: 'g-1', category: 'grocery' as const, text: 'Broccoli', checked: false },
    { id: 'g-2', category: 'grocery' as const, text: 'Avocados', checked: true },
  ];
  const snapshot = structuredClone(input);

  const afterDelete = deleteChecklistItems(input, ['p-1', 'g-2', 'non-existent']);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(
    afterDelete.map((i) => i.id),
    ['p-2', 'g-1'],
  );

  // Empty selection returns shallow copy with all items intact
  const noOp = deleteChecklistItems(input, []);
  assert.equal(noOp.length, 4);
  assert.notEqual(noOp, input);
});

test('moveChecklistItemsCategory moves selected items to target category preserving checked state and immutability', () => {
  const input = [
    { id: 'p-1', category: 'prep' as const, text: 'Buy extra shakers', checked: true },
    { id: 'p-2', category: 'prep' as const, text: 'Cook rice', checked: false },
    { id: 'g-1', category: 'grocery' as const, text: 'Marinate tofu overnight', checked: false },
    { id: 'g-2', category: 'grocery' as const, text: 'Broccoli', checked: true },
  ];
  const snapshot = structuredClone(input);

  // Move mixed selection to grocery
  const movedToGrocery = moveChecklistItemsCategory(input, ['p-1', 'g-2'], 'grocery');
  assert.deepEqual(input, snapshot);
  assert.deepEqual(
    movedToGrocery.map((i) => [i.id, i.category, i.checked]),
    [
      ['p-1', 'grocery', true],
      ['p-2', 'prep', false],
      ['g-1', 'grocery', false],
      ['g-2', 'grocery', true],
    ],
  );

  // Move grocery item to prep
  const movedToPrep = moveChecklistItemsCategory(input, ['g-1'], 'prep');
  assert.equal(movedToPrep.find((i) => i.id === 'g-1')?.category, 'prep');
  assert.equal(movedToPrep.find((i) => i.id === 'g-1')?.text, 'Marinate tofu overnight');
});
