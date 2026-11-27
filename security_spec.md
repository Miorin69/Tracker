# Firestore Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Strict Ownership & PII Isolation**: A user's profile (`/users/{userId}`), primary workspace (`/users/{userId}/workspaces/primary`), holiday plans (`/users/{userId}/holidayPlans/{holidayPlanId}`), and saved presets (`/users/{userId}/savedPresets/{presetId}`) are strictly private. Only the authenticated, email-verified user whose `request.auth.uid == userId` may read or write them. No blanket `isSignedIn()` reads or public user listing exist.
2. **Master Gate Parent Existence**: No workspace, holiday plan, or saved preset document may be created, read (via `get`), updated, or deleted unless the parent `/users/{userId}` document exists and has `ownerId == request.auth.uid`.
3. **Immutable Identity & Timestamps**: `ownerId`, `id` (on subcollection docs), and `createdAt` can never be changed after document creation. `createdAt` must equal `request.time` on `create`, and `updatedAt` must equal `request.time` on both `create` and `update`.
4. **No Shadow Fields**: Every `create` validates exact required and allowed keys (`hasAll` + `hasOnly`). Every `update` validates `isValid[Entity](incoming())` first and explicitly allowlists mutated fields via `affectedKeys().hasOnly(...)`.
5. **Volumetric & Structural Guards**: All path IDs match `^[a-zA-Z0-9_\-]+$` and are `<= 128` chars. Every string enforces a `.size()` limit, every list enforces a `.size()` limit and element-type guard, and every nested plan map enforces valid macros, 7 days, and bounded checklists.
6. **Verified Email Requirement**: All writes require `request.auth.token.email_verified == true`.
7. **Secure List Queries**: `allow list` on subcollections explicitly enforces `request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without `get()`/`exists()` lookups.

---

## 2. The "Dirty Dozen" Attack Payloads (All Must Be Denied)

1. **Unauthenticated Read/Write (`auth = null`)**: Reading `/users/alice/workspaces/primary` without signing in.
2. **Cross-User PII Read (`auth.uid = 'bob'` reading `/users/alice`)**: Authenticated non-owner attempting to read Alice's email and display name.
3. **Cross-User Workspace Write (`auth.uid = 'bob'` writing `/users/alice/workspaces/primary`)**: Authenticated non-owner attempting to overwrite Alice's training plan.
4. **Unverified Email Write (`email_verified = false`)**: User with unverified email attempting to create `/users/alice`.
5. **Identity Spoofing (`ownerId != auth.uid`)**: Alice attempting to create `/users/alice/holidayPlans/hp-1` with `{ ownerId: "bob", ... }`.
6. **Shadow Field Injection (`isAdmin: true`)**: Alice creating `/users/alice` with an undeclared ghost field `{ ..., isAdmin: true }`.
7. **Immutable `createdAt` Tampering**: Alice updating `/users/alice/workspaces/primary` while modifying `createdAt` to an older timestamp.
8. **Client-Forged Timestamp (`updatedAt != request.time`)**: Alice writing a client-supplied past timestamp instead of `serverTimestamp()`.
9. **Path ID Poisoning**: Alice attempting to create `/users/alice/savedPresets/../../evil$id` or a 200-character document ID.
10. **Denial-of-Wallet Oversized String**: Alice writing a 10,000-character `name` into `/users/alice/holidayPlans/hp-1`.
11. **Unbounded Array / Invalid Element Poisoning**: Alice writing 60 items into `bookmarkedTipIds` (max 50) or putting a number `[123]` inside `bookmarkedTipIds`.
12. **Orphaned Subcollection Write (Master Gate Bypass)**: Alice attempting to write `/users/alice/workspaces/primary` before `/users/alice` exists.
