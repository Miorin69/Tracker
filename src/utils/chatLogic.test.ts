import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultPlan } from './planLogic';
import {
  buildApplyInstructionFromChat,
  buildChatSystemInstruction,
  buildGeminiChatHistory,
  sanitizeChatHistory,
  type ChatMessage,
} from './chatLogic';

test('sanitizeChatHistory trims invalid items, bounds length, and starts on a user turn', () => {
  const raw = [
    { role: 'model', text: 'Leading model message should be dropped' },
    { role: 'user', text: '   First valid user message  ' },
    { role: 'assistant', text: 'Invalid role should be ignored' },
    { role: 'model', text: 'Valid model reply' },
    { role: 'user', text: '   ' },
    { role: 'user', text: 'Second user turn' },
  ];

  const cleaned = sanitizeChatHistory(raw, 10);
  assert.deepEqual(cleaned, [
    { role: 'user', text: 'First valid user message' },
    { role: 'model', text: 'Valid model reply' },
    { role: 'user', text: 'Second user turn' },
  ]);

  // When maxMessages truncates onto a model turn, drops leading model turn
  const capped = sanitizeChatHistory(raw, 2);
  assert.deepEqual(capped, [{ role: 'user', text: 'Second user turn' }]);
});

test('buildGeminiChatHistory maps ChatTurn array into @google/genai Content entries', () => {
  const history = buildGeminiChatHistory([
    { role: 'user', text: 'Keep Thursday short' },
    { role: 'model', text: 'Let us trim Thursday to 35 minutes.' },
  ]);

  assert.deepEqual(history, [
    { role: 'user', parts: [{ text: 'Keep Thursday short' }] },
    { role: 'model', parts: [{ text: 'Let us trim Thursday to 35 minutes.' }] },
  ]);
});

test('buildChatSystemInstruction includes Coach Hishay persona, active plan, and selected item', () => {
  const plan = createDefaultPlan();
  const prompt = buildChatSystemInstruction('coach', plan, {
    kind: 'exercise',
    dayIndex: 0,
    dayName: 'Monday',
    title: 'Barbell Bench Press 4x6',
    workoutContext: 'Upper Push & Pull',
  });

  assert.match(prompt, /Coach Hishay/);
  assert.match(prompt, /Barbell Bench Press 4x6/);
  assert.match(prompt, new RegExp(`${plan.proteinTarget}g protein/day`));
});

test('buildChatSystemInstruction builds Plan Architect role for adjuster persona', () => {
  const plan = createDefaultPlan();
  const prompt = buildChatSystemInstruction('adjuster', plan);

  assert.match(prompt, /AI Training & Diet Plan Architect/);
  assert.match(prompt, /Apply to Plan/);
  assert.match(prompt, /Staple Meals/);
});

test('buildApplyInstructionFromChat distills multi-turn conversation and target assistant reply', () => {
  const messages: ChatMessage[] = [
    {
      id: 'm1',
      role: 'user',
      text: 'Make Tuesday vegetarian with paneer',
      timestamp: '2026-01-01T00:00:00Z',
    },
    {
      id: 'm2',
      role: 'model',
      text: 'Tuesday Lunch: Grilled Paneer Bhurji Bowl (45g protein).',
      timestamp: '2026-01-01T00:00:02Z',
    },
    {
      id: 'm3',
      role: 'user',
      text: 'Also shorten Tuesday workout to 35 minutes',
      timestamp: '2026-01-01T00:00:10Z',
    },
    {
      id: 'm4',
      role: 'model',
      text: 'Tuesday: 35m Lower Express + Paneer Bhurji Bowl for lunch and Lentil Tofu Curry for dinner.',
      timestamp: '2026-01-01T00:00:12Z',
    },
  ];

  const instruction = buildApplyInstructionFromChat(messages, 'm4');
  assert.match(instruction, /Make Tuesday vegetarian with paneer/);
  assert.match(instruction, /Also shorten Tuesday workout to 35 minutes/);
  assert.match(instruction, /35m Lower Express/);
  assert.doesNotMatch(instruction, /Grilled Paneer Bhurji Bowl \(45g/);
});
