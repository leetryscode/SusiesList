-- Why these exist: an RLS policy on family_members that itself queries
-- family_members causes infinite recursion — a well-known Supabase footgun.
-- Wrapping the membership check in a security definer function sidesteps it.

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
