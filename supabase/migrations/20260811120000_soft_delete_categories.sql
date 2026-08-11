-- categories get the same soft-delete treatment items already have: never
-- hard-deleted, so items.category_id's ON DELETE CASCADE can't silently
-- wipe rows out from under the soft-delete-only design.
alter table categories add column deleted_at timestamptz;

-- the existing hard-delete policy is superseded by soft_delete_category()
-- below (security definer, does its own owner check) - mirrors items, which
-- has no delete policy at all so every deletion goes through soft_delete_item().
drop policy categories_delete on categories;

-- soft delete a category and everything in it: family owner only
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
