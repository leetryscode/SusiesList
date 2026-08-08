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
