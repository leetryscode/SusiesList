-- Lets the pending-invite confirmation screen show "Join <name>'s list?"
-- before the user commits via join_family(). families_select's RLS policy
-- (is_family_member) blocks a non-member from reading the row directly, so
-- this security-definer function exposes just the one field needed for that
-- prompt - no id, no owner, no member list, no invite_code echoed back.
create or replace function public.family_name_by_code(p_code text)
returns text language sql security definer stable
set search_path = public as $$
  select subject_name from families where upper(invite_code) = upper(trim(p_code));
$$;
