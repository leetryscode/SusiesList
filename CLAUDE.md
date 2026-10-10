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

**Sign in with Apple shipped 2026-08-24, alongside email OTP (not replacing it).** Solves
the App Review sign-in problem properly: reviewers always have a working Apple ID, so
there's no demo-account/inbox-sharing needed (email OTP alone would have required exactly
that — tried a fresh Gmail for it first and Google's own device-verification challenges
blocked it before it even reached Apple). Native-only flow, no Services ID:
`expo-apple-authentication` gets the identity token, `supabase.auth.signInWithIdToken()`
exchanges it for a session. First-login profile creation is unchanged regardless of
provider. **Confirmed working on device 2026-08-24, build #17.**

**Getting both this and Associated Domains through EAS's non-interactive credential
system took four build failures to fully resolve — worth recording so it isn't
re-discovered the hard way next time a new capability gets added to `app.json`:**
1. Adding a *new* native capability (Associated Domains, then also Sign in with Apple)
   to `app.json` means the existing EAS-managed provisioning profile no longer matches
   and every build fails with "doesn't support the X capability" until it's regenerated.
2. `eas credentials -p ios` → "All: Set up all the required credentials" does **not**
   detect or fix this — it only confirms a profile *exists*, not that its capabilities
   still match `app.json` (confirmed by the profile's own `Updated` timestamp not moving
   across three separate "successful" interactive syncs).
3. What actually works: delete the stale profile outright (`eas credentials -p ios` →
   Build Credentials → "Provisioning Profile: Delete one from your project"), forcing a
   genuinely fresh one on the next build. Deleting it doesn't touch anything already
   submitted/installed, or anything in App Store Connect (different system entirely).
4. A **fresh, non-interactive** build additionally needs the App Store Connect API key
   authenticated in the *build* environment specifically — the one in `eas.json` is only
   wired to `submit`. Pass it as env vars to the `eas build` command itself (runs locally,
   not on EAS's cloud runner): `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`,
   `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID` (`7VN35QQ8V7`), `EXPO_APPLE_TEAM_TYPE`
   (`COMPANY_OR_ORGANIZATION`) — same Key ID/Issuer ID already in `eas.json`'s
   `submit.production.ios` block.
5. Each new capability *also* needs enabling directly on the App ID itself
   (developer.apple.com → Identifiers → `com.susieslist.app` → Capabilities) — EAS only
   auto-enabled Sign in with Apple's simple on/off capability, not Associated Domains
   (which carries actual domain configuration). Check both are enabled before assuming a
   credentials problem is EAS's to fix.

**Still to do:**

- [ ] Test account deletion on a real device (with a throwaway account, not a real one) —
      the RPC and UI are shipped and the migration is live on Supabase, but it's never
      been exercised end-to-end, including the sole-owner-with-other-members block.
- [ ] Test sharing on the real build (§13/§18) — `shareFamily` now sends a real Universal
      Link (`https://leetryscode.github.io/join/<code>`) instead of the untappable
      `susieslist://` scheme. Build #17+ is the first to actually carry the
      `associatedDomains` entitlement - not yet confirmed that tapping it on a device with
      the app installed opens the app rather than the browser fallback page.
- [ ] Ship the 2026-10-09 sharing fixes (App Store link in both share messages, see
      SPEC.md §18) in a new App Store version, and update the fallback page in the
      `leetryscode.github.io` repo: drop the TestFlight wording, add the App Store link
      and a `<meta name="apple-itunes-app" content="app-id=6804354294">` banner.
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
