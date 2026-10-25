-- ============================================================================
-- SplitEasy schema — tables, constraints, indexes
-- Migration 0001
-- Money is stored in integer minor units (BIGINT). UUID primary keys.
-- Timestamps are timestamptz (UTC).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type member_role as enum ('owner', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type split_mode as enum ('equal', 'exact', 'percentage', 'weight');
exception when duplicate_object then null; end $$;

do $$ begin
  create type join_request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- Supported currencies (exponent 2). Netting across currencies is forbidden.
create or replace function is_supported_currency(code text)
returns boolean language sql immutable as $$
  select code in ('ILS', 'USD', 'EUR', 'GBP')
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_locale text not null default 'he',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  emoji text check (emoji is null or length(emoji) <= 8),
  description text check (description is null or length(description) <= 280),
  default_currency char(3) not null default 'ILS'
    check (is_supported_currency(default_currency)),
  owner_user_id uuid not null references auth.users(id),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_groups_owner on groups(owner_user_id);

-- ---------------------------------------------------------------------------
-- group_members (user_id NULL => placeholder, no login permissions)
-- ---------------------------------------------------------------------------
create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid references auth.users(id),
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  role member_role not null default 'member',
  status member_status not null default 'active',
  created_at timestamptz not null default now()
);
-- At most one membership per (group, user) for real users.
create unique index if not exists uq_group_member_user
  on group_members(group_id, user_id) where user_id is not null;
create index if not exists idx_group_members_group on group_members(group_id);
create index if not exists idx_group_members_user on group_members(user_id);

-- ---------------------------------------------------------------------------
-- group_invites (store only SHA-256 hash of token)
-- ---------------------------------------------------------------------------
create table if not exists group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  token_hash text not null unique,
  created_by_user_id uuid not null references auth.users(id),
  expires_at timestamptz,
  revoked_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  requires_approval boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_group_invites_group on group_invites(group_id);
create index if not exists idx_group_invites_expiry on group_invites(expires_at);

-- ---------------------------------------------------------------------------
-- group_join_requests (only when approval required)
-- ---------------------------------------------------------------------------
create table if not exists group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  requesting_user_id uuid not null references auth.users(id),
  invite_id uuid references group_invites(id) on delete set null,
  requested_display_name text not null,
  status join_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_join_requests_group on group_join_requests(group_id);

-- ---------------------------------------------------------------------------
-- placeholder_claims (single-use, owner-issued)
-- ---------------------------------------------------------------------------
create table if not exists placeholder_claims (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  member_id uuid not null references group_members(id) on delete cascade,
  token_hash text not null unique,
  created_by_user_id uuid not null references auth.users(id),
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_placeholder_claims_group on placeholder_claims(group_id);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 140),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (is_supported_currency(currency)),
  expense_date date not null,
  category text check (category is null or length(category) <= 40),
  created_by_user_id uuid not null references auth.users(id),
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expenses_group_date on expenses(group_id, expense_date desc);

create table if not exists expense_payers (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references group_members(id),
  amount_minor bigint not null check (amount_minor > 0)
);
create index if not exists idx_expense_payers_expense on expense_payers(expense_id);

create table if not exists expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references group_members(id),
  amount_minor bigint not null check (amount_minor >= 0),
  split_mode split_mode not null,
  weight_decimal numeric(12, 4)
);
create index if not exists idx_expense_splits_expense on expense_splits(expense_id);

-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  from_member_id uuid not null references group_members(id),
  to_member_id uuid not null references group_members(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (is_supported_currency(currency)),
  settled_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 140),
  created_by_user_id uuid not null references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_member_id <> to_member_id)
);
create index if not exists idx_settlements_group on settlements(group_id);

-- ---------------------------------------------------------------------------
-- audit_events (append-only)
-- ---------------------------------------------------------------------------
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_group on audit_events(group_id, created_at desc);
