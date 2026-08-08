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
  unique (family_id, name)
);

-- ---------- items ----------
create table items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories on delete cascade,
  title       text not null,
  note        text,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,          -- soft delete
  shared_at   timestamptz           -- future "shared with Susie" checkmark
);

create index items_category_idx on items (category_id) where deleted_at is null;
