-- ============================================================================
-- SplitEasy functions — expense & settlement transactional RPCs
-- Migration 0003
-- ============================================================================

-- ---------------------------------------------------------------------------
-- save_expense — create or update an expense with payers and splits atomically.
-- p_payers / p_splits are JSON arrays. Enforces invariants:
--   sum(payers) = amount; sum(splits) = amount; all members in group.
-- Optimistic concurrency via p_expected_version on edit.
-- ---------------------------------------------------------------------------
create or replace function save_expense(
  p_expense_id uuid,
  p_group_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_currency text,
  p_expense_date date,
  p_category text,
  p_payers jsonb,
  p_splits jsonb,
  p_expected_version integer
)
returns table (expense_id uuid, version integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_expense_id uuid;
  v_version integer;
  v_payer_sum bigint;
  v_split_sum bigint;
  v_bad_member integer;
  v_before jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  -- Authorization: must be an active member of the group.
  if not is_group_member(p_group_id) then
    raise exception 'not_group_member';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount';
  end if;
  if not is_supported_currency(p_currency) then
    raise exception 'unsupported_currency';
  end if;
  if jsonb_typeof(p_payers) <> 'array' or jsonb_array_length(p_payers) = 0 then
    raise exception 'invalid_payers';
  end if;
  if jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'invalid_splits';
  end if;

  -- Validate sums.
  select coalesce(sum((e->>'amount_minor')::bigint), 0) into v_payer_sum
  from jsonb_array_elements(p_payers) e;
  select coalesce(sum((e->>'amount_minor')::bigint), 0) into v_split_sum
  from jsonb_array_elements(p_splits) e;
  if v_payer_sum <> p_amount_minor then
    raise exception 'payer_sum_mismatch';
  end if;
  if v_split_sum <> p_amount_minor then
    raise exception 'split_sum_mismatch';
  end if;

  -- Every referenced member must belong to this same group (prevents IDOR /
  -- cross-group references).
  select count(*) into v_bad_member
  from (
    select (e->>'member_id')::uuid as member_id from jsonb_array_elements(p_payers) e
    union all
    select (e->>'member_id')::uuid from jsonb_array_elements(p_splits) e
  ) refs
  left join group_members gm
    on gm.id = refs.member_id and gm.group_id = p_group_id
  where gm.id is null;
  if v_bad_member > 0 then
    raise exception 'member_not_in_group';
  end if;

  if p_expense_id is null then
    -- Create
    insert into expenses (group_id, description, amount_minor, currency,
                          expense_date, category, created_by_user_id, version)
    values (p_group_id, trim(p_description), p_amount_minor, p_currency,
            p_expense_date, nullif(trim(p_category), ''), v_uid, 1)
    returning id, version into v_expense_id, v_version;

    insert into audit_events (group_id, actor_user_id, entity_type, entity_id, action, after_json)
    values (p_group_id, v_uid, 'expense', v_expense_id, 'create',
            jsonb_build_object('amount_minor', p_amount_minor, 'currency', p_currency,
                               'description', trim(p_description)));
  else
    -- Edit — only owner or original creator may edit.
    select to_jsonb(ex.*) , ex.version into v_before, v_version
    from expenses ex
    where ex.id = p_expense_id and ex.group_id = p_group_id and ex.deleted_at is null
    for update;
    if v_before is null then
      raise exception 'expense_not_found';
    end if;
    if not (is_group_owner(p_group_id)
            or (v_before->>'created_by_user_id')::uuid = v_uid) then
      raise exception 'not_allowed';
    end if;
    if p_expected_version is not null and v_version <> p_expected_version then
      raise exception 'version_conflict';
    end if;

    update expenses
      set description = trim(p_description),
          amount_minor = p_amount_minor,
          currency = p_currency,
          expense_date = p_expense_date,
          category = nullif(trim(p_category), ''),
          version = version + 1,
          updated_at = now()
      where id = p_expense_id
      returning id, version into v_expense_id, v_version;

    delete from expense_payers where expense_id = p_expense_id;
    delete from expense_splits where expense_id = p_expense_id;

    insert into audit_events (group_id, actor_user_id, entity_type, entity_id, action, before_json, after_json)
    values (p_group_id, v_uid, 'expense', v_expense_id, 'update', v_before,
            jsonb_build_object('amount_minor', p_amount_minor, 'currency', p_currency,
                               'description', trim(p_description)));
  end if;

  insert into expense_payers (expense_id, member_id, amount_minor)
  select v_expense_id, (e->>'member_id')::uuid, (e->>'amount_minor')::bigint
  from jsonb_array_elements(p_payers) e;

  insert into expense_splits (expense_id, member_id, amount_minor, split_mode, weight_decimal)
  select v_expense_id,
         (e->>'member_id')::uuid,
         (e->>'amount_minor')::bigint,
         (e->>'split_mode')::split_mode,
         nullif(e->>'weight_decimal', '')::numeric
  from jsonb_array_elements(p_splits) e;

  return query select v_expense_id, v_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- soft_delete_expense — owner or creator only; keeps row for ledger history.
-- ---------------------------------------------------------------------------
create or replace function soft_delete_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_expense expenses%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_expense from expenses where id = p_expense_id and deleted_at is null for update;
  if not found then raise exception 'expense_not_found'; end if;
  if not (is_group_owner(v_expense.group_id) or v_expense.created_by_user_id = v_uid) then
    raise exception 'not_allowed';
  end if;
  update expenses set deleted_at = now(), updated_at = now() where id = p_expense_id;
  insert into audit_events (group_id, actor_user_id, entity_type, entity_id, action, before_json)
  values (v_expense.group_id, v_uid, 'expense', p_expense_id, 'delete', to_jsonb(v_expense));
end;
$$;

-- ---------------------------------------------------------------------------
-- record_settlement — register a manual payment between two group members.
-- ---------------------------------------------------------------------------
create or replace function record_settlement(
  p_group_id uuid,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not is_group_member(p_group_id) then raise exception 'not_group_member'; end if;
  if p_from_member_id = p_to_member_id then raise exception 'identical_parties'; end if;
  if p_amount_minor is null or p_amount_minor <= 0 then raise exception 'invalid_amount'; end if;
  if not is_supported_currency(p_currency) then raise exception 'unsupported_currency'; end if;
  -- Both parties must belong to this group.
  if not exists (select 1 from group_members where id = p_from_member_id and group_id = p_group_id)
     or not exists (select 1 from group_members where id = p_to_member_id and group_id = p_group_id) then
    raise exception 'member_not_in_group';
  end if;

  insert into settlements (group_id, from_member_id, to_member_id, amount_minor, currency, note, created_by_user_id)
  values (p_group_id, p_from_member_id, p_to_member_id, p_amount_minor, p_currency, nullif(trim(p_note), ''), v_uid)
  returning id into v_id;

  insert into audit_events (group_id, actor_user_id, entity_type, entity_id, action, after_json)
  values (p_group_id, v_uid, 'settlement', v_id, 'create',
          jsonb_build_object('from', p_from_member_id, 'to', p_to_member_id,
                             'amount_minor', p_amount_minor, 'currency', p_currency));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_join_request — owner approves/rejects a pending request.
-- ---------------------------------------------------------------------------
create or replace function resolve_join_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req group_join_requests%rowtype;
  v_member_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_req from group_join_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if not is_group_owner(v_req.group_id) then raise exception 'not_allowed'; end if;
  if v_req.status <> 'pending' then raise exception 'already_resolved'; end if;

  if p_approve then
    if not exists (select 1 from group_members where group_id = v_req.group_id and user_id = v_req.requesting_user_id) then
      insert into group_members (group_id, user_id, display_name, role, status)
      values (v_req.group_id, v_req.requesting_user_id, v_req.requested_display_name, 'member', 'active')
      returning id into v_member_id;
    end if;
    update group_join_requests set status = 'approved', resolved_at = now() where id = p_request_id;
  else
    update group_join_requests set status = 'rejected', resolved_at = now() where id = p_request_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- remove_member — owner marks a member inactive (ledger rows stay immutable).
-- ---------------------------------------------------------------------------
create or replace function remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member group_members%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_member from group_members where id = p_member_id for update;
  if not found then raise exception 'member_not_found'; end if;
  if not is_group_owner(v_member.group_id) then raise exception 'not_allowed'; end if;
  if v_member.role = 'owner' then raise exception 'cannot_remove_owner'; end if;
  update group_members set status = 'inactive' where id = p_member_id;
  insert into audit_events (group_id, actor_user_id, entity_type, entity_id, action)
  values (v_member.group_id, v_uid, 'member', p_member_id, 'deactivate');
end;
$$;
