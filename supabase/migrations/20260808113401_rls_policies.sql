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

-- categories
create policy categories_select on categories for select
  using (is_family_member(family_id));
create policy categories_insert on categories for insert
  with check (is_family_member(family_id) and created_by = auth.uid());
create policy categories_update on categories for update
  using (created_by = auth.uid() or is_family_owner(family_id));
create policy categories_delete on categories for delete
  using (is_family_owner(family_id));

-- items: read within family; author-only edits; NO hard delete policy at all
create policy items_select on items for select
  using (can_access_category(category_id));
create policy items_insert on items for insert
  with check (can_access_category(category_id) and created_by = auth.uid());
create policy items_update on items for update
  using (created_by = auth.uid());

-- Note on deletes: items deliberately has no delete policy — nothing can be
-- hard deleted by a client. Soft deletion runs through the soft_delete_item
-- RPC, which is also how the family owner gets delete power over other
-- people's items without being able to edit them.
