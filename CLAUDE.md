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
  ├── family_members (user_id, role) — a user can belong to more than one family
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
   code. They should never search for or choose a family. (This is about a *brand-new*
   user's first family only — an existing user who already belongs to one may see a
   switcher to pick among their own families. See SPEC.md §18.)
5. **Don't invent API surface.** Verify Expo, Apple, and Supabase method names and setup
   steps against current docs rather than assuming — these libraries move.

## Current status

Build order steps 1–4 are done. Schema, RLS, and RPCs are live in Supabase; the keep-alive
workflow is in the repo; email-OTP sign-in, session persistence, first-login profile
creation, and sign-out are confirmed on a real device; and family create/join by code is
confirmed too (created a family with one account, signed out, joined the same family with
a second account by code — no picker).

**Isolation confirmed 2026-08-24**, directly against the real API rather than just the app
UI: created a genuinely new, unrelated auth account (no membership, no code used) via
Supabase's admin API, signed in as it for a real user-scoped session token, and confirmed
`families`/`family_members`/`categories` all return empty for that account — including
targeted reads of the one real family by its known id and known invite code, not just an
unfiltered list. The one deliberate exception, `family_name_by_code` (used by the
join-confirm preview), correctly still works and returns nothing else. `items` wasn't
separately exercised (would have needed pulling real item content via the service-role
key, judged not worth it given every other table held). Test account deleted afterward.

Step 5 (categories and items) is also done and confirmed on device: items added and
grouped correctly, edit restricted to the author, delete working for the owner on items
they didn't author, and correctly hidden from everyone else. See SPEC.md §14.

**Step 6 (local-first cache, offline writes) is implemented and confirmed on device.**
AsyncStorage-backed cache (not SQLite/MMKV — data's too small to need it), optimistic
offline-capable item writes with a persisted retry queue, client-generated item ids to
avoid id-reconciliation. Family create/join stays online-only by design. Create, edit, and
delete were all exercised in airplane mode (applied instantly to the local list) and
confirmed to have landed in Supabase after reconnecting. See SPEC.md §15 for the full
design and the one remaining known gap (offline item-detail viewing not yet exercised in
airplane mode).

**Multi-family support is implemented but not yet confirmed on a real device.** A user can
now belong to more than one family, switch between them from a new home screen, and get an
invite-link confirmation prompt if they open a link for a family they don't already belong
to (previously silently dropped for anyone past onboarding). The
`family_name_by_code` migration behind that prompt is applied and confirmed on the linked
Supabase project, and the app type-checks clean, but none of it has been exercised on
device yet — see SPEC.md §18 for what changed and the specific scenarios still to test
before calling it done.

## ▶ Resumed 2026-08-22 — Apple org account approved

The Apple Developer account cleared organization verification on 2026-08-22, unblocking
the build. Since then:

- EAS project created and linked: `@leetryscode/susies-list`
  (`mobile/app.json`'s `extra.eas.projectId`). App name/slug set to "Susie's List" /
  `susies-list`; iOS bundle id and Android package both `com.susieslist.app`.
- `mobile/eas.json` generated. iOS credentials are EAS-managed: a Distribution
  Certificate and Provisioning Profile exist under Apple Team `7VN35QQ8V7`, expiring
  2027-08-22. Authentication for builds/submits uses an App Store Connect API Key
  (Key ID `QJ34DCMM6J`, file at `mobile/AuthKey_QJ34DCMM6J.p8`, gitignored) referenced
  from `eas.json`'s `submit.production.ios` block — fully non-interactive going forward.
- Fixed a pre-existing, unrelated bug found along the way: `mobile/package-lock.json` was
  out of sync with `package.json` (missing a resolved `react-dom` entry), which failed
  `npm ci` on the EAS build machine. Fixed by explicitly pinning `react-dom@19.1.0` to
  match Expo SDK 54's required React version, via `npx expo install react-dom`.
- App Store Connect app record created: "Susie's List", `ascAppId` 6804354294.

**Build order step 7 is done, confirmed on device: build #8 installs and runs cleanly via
TestFlight.** Builds #3–#7 all crashed instantly on launch; root-caused and fixed
2026-08-24, two separate issues stacked on top of each other:

1. **A real, open React Native bug**: `ObjCTurboModule::performVoidMethodInvocation`
   (`RCTTurboModule.mm`) converts a native exception from a void-returning TurboModule
   method into a JS error even when the call was dispatched off the JS thread — touching
   the Hermes runtime from the wrong thread, corrupting GC memory, and crashing somewhere
   unrelated a moment later (which made every crash look different: SIGABRT, SIGSEGV,
   SIGBUS in unrelated JS). Matches
   [facebook/react-native#54859](https://github.com/facebook/react-native/issues/54859)
   almost exactly (RN 0.81.5 + New Architecture + iOS 26.x Release builds — our exact
   config). The sibling sync-path function already got the correct fix in
   [PR #50193](https://github.com/facebook/react-native/pull/50193); the void path just
   never got the same treatment. Patched via `patch-package` to mirror that same,
   already-proven pattern — see `mobile/patches/react-native+0.81.5.patch`. **If
   `react-native` is ever upgraded past 0.81.5, check whether upstream has since fixed
   `performVoidMethodInvocation` properly before assuming this patch still applies
   cleanly or is still needed.**
2. **`EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` were never configured in
   EAS's cloud environment variables.** `mobile/.env` only exists locally — EAS Build's
   remote machines never had access to it, so every cloud build compiled both as
   `undefined`, tripping `supabase.ts`'s own guard clause. Fixed via `eas env:set
   production` (values now live under the project's `production` environment on EAS, not
   in a repo file). **If the Supabase project's URL or anon key ever changes, update both
   `mobile/.env` *and* the EAS-side copy** (`eas env:list production` to check current
   values, `eas env:set production --name ... --value ... --force` to update).

Once past the crash, the app itself came up clean — sign-in screen rendered, no other
issues surfaced yet. Still only exercised minimally on this one build; the checklist below
is still real testing debt, not superseded by "it launches now."

**Still to do:**

- [ ] Swap Sign in with Apple in for email OTP (step 3's deferred half, §12) — now
      unblocked since a real dev-build capability exists.
- [ ] Test sharing on the real build (§13/§18) — `shareFamily` now sends a real Universal
      Link (`https://leetryscode.github.io/join/<code>`, built 2026-08-24) instead of the
      untappable `susieslist://` scheme, but this needs a build that actually includes the
      new `associatedDomains` entitlement (#10+) before a device-with-app-installed tap can
      be confirmed to open the app rather than the browser fallback page.
- [ ] App Store screenshots (not needed for TestFlight, but required before public/
      unlisted App Store release) — plan is to capture natively on a real iPhone from
      the TestFlight build rather than set up simulator-based automation.

**Not Apple-blocked — can be picked up anytime, still outstanding regardless of build
status:**

- [ ] Offline item-detail viewing in airplane mode for an item created offline and not yet
      synced (§15's one remaining known gap — create/edit/delete were exercised, this read
      path wasn't).
- [ ] Multi-family on-device testing (§18): joining a 2nd family and switcher behavior,
      active-family persistence across a restart, a deep link tapped while the app is
      already open, a deep link opened cold before login, a deep link opened by a
      brand-new zero-family account (should hit the unchanged join-family flow, not
      join-confirm), an invalid/expired code in join-confirm, and the "Switch families" /
      "Create new family" links.
