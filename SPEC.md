# Susie's List — Technical Spec (v1)

**A shareable, multi-family list of songs, movies, books, shows, and recipes to pass down.**

> Status: planning spec, ready to hand to Claude in VS Code.
> All SQL below is written carefully but **has not been executed**. Run it in the
> Supabase SQL editor and test with two real accounts before trusting it.

---

## 1. Concept

- The app contains many **families**. Families are invisible to each other — there is
  no browse, no search, no discovery.
- A family has a **subject_name** ("Susie" — who the list is *for*, and what the family is
  displayed as) and a human-chosen **invite_code** ("SUSIE").
- A family contains **categories** (Books, Movies, Music, Recipes, + custom).
- A category contains **items**: a title, the author who added it, and an optional
  **note** — the "why" behind the pick.
- Anyone in a family can add. Only the item's author can edit it. The author or the
  family owner can delete, and deletes are **soft** (recoverable).

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| App | React Native + Expo (TypeScript) | Develop on Windows in VS Code |
| Build | EAS Build | Compiles iOS on Expo's hosted macOS runners |
| Backend | Supabase (Postgres + RLS) | Free tier, with keep-alive |
| Auth | Sign in with Apple (`expo-apple-authentication`) | Needs a dev build, not Expo Go |
| Local | SQLite / MMKV cache | Local-first; app works offline |
| Distribution | TestFlight → unlisted App Store | Both shareable by SMS link |

**Verify before relying on:** Expo's current Sign in with Apple setup steps, EAS free-tier
build allowances, and Apple's unlisted-app request process. All three change.

---

## 3. Schema

```sql
-- ---------- profiles ----------
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- ---------- families ----------
create table families (
  id           uuid primary key default gen_random_uuid(),
  subject_name text not null,          -- "Susie" — displayed as the family/list name
  invite_code  text not null,
  join_policy  text not null default 'open'
                 check (join_policy in ('open','approval')),
  owner_id     uuid not null references profiles(id),
  created_at   timestamptz not null default now()
);

-- invite codes are case-insensitive and globally unique
create unique index families_invite_code_key
  on families (upper(invite_code));

-- ---------- membership ----------
create table family_members (
  family_id uuid not null references families on delete cascade,
  user_id   uuid not null references profiles on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- ---------- categories ----------
create table categories (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families on delete cascade,
  name       text not null,
  icon       text,
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,          -- soft delete (added step 5.1, see §16)
  unique (family_id, name)
);

-- ---------- items ----------
create table items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories on delete cascade,
  title       text not null,
  note        text,
  photo_path  text,                 -- Storage object path, Recipes-only UI (see §17)
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,          -- soft delete
  shared_at   timestamptz           -- future "shared with Susie" checkmark
);

create index items_category_idx on items (category_id) where deleted_at is null;
```

---

## 4. Helper functions

**Why these exist:** an RLS policy on `family_members` that itself queries
`family_members` causes infinite recursion — a well-known Supabase footgun. Wrapping the
membership check in a `security definer` function sidesteps it.

```sql
create or replace function public.is_family_member(f_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from family_members
    where family_id = f_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_family_owner(f_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from family_members
    where family_id = f_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.can_access_category(c_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from categories c
    join family_members m on m.family_id = c.family_id
    where c.id = c_id and m.user_id = auth.uid()
  );
$$;
```

---

## 5. RLS policies

```sql
alter table profiles        enable row level security;
alter table families        enable row level security;
alter table family_members  enable row level security;
alter table categories      enable row level security;
alter table items           enable row level security;

-- profiles: see yourself, and anyone who shares a family with you
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from family_members a
    join family_members b on a.family_id = b.family_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy profiles_upsert_self on profiles for insert with check (id = auth.uid());
create policy profiles_update_self on profiles for update using (id = auth.uid());

-- families: members only. No insert policy — creation goes through create_family().
create policy families_select on families for select using (is_family_member(id));
create policy families_update on families for update using (is_family_owner(id));

-- membership: visible within your family; owner can remove anyone, you can remove yourself
create policy members_select on family_members for select
  using (is_family_member(family_id));
create policy members_delete on family_members for delete
  using (is_family_owner(family_id) or user_id = auth.uid());

-- categories: read/insert/update as below. NO delete policy (as of step 5.1,
-- see §16) - same reasoning as items: deletion goes through
-- soft_delete_category() only.
create policy categories_select on categories for select
  using (is_family_member(family_id));
create policy categories_insert on categories for insert
  with check (is_family_member(family_id) and created_by = auth.uid());
create policy categories_update on categories for update
  using (created_by = auth.uid() or is_family_owner(family_id));

-- items: read within family; author-only edits; NO hard delete policy at all
create policy items_select on items for select
  using (can_access_category(category_id));
create policy items_insert on items for insert
  with check (can_access_category(category_id) and created_by = auth.uid());
create policy items_update on items for update
  using (created_by = auth.uid());
```

