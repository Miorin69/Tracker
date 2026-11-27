import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Phase 0 & Phase 5 Security Rules Verification Suite
 * Verifies firestore.rules enforces every invariant in security_spec.md
 * and rejects all 12 "Dirty Dozen" adversarial scenarios.
 */
const rulesText = readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
const blueprint = JSON.parse(
  readFileSync(new URL('./firebase-blueprint.json', import.meta.url), 'utf8'),
) as {
  entities: Record<string, unknown>;
  firestore: Record<string, { schema: { $ref: string } }>;
};

describe('Firestore Security Rules — Eight Pillars & Dirty Dozen Verification', () => {
  it('enforces rules_version 2 and default-deny global safety net first', () => {
    assert.match(rulesText, /^rules_version\s*=\s*'2';/);
    const catchAllIndex = rulesText.indexOf('match /{document=**}');
    const usersMatchIndex = rulesText.indexOf('match /users/{userId}');
    assert.ok(catchAllIndex > 0 && catchAllIndex < usersMatchIndex);
    assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  });

  it('covers every collection path declared in firebase-blueprint.json', () => {
    const paths = Object.keys(blueprint.firestore);
    assert.ok(paths.includes('/users/{userId}'));
    assert.ok(paths.includes('/users/{userId}/workspaces/{workspaceId}'));
    assert.ok(paths.includes('/users/{userId}/holidayPlans/{holidayPlanId}'));
    assert.ok(paths.includes('/users/{userId}/savedPresets/{presetId}'));

    assert.match(rulesText, /match \/users\/\{userId\}/);
    assert.match(rulesText, /match \/workspaces\/\{workspaceId\}/);
    assert.match(rulesText, /match \/holidayPlans\/\{holidayPlanId\}/);
    assert.match(rulesText, /match \/savedPresets\/\{presetId\}/);
  });

  it('Dirty Dozen #1–#3: blocks unauthenticated access and cross-user PII/workspace reads or writes', () => {
    assert.match(rulesText, /function isOwner\(userId\)\s*\{\s*return isSignedIn\(\) && request\.auth\.uid == userId;/);
    // No blanket isSignedIn() reads anywhere
    assert.doesNotMatch(rulesText, /allow (read|get|list):\s*if isSignedIn\(\);/);
    // User profile listing is strictly forbidden (PII isolation)
    assert.match(rulesText, /match \/users\/\{userId\}[\s\S]*?allow list:\s*if false;/);
  });

  it('Dirty Dozen #4: mandates email_verified == true on all writes', () => {
    assert.match(
      rulesText,
      /function isEmailVerified\(\)\s*\{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;/,
    );
    const writeBlocks = rulesText.match(/allow (create|update|delete):[\s\S]*?;/g) ?? [];
    assert.ok(writeBlocks.length >= 12);
    for (const block of writeBlocks) {
      assert.match(block, /isVerifiedOwner\(userId\)/);
    }
  });

  it('Dirty Dozen #5 & #6: blocks identity spoofing and shadow field injection on create & update', () => {
    assert.match(rulesText, /data\.ownerId == request\.auth\.uid/);
    assert.match(rulesText, /data\.ownerId == userId/);
    assert.match(rulesText, /incoming\(\)\.ownerId == existing\(\)\.ownerId/);
    assert.match(rulesText, /data\.keys\(\)\.hasAll\(/);
    assert.match(rulesText, /data\.keys\(\)\.hasOnly\(/);
    assert.match(rulesText, /affectedKeys\(\)\.hasOnly\(/);
  });

  it('Dirty Dozen #7 & #8: locks createdAt immutability and enforces request.time server timestamps', () => {
    assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
    assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
    assert.match(rulesText, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  });

  it('Dirty Dozen #9–#11: validates path IDs, bounds all strings/arrays, and guards dailyProgress & all 7 days', () => {
    assert.match(
      rulesText,
      /function isValidId\(id\)\s*\{\s*return id is string && id\.size\(\) >= 1 && id\.size\(\) <= 128 && id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\);/,
    );
    assert.match(rulesText, /days\.size\(\) == 7/);
    assert.match(rulesText, /isValidDaySchedule\(days\[0\]\)/);
    assert.match(rulesText, /days\[6\] is map/);
    assert.match(rulesText, /ids\.size\(\) <= 50/);
    assert.match(rulesText, /checklist\.size\(\) <= 100/);
    assert.match(rulesText, /videos\.size\(\) <= 25/);
    assert.match(rulesText, /dailyProgress\.keys\(\)\.hasOnly\(\['0', '1', '2', '3', '4', '5', '6'\]\)/);
  });

  it('Dirty Dozen #12: enforces Master Gate parent profile existence on subcollections without get()/exists() in list rules', () => {
    assert.match(rulesText, /function hasValidParentUser\(userId\)/);
    assert.match(
      rulesText,
      /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\)/,
    );
    const listBlocks = rulesText.match(/allow list:[\s\S]*?;/g) ?? [];
    for (const block of listBlocks) {
      assert.doesNotMatch(block, /hasValidParentUser|get\(|exists\(/);
      if (!block.includes('if false')) {
        assert.match(block, /existing\(\)\.ownerId == request\.auth\.uid/);
      }
    }
  });
});
