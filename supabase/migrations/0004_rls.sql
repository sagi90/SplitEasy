-- ============================================================================
-- SplitEasy Row Level Security — Migration 0004
-- Every application table has RLS enabled. Anonymous Supabase users are
-- `authenticated` sessions (NOT the Postgres `anon` role); policies below use
-- auth.uid() and the SECURITY DEFINER helper functions. Privileged writes go
-- through SECURITY DEFINER RPCs which enforce authorization in SQL.
-- ============================================================================

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_invites enable row level security;
alter table group_join_requests enable row level security;
alter table placeholder_claims enable row level security;
alter table expenses enable row level security;
alter table expense_payers enable row level security;
alter table expense_splits enable row level security;
alter table settlements enable row level security;
alter table audit_events enable row level security;

-- ---------------------------------------------------------------------------
-- profiles — users manage only their own profile
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_upsert_own on profiles;
create policy profiles_upsert_own on profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- groups — visible to members/owner; owner may update (rename/archive)
-- ---------------------------------------------------------------------------
drop policy if exists groups_select_members on groups;
create policy groups_select_members on groups
  for select to authenticated
  using (owner_user_id = auth.uid() or is_group_member(id));

drop policy if exists groups_update_owner on groups;
create policy groups_update_owner on groups
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Group creation goes through create_group_with_owner() (SECURITY DEFINER).

-- ---------------------------------------------------------------------------
-- group_members — visible to co-members; writes via RPC only
-- ---------------------------------------------------------------------------
drop policy if exists group_members_select on group_members;
create policy group_members_select on group_members
  for select to authenticated
  using (is_group_member(group_id) or is_group_owner(group_id));

-- Owner may add non-login placeholder members (user_id must be NULL).
drop policy if exists group_members_insert_placeholder on group_members;
create policy group_members_insert_placeholder on group_members
  for insert to authenticated
  with check (is_group_owner(group_id) and user_id is null);

-- ---------------------------------------------------------------------------
-- group_invites — only owner can see/create/revoke
-- ---------------------------------------------------------------------------
drop policy if exists group_invites_select_owner on group_invites;
create policy group_invites_select_owner on group_invites
  for select to authenticated
  using (is_group_owner(group_id));

drop policy if exists group_invites_insert_owner on group_invites;
create policy group_invites_insert_owner on group_invites
  for insert to authenticated
  with check (is_group_owner(group_id) and created_by_user_id = auth.uid());

drop policy if exists group_invites_update_owner on group_invites;
create policy group_invites_update_owner on group_invites
  for update to authenticated
  using (is_group_owner(group_id))
  with check (is_group_owner(group_id));

-- Invite acceptance reads/writes happen inside accept_invite() (SECURITY DEFINER).

-- ---------------------------------------------------------------------------
-- group_join_requests — owner sees all; requester sees own
-- ---------------------------------------------------------------------------
drop policy if exists join_requests_select on group_join_requests;
create policy join_requests_select on group_join_requests
  for select to authenticated
  using (is_group_owner(group_id) or requesting_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- placeholder_claims — only owner can see/create
-- ---------------------------------------------------------------------------
drop policy if exists placeholder_claims_select_owner on placeholder_claims;
create policy placeholder_claims_select_owner on placeholder_claims
  for select to authenticated
  using (is_group_owner(group_id));

drop policy if exists placeholder_claims_insert_owner on placeholder_claims;
create policy placeholder_claims_insert_owner on placeholder_claims
  for insert to authenticated
  with check (is_group_owner(group_id) and created_by_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- expenses + lines — visible to active group members; writes via RPC
-- ---------------------------------------------------------------------------
drop policy if exists expenses_select on expenses;
create policy expenses_select on expenses
  for select to authenticated
  using (is_group_member(group_id));

drop policy if exists expense_payers_select on expense_payers;
create policy expense_payers_select on expense_payers
  for select to authenticated
  using (exists (
    select 1 from expenses e
    where e.id = expense_payers.expense_id and is_group_member(e.group_id)
  ));

drop policy if exists expense_splits_select on expense_splits;
create policy expense_splits_select on expense_splits
  for select to authenticated
  using (exists (
    select 1 from expenses e
    where e.id = expense_splits.expense_id and is_group_member(e.group_id)
  ));

-- ---------------------------------------------------------------------------
-- settlements — visible to active group members; writes via RPC
-- ---------------------------------------------------------------------------
drop policy if exists settlements_select on settlements;
create policy settlements_select on settlements
  for select to authenticated
  using (is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- audit_events — visible to group members; writes via RPC only
-- ---------------------------------------------------------------------------
drop policy if exists audit_select on audit_events;
create policy audit_select on audit_events
  for select to authenticated
  using (is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- Function execution grants (authenticated includes anonymous sessions)
-- ---------------------------------------------------------------------------
grant execute on function create_group_with_owner(text, text, text, text) to authenticated;
grant execute on function accept_invite(text, text) to authenticated;
grant execute on function consume_placeholder_claim(text) to authenticated;
grant execute on function save_expense(uuid, uuid, text, bigint, text, date, text, jsonb, jsonb, integer) to authenticated;
grant execute on function soft_delete_expense(uuid) to authenticated;
grant execute on function record_settlement(uuid, uuid, uuid, bigint, text, text) to authenticated;
grant execute on function resolve_join_request(uuid, boolean) to authenticated;
grant execute on function remove_member(uuid) to authenticated;
grant execute on function upsert_profile(text, text) to authenticated;