**Note on deletes:** `items` deliberately has *no* delete policy — nothing can be hard
deleted by a client. Soft deletion runs through the RPC below, which is also how the
family owner gets delete power over other people's items without being able to edit them.

---

## 6. RPCs

```sql
-- create a family, seed default categories, make caller the owner
create or replace function public.create_family(
  p_subject_name text, p_invite_code text
) returns uuid language plpgsql security definer
set search_path = public as $$
declare fid uuid;
begin
  insert into families (subject_name, invite_code, owner_id)
  values (p_subject_name, p_invite_code, auth.uid())
  returning id into fid;

  insert into family_members (family_id, user_id, role)
  values (fid, auth.uid(), 'owner');

  insert into categories (family_id, name, sort_order, created_by) values
    (fid, 'Books',   1, auth.uid()),
    (fid, 'Movies',  2, auth.uid()),
    (fid, 'Music',   3, auth.uid()),
    (fid, 'Recipes', 4, auth.uid());

  return fid;
end;
$$;

-- join by invite code (case-insensitive)
create or replace function public.join_family(p_code text)
returns uuid language plpgsql security definer
set search_path = public as $$
declare fid uuid;
begin
  select id into fid from families where upper(invite_code) = upper(trim(p_code));
  if fid is null then
    raise exception 'No family found with that code';
  end if;

  insert into family_members (family_id, user_id, role)
  values (fid, auth.uid(), 'member')
  on conflict (family_id, user_id) do nothing;

  return fid;
end;
$$;

-- soft delete: author or family owner
create or replace function public.soft_delete_item(p_item_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare fid uuid; author uuid;
begin
  select c.family_id, i.created_by into fid, author
  from items i join categories c on c.id = i.category_id
  where i.id = p_item_id;

  if fid is null then raise exception 'Item not found'; end if;

  if author = auth.uid() or is_family_owner(fid) then
    update items set deleted_at = now() where id = p_item_id;
  else
    raise exception 'Not permitted';
  end if;
end;
$$;

-- soft delete a category and everything in it: family owner only
-- (added step 5.1, see §16)
create or replace function public.soft_delete_category(p_category_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare fid uuid;
begin
  select family_id into fid from categories where id = p_category_id;

  if fid is null then raise exception 'Category not found'; end if;
  if not is_family_owner(fid) then raise exception 'Not permitted'; end if;

  update items set deleted_at = now()
  where category_id = p_category_id and deleted_at is null;

  update categories set deleted_at = now() where id = p_category_id;
end;
$$;
```

---

## 7. Onboarding / invite flow

**Goal: nobody searches for anything.**

1. You text a deep link: `susieslist://join/SUSIE` (plus an https universal-link
   equivalent so it survives being sent over SMS).
2. Recipient installs from the TestFlight or App Store link.
3. Opening the link → Sign in with Apple → `join_family('SUSIE')` runs → they land
   directly in the family. No family picker, ever.
4. **Fallback:** if the code is lost during install (deferred deep linking is unreliable),
   the first screen offers a single text box: "Enter your family code."

`join_policy` is `'open'` today. Flipping it to `'approval'` later requires no migration.

---

## 8. Local-first design

The app holds a full local copy of the family's data and treats Supabase as sync, not as
the source of truth for reads.

- On launch: render from local cache immediately, then reconcile in background.
- Writes: apply locally, queue, push when online.
- Conflicts: last-write-wins on `updated_at` is fine here — concurrent edits to the same
  item by two family members will be vanishingly rare, and author-only editing makes it
  rarer still.

**This is the real backup strategy.** Every family member's phone holds the complete list.
Total backend loss costs you a re-point, not the memories.

---

## 9. Keep-alive (do this immediately)

Supabase free projects pause after **7 days of inactivity**; extended pausing eventually
leads to deletion, and the free tier retains **no backups**. A cron job removes the risk.

