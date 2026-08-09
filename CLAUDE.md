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

Build order steps 1–4 are done. Schema, RLS, and RPCs are live in Supabase; the keep-alive
workflow is in the repo; email-OTP sign-in, session persistence, first-login profile
creation, and sign-out are confirmed on a real device; and family create/join by code is
confirmed too (created a family with one account, signed out, joined the same family with
a second account by code — no picker).

**Still genuinely outstanding: real isolation testing.** What's confirmed so far is two
accounts *in the same* family. Not yet confirmed: a *third*, unrelated account (no
membership, no code used) truly cannot see this family's data through any query — the RLS
policies are written to guarantee this, but it hasn't been exercised live.

Step 5 (categories and items) is also done and confirmed on device: items added and
grouped correctly, edit restricted to the author, delete working for the owner on items
they didn't author, and correctly hidden from everyone else. See SPEC.md §14.

**Step 6 (local-first cache, offline writes) is implemented, not yet device-tested.**
AsyncStorage-backed cache (not SQLite/MMKV — data's too small to need it), optimistic
offline-capable item writes with a persisted retry queue, client-generated item ids to
avoid id-reconciliation. Family create/join stays online-only by design. See SPEC.md §15
for the full design and the one known gap (offline item-detail viewing not yet exercised
in airplane mode). Next: verify on device — turn on airplane mode, add/edit/delete items,
confirm they appear immediately, then reconnect and confirm they actually landed in
Supabase.
