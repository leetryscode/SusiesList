-- items.created_by / categories.created_by: allow the author's profile to be
-- deleted (account deletion) without losing the content itself - rule 2's
-- "never hard-delete" extends to authored content surviving its author's
-- departure. RLS's items_update/categories_update (created_by = auth.uid())
-- already go safely inert once this is null - nobody gains edit rights over
-- a departed member's words, matching rule 3's spirit rather than quietly
-- reassigning them. The list UI already falls back to "someone" for an
-- unresolved author ((app)/index.tsx), so no app change needed for this half.
alter table items alter column created_by drop not null;

alter table items drop constraint items_created_by_fkey;
alter table items add constraint items_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table categories drop constraint categories_created_by_fkey;
alter table categories add constraint categories_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

-- Deletes the caller's own account (Apple guideline 5.1.1(v): an app with
-- account creation must offer account deletion). Any family the caller
-- solely owns (no other members) is deleted outright - cascades its
-- categories/items with it. A family they own WITH other members blocks
-- deletion instead of leaving it ownerless, since rule 3's
-- owner-can-delete-anything privilege needs a real owner to mean anything;
-- transferring ownership isn't built, so for now the caller has to remove
-- the other members (or contact support) first. Deleting auth.users cascades
-- to profiles (existing FK), which cascades to family_members - membership
-- in families the caller doesn't own is removed for free, no extra code.
create or replace function public.delete_own_account()
returns void language plpgsql security definer
set search_path = public as $$
declare
  owned record;
  other_members int;
begin
  for owned in
    select id, subject_name from families where owner_id = auth.uid()
  loop
    select count(*) into other_members
    from family_members
    where family_id = owned.id and user_id <> auth.uid();

    if other_members > 0 then
      raise exception
        'You own "%" which has other members - remove them or contact support before deleting your account.',
        owned.subject_name;
    end if;

    delete from families where id = owned.id;
  end loop;

  delete from auth.users where id = auth.uid();
end;
$$;