`.github/workflows/keepalive.yml`:

```yaml
name: Supabase keep-alive
on:
  schedule:
    - cron: '0 12 * * 1,4'   # Mondays and Thursdays
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -sS -f \
            "${{ secrets.SUPABASE_URL }}/rest/v1/families?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

Store `SUPABASE_URL` and `SUPABASE_ANON_KEY` as GitHub repo secrets. Note GitHub may
disable scheduled workflows on repos with no activity for ~60 days — check in occasionally,
or commit something trivial now and then.

**Later:** a second scheduled job dumps all tables to JSON and emails them to you monthly.

---

## 10. Build order

1. **Supabase**: run the schema, helpers, RLS, and RPCs. Test with two accounts —
   confirm account B cannot see account A's family by any query.
2. **Keep-alive workflow**. 15 minutes, removes the pause risk permanently.
3. **Expo scaffold** + Sign in with Apple. Confirm a real login round-trips to `profiles`.
4. **Create family / join by code**, including the deep link.
5. **Categories and items** — list view grouped by category, author shown on each item,
   tap through to the note.
6. **Local-first cache** and offline writes.
7. **EAS build** → your phone → TestFlight link to text the family.

Ship after step 5 if you want to start using it. Steps 6–7 can follow.

---

## 11. Deferred (leave room, don't build)

- `shared_at` checkmark — "we watched this together."
- Age gating ("open when she's 14").
- Photos or audio attached to an item.
- A printed/PDF export of the whole list for her eighteenth birthday.
- Comments from other family members on someone else's item.

---

## 12. App architecture (decided)

### Layout

```
susies-list/
  mobile/          <- the Expo project (NOT named "app/" — Expo Router reserves that
                      name for file-based routes inside the project)
  supabase/        <- SQL migrations
  .github/workflows/
  SPEC.md, CLAUDE.md
```

### Decisions

| Choice | Decision |
|---|---|
| Navigation | Expo Router (file-based) |
| Language | TypeScript |
| Styling | React Native `StyleSheet` — no styling library |
| Data access | `supabase-js` directly; no ORM |
| Auth (now) | Supabase **email OTP** — 6-digit code, no deep-link handling needed |
| Auth (later) | Sign in with Apple, once the Apple Developer org account is active |

**Auth staging.** The Apple Developer org account is still in progress, so Sign in with
Apple — which requires a development build on a physical device — can't be tested yet.
Build against email OTP first. Supabase treats both as providers over the same `auth.users`
table, so no schema changes and no rewrites of app data logic when Apple is added; only
the login screen changes.

Prefer OTP **codes** over magic links during this phase: links require universal-link /
deep-link configuration, which is exactly the fragile part we're deferring.

**Email template setup (required for codes).** Supabase's default templates send a
clickable link via `{{ .ConfirmationURL }}`, which resolves against the project's Site URL
— `http://localhost:3000` by default, producing a blank page on a phone. To send a 6-digit
code instead, edit **both** templates in Authentication → Email Templates to use
`{{ .Token }}`:

- **Confirm signup** — sent when the email address is new
- **Magic Link** — sent when the user already exists

`signInWithOtp` picks between them based on whether the account exists, so fixing only one
leaves a delayed failure.

### SMTP (Resend) — known-good configuration

| Setting | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | 465 (try 587 if connections fail) |
| Username | `resend` |
| Password | a **Resend API key** (`re_...`) — not the account password |
| Sender | `lee@orbitintroductions.com` (domain verified in Resend) |

A `535 "Authentication credentials invalid"` in Supabase's Auth logs means the password is
not a valid API key. Resend's API-keys page showing "No activity" for the key confirms it.
Note the 60-second per-user minimum interval, which silently blocks rapid retries during
testing.

### Verify, do not assume

These have changed across versions. Check current docs rather than relying on memory:

- Session persistence for `supabase-js` in React Native — which storage adapter
  (`AsyncStorage` vs `expo-secure-store`) and whether a URL polyfill is still required.
- The exact `supabase-js` auth method names and options for OTP sign-in and verification.
- `expo-apple-authentication` setup steps, and Supabase's Apple provider configuration.

### First pass scope (stop here)

