# Susie's List

A private, shareable list of books, movies, music, and recipes that a family collects for
one person — in this case Susie, who isn't born yet.

**Read `SPEC.md` before making changes.** It contains the schema, RLS policies, RPCs, and
build order. If a decision here conflicts with SPEC.md, SPEC.md wins; update it when
decisions change.

## Stack

- **Expo + React Native (TypeScript)** — developed on Windows, built for iOS via EAS Build
  (Expo's hosted macOS runners). No Mac required.
- **Supabase** (Postgres + RLS) for sync. Free tier.
- **Sign in with Apple** via `expo-apple-authentication` (requires a development build,
  not Expo Go).
- Local-first: the app keeps a full local copy and treats Supabase as sync, not as the
  source of truth for reads.

## Domain model

```
families (subject_name, invite_code)
  └── categories (Books, Movies, Music, Recipes, + custom)
        └── items (title, note, created_by, deleted_at, shared_at)
```

## Rules that must not be broken

1. **Families are invisible to each other.** No browse, no search, no discovery. Isolation
   is enforced by RLS, not by hiding UI.
2. **Never hard-delete items.** Deletion sets `deleted_at`. The `items` table has no
   delete policy on purpose; use the `soft_delete_item` RPC.
3. **Only the item's author may edit it.** The family owner may delete anything, but may
   not edit someone else's words.
4. **No family picker during onboarding.** Users arrive via an invite link or type one
   code. They should never search for or choose a family.
5. **Don't invent API surface.** Verify Expo, Apple, and Supabase method names and setup
   steps against current docs rather than assuming — these libraries move.

## Current status

Build order steps 1–3 are done. Schema, RLS, and RPCs are live in Supabase; the keep-alive
workflow is in the repo; the Expo scaffold in `mobile/` has working email-OTP sign-in,
session persistence across app restarts, first-login profile creation, and sign-out —
confirmed on a real device. Still outstanding from step 1: isolation testing with two real
accounts.

**Step 4 (create family / join by code) is implemented, not yet device-tested.** Join
and create screens, the family-membership auth-gate branch, and the custom-scheme deep
link (`susieslist://join/CODE`) are built per SPEC.md §13 — universal links deferred
(needs a hosted domain). Next: verify on device — create the family as the owner, then
join it as a second account, and confirm isolation still holds.