1. Expo project in `mobile/`, TypeScript, Expo Router.
2. `.env` handling for `SUPABASE_URL` / `SUPABASE_ANON_KEY` (never commit real values).
3. A single `lib/supabase.ts` client with working session persistence.
4. Auth gate: unauthenticated → login screen; authenticated → placeholder home screen.
5. On first successful login, create the user's `profiles` row (display name prompt).
6. Sign out.

**Do not build** families, categories, or items in this pass. The point is to confirm a
real login round-trips to Postgres and survives an app restart.

### Definition of done

Sign in on a device or simulator, see a `profiles` row appear in the Supabase dashboard,
force-quit the app, reopen it, and still be signed in.

**Confirmed 2026-08-09** on a real device via Expo Go (SDK 54): profile row created with
the entered display name, session survived a force-quit/reopen, and sign-out returned to
the sign-in screen. Step 3 first pass is complete.

---

## 13. Family onboarding (step 4, decided)

**Model:** one user, one family for v1 — matches rule 4 (no family picker). You (the
owner) create the family once; everyone else joins by code. SPEC.md §7 covers joining but
never said how the first family gets created, so this fills that gap.

### Screen: `join-family.tsx`

Shown after auth + profile, when the signed-in user has no `family_members` row.

- **Primary**: a single "Enter your family code" input + Join button, calling the
  `join_family` RPC. This is the path almost everyone hits.
- **Secondary**: a collapsed "Set up a new family instead" toggle, revealing subject-name
  + invite-code inputs and a Create button, calling `create_family`. Only the owner uses
  this, once.

The invite-code inputs are plain freeform text (no numeric/alpha format enforced) —
`invite_code` in the schema is already unconstrained text, so switching from numeric codes
to letter codes later needs no app changes, just a different string typed at creation time.

### Deep link (custom scheme only)

`app.json` `scheme` changed from the scaffold default (`mobile`) to `susieslist`, matching
the `susieslist://join/SUSIE` example in §7.

- `src/app/join/[code].tsx` is an always-reachable, unprotected route (outside every
  `Stack.Protected` block in the root layout) that stashes the code via
  `AsyncStorage` (`lib/pending-invite.ts`) and redirects to `/`. The root layout's own
  auth/family gate then routes wherever the user actually belongs — sign-in if signed out,
  `join-family` if signed in but family-less (where the stashed code pre-fills the input),
  or straight into the app if they're already in a family.
- This deliberately doesn't auto-join without a confirming tap — the code is pre-filled,
  not silently submitted.

**Confirmed 2026-08-09** on a real device: created a family with one account, signed out,
signed in with a second account, and joined the same family by typing the code — landed
straight in with no picker. Note this confirms *joining*, not isolation — a third,
unrelated account has not yet been used to confirm it sees nothing of this family. That
isolation test is still the one outstanding item from build order step 1.

**Universal links (`https://...`) are deferred, not built.** They need a hosted domain
serving an Apple App Site Association file plus the associated-domains entitlement,
neither of which exist yet. Custom-scheme links work for texting an invite today; revisit
once there's a real domain to host AASA on.

---

## 14. Categories and items (step 5, decided)

**Scope for this pass:** the four default categories seeded by `create_family` only — no
custom-category creation yet (not called for by build order step 5's own line, and there's
no UI need for it until someone actually wants a category beyond the defaults).

### List screen (`(app)/index.tsx`)

A `SectionList` — one section per category (in `sort_order`), items sorted by
`created_at`. Each section header has a small "+ Add" link that opens `new-item` with the
category pre-selected via a route param. No local cache yet (that's step 6) — data is
fetched on every screen focus via `useFocusEffect`, which also means edits/adds/deletes
made elsewhere are reflected on return without extra plumbing.

Author names are resolved with a second query (`profiles` by the distinct `created_by`
ids in view) rather than a Supabase embedded join — the same choice made in
`family-context.tsx` for `family_members → families`, for the same reason: without
generated DB types, `supabase-js` infers embedded relationships as arrays even for
to-one foreign keys, which fights the type checker for no real benefit at this data
volume.

### Item detail (`(app)/item/[id].tsx`)

Single screen, two modes (view / inline edit) rather than a separate edit route — the
form is two fields, not worth a second screen. Edit is only offered to the author
(rule 3); delete is offered to the author *or* the family owner, and always goes through
the `soft_delete_item` RPC (rule 2 — `items` has no delete policy, this is the only path).

### Sign-out relocated

Now a header button in `(app)/_layout.tsx` instead of a button on the home screen, since
the home screen is the actual list now. The owner's invite code moved to a list footer.

**Confirmed 2026-08-09** on a real device, both accounts: items added and grouped
correctly with the right author name, edit only offered to the author, the owner could
delete an item they didn't author, and a non-owner non-author saw no delete option. Step 5
is done.

---

## 15. Local-first cache and offline writes (step 6, decided)

**Scope for this pass:** items only. `create_family`/`join_family` stay online-only —
onboarding is a one-time action and requiring connectivity for it is a reasonable
trade-off against the complexity of making it offline-safe too.

### Storage choice: AsyncStorage, not SQLite/MMKV

SPEC.md §2's original stack table listed "SQLite / MMKV cache" as an option, written
during planning before any real data shape existed. In practice a family's list is a
handful of categories and, realistically, dozens to low hundreds of items — small enough
that a JSON blob in AsyncStorage (already a dependency, already used for the session and
the pending-invite-code stash) does the job without adding a new storage engine. Revisit
only if this stops being true.

### Modules

- `lib/local-cache.ts` — reads/writes one JSON blob per family (`categories`, `items`,
  `authorNames`) to AsyncStorage.
- `lib/write-queue.ts` — a persisted, ordered list of pending item writes (create/update/
  delete) that couldn't reach Supabase.
- `lib/sync.ts` — the layer screens actually call. `refreshFamilyData` fetches live and
  updates the cache; `createItemOffline`/`updateItemOffline`/`deleteItemOffline` apply the
  change to the cache immediately (optimistic UI) and attempt the real write, falling back
  to the queue only when the failure looks like a network problem; `flushPendingWrites`
  drains the queue in order, called at the start of every list-screen load.

### Client-generated item ids

New items get their id from `expo-crypto`'s `Crypto.randomUUID()` on the client, passed
explicitly into the `items.insert`, instead of relying on the column's
`gen_random_uuid()` default. This sidesteps the classic offline-first "temp id vs. real
id" reconciliation problem entirely — an item created while offline already has its
permanent id the moment it's queued, matching what Supabase will eventually store.

### Telling a network failure from a real rejection

Supabase's own error shape doesn't cleanly distinguish "couldn't reach the server" from
"the server rejected this." `sync.ts`'s `isNetworkError` heuristic (message matches
`/network|fetch/i`) decides which: a network-shaped error gets queued and retried later;
anything else (an RLS rejection, a bad request) surfaces to the user immediately and is
**not** retried — retrying a write that will never succeed on every app focus forever
would be worse than just failing loudly once.

### What's still a known gap

Editing or deleting an item that was created offline and hasn't synced yet works (the
queue processes in order, so the create always lands before a later update/delete for the
same id), but viewing that item's detail screen while still offline depends on the list
screen's cache already containing it, which it will — it was written there
optimistically at creation time. This hasn't been exercised end-to-end in airplane mode;
exercise that before calling this fully done.

**Confirmed on-device (2026-08-09):** create, edit, and delete while in airplane mode all
applied immediately to the local list; reconnecting and reloading showed all three had
landed in Supabase. Item-detail viewing while offline (the gap above) is still
unexercised.

Fixed during this pass: `isNetworkError` in `lib/sync.ts` originally required
`error instanceof Error`, but postgrest-js resolves fetch failures as a plain
`{ message, ... }` object rather than throwing a real `Error` — so the check never
matched and every offline write surfaced `"TypeError: Network request failed"` to the
user instead of queueing. Fixed to check `.message` on any error-shaped value.

---

## 16. Category deletion (step 5.1, decided)

Owners can delete a category, matching the existing "owner may delete anything, may not
edit others' words" rule already applied to items. Confirmation is required before the
delete fires, since deleting a category also removes every item inside it.

**Soft delete, not hard delete.** `items.category_id` has `on delete cascade`, so a raw
`categories` row delete would physically wipe out every item in it — bypassing the
soft-delete-only design items otherwise get (rule 2 in CLAUDE.md: never hard-delete
items). Instead, categories got the same treatment: a `deleted_at` column, no delete RLS
policy (matching items having none), and a `soft_delete_category(p_category_id)` RPC
(owner-only, security definer) that marks the category's own `deleted_at` **and**
explicitly sets `deleted_at` on every item in it — not left to be implicitly hidden by the
category disappearing, since `getItem`/`getItemWithFallback` don't filter by the parent
category's deletion state, only by the item's own `deleted_at`. Migration:
`supabase/migrations/20260811120000_soft_delete_categories.sql`.

`listCategories` now filters `.is("deleted_at", null)`, same pattern `listItems` already
uses.

**Offline-capable**, matching how category creation works: `deleteCategoryOffline` in
`lib/sync.ts` patches the cache immediately (removing the category and its items) and
attempts the real RPC call, falling back to the write queue (`"delete-category"` kind) on
a network-shaped failure — no special case relative to any other write.

**UI**: a "Remove category" button next to "+ Add category" at the bottom of the list
screen, visible to the owner only. Tapping it opens an `ActionSheetIOS` listing every
category by name (simplest selection mechanism - no per-card icons, no new screen), and
picking one triggers a confirmation `Alert` naming the category and, if non-empty, the
item count about to go with it. (Per-card trash icons were tried first and dropped for
being too visually prominent against the rest of the card.)

---

## 17. Recipe photos (step 5.2, decided)

Recipes-only: items in a category literally named `"Recipes"` can attach one or more
photos (camera or library) alongside the note. This is a **UI-only** gate, not
DB-enforced — category names are per-family editable text, not a fixed enum, so there's no
CHECK constraint tying `photo_paths` to a category type. `new-item.tsx` checks
`categoryName === "Recipes"` before showing the photo picker, the same string
`singularItemLabel` already special-cases.

**Storage**: a private Supabase Storage bucket, `recipe-photos`, scoped by family the same
way every table already is — path is `{family_id}/{filename}.{ext}`, RLS on
`storage.objects` reuses the existing `is_family_member()` helper (§4) against
`(storage.foldername(name))[1]::uuid`. `items.photo_paths` (`text[]`) stores the object
paths (not public URLs, since the bucket is private); display resolves each to a signed
URL on demand. Migration: `supabase/migrations/20260812090000_recipe_photos.sql`.

**Multiple photos (added right after the first pass).** Went from a single `photo_path`
column to `photo_paths text[]` — one photo per recipe turned out not to be enough in
practice. Migration `20260813090000_multiple_recipe_photos.sql` adds the array column,
backfills any existing single photo into it, then drops the old column. Picking supports
both: the camera always returns at most one photo (no such thing as multi-shot capture),
but the library picker uses `allowsMultipleSelection` and can return several at once;
either way, the "+ Add Photo" button can be tapped repeatedly to keep adding more.
Editing an item now supports both removing existing photos *and* adding new ones in the
same session (each pending add/remove is local state until Save commits it) — worth
knowing if this ever needed re-reading: the first version of edit-mode photo handling only
supported removal, which is why this note exists.

**Flat path, no per-item folder.** Considered `{family_id}/{item_id}/{filename}` for
organization, but nothing in RLS needs the item id (only the family_id segment is
checked), and coordinating the item's client-generated id between the new-item screen and
the upload call added complexity for no real benefit at this scale. Every photo gets its
own random filename instead, so multiple photos per item never collide.

**No update/delete storage policy.** Removing a photo (or replacing the set) just changes
`items.photo_paths`; the underlying Storage objects are left orphaned rather than
explicitly cleaned up. Same tradeoff already made elsewhere in this project (small
family-scale data, not worth the extra RLS policy and cleanup logic yet). Soft-deleting an
item or category never touches its photos either, consistent with "never hard-delete" — an
orphaned photo for a soft-deleted item is not a bug.

**Online-only for this pass (deliberate, low priority to revisit).** `sync.ts`'s
offline-write queue is built for small JSON payloads persisted to AsyncStorage; a binary
photo upload doesn't fit that shape the same way item/category writes do. Rather than
build offline photo queuing now, attaching a photo requires connectivity at the moment of
tapping "Add" — title/note still work offline exactly as before. **Future work, not
urgent**: queue picked-but-unuploaded photos (e.g. persist the local URI + pending upload
state) so a recipe photo taken in airplane mode uploads once reconnected, matching how
every other write already behaves.

**Expo Go**: confirmed via current SDK docs that `expo-image-picker` (camera and library)
works in Expo Go — no dev client required for this feature specifically, unlike Sign in
with Apple. The `app.json` plugin's custom permission-prompt strings won't actually apply
until a real dev/production build exists (Expo Go shows its own generic prompt text
instead) — cosmetic only, not a blocker.
