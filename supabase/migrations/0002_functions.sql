-- ============================================================================
-- SplitEasy functions — RLS helpers and transactional RPCs
-- Migration 0002
-- SECURITY DEFINER functions verify actor identity and authorization in SQL.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER to avoid recursive policy evaluation)
-- ---------------------------------------------------------------------------
create or replace function is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.status = 'active'
  );
$$;

create or replace function is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from groups g
    where g.id = p_group_id
      and g.owner_user_id = auth.uid()
  );
$$;

create or replace function current_member_id(p_group_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select gm.id from group_members gm
  where gm.group_id = p_group_id
    and gm.user_id = auth.uid()
    and gm.status = 'active'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- upsert_profile — ensures a profile row exists for the current user
-- ---------------------------------------------------------------------------
create or replace function upsert_profile(p_display_name text, p_locale text default 'he')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  insert into profiles (id, display_name, preferred_locale)
  values (v_uid, nullif(trim(p_display_name), ''), coalesce(p_locale, 'he'))
  on conflict (id) do update
    set display_name = coalesce(nullif(trim(excluded.display_name), ''), profiles.display_name),
        preferred_locale = coalesce(excluded.preferred_locale, profiles.preferred_locale),
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- create_group_with_owner — atomically create a group and its owner member
-- ---------------------------------------------------------------------------
create or replace function create_group_with_owner(
  p_name text,
  p_display_name text,
  p_currency text,
  p_emoji text
)
returns table (group_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_member_id uuid;
  v_name text := trim(p_name);
  v_display text := nullif(trim(p_display_name), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_name is null or length(v_name) = 0 then
    raise exception 'invalid_group_name';
  end if;
  if not is_supported_currency(coalesce(p_currency, 'ILS')) then
    raise exception 'unsupported_currency';
  end if;

  perform upsert_profile(coalesce(v_display, ''), 'he');

  insert into groups (name, default_currency, emoji, owner_user_id)
  values (v_name, coalesce(p_currency, 'ILS'), nullif(trim(p_emoji), ''), v_uid)
  returning id into v_group_id;

  insert into group_members (group_id, user_id, display_name, role, status)
  values (v_group_id, v_uid, coalesce(v_display, 'Owner'), 'owner', 'active')
  returning id into v_member_id;

  insert into audit_events (group_id, actor_user_id, entity_type, entity_id, action, after_json)
  values (v_group_id, v_uid, 'group', v_group_id, 'create',
          jsonb_build_object('name', v_name, 'currency', coalesce(p_currency, 'ILS')));

  return query select v_group_id, v_member_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_invite — join a group via a validated invite token hash.
-- Creates a NEW member for the current auth user. Never claims an existing
-- member by name. Enforces expiry/revocation/use-limit atomically.
-- ---------------------------------------------------------------------------
create or replace function accept_invite(
  p_token_hash text,
  p_display_name text
)
returns table (group_id uuid, member_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite group_invites%rowtype;
  v_group_id uuid;
  v_member_id uuid;
  v_existing uuid;
  v_display text := nullif(trim(p_display_name), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_display is null then
    raise exception 'invalid_display_name';
  end if;

  -- Lock the invite row to enforce single-use / max_uses under concurrency.
  select * into v_invite from group_invites
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'invite_revoked';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;
  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'invite_exhausted';
  end if;

  v_group_id := v_invite.group_id;

  -- Already a member? Return existing membership without consuming a use.
  select id into v_existing from group_members
  where group_id = v_group_id and user_id = v_uid;
  if found then
    return query select v_group_id, v_existing, 'already_member'::text;
    return;
  end if;

  -- Approval flow: create a pending join request, do not add membership yet.
  if v_invite.requires_approval then
    insert into group_join_requests (group_id, requesting_user_id, invite_id, requested_display_name)
    values (v_group_id, v_uid, v_invite.id, v_display)
    on conflict do nothing;
    -- Consume a use for approval-based invites as well.
    update group_invites set use_count = use_count + 1 where id = v_invite.id;
    return query select v_group_id, null::uuid, 'pending'::text;
    return;
  end if;

  perform upsert_profile(v_display, 'he');

  insert into group_members (group_id, user_id, display_name, role, status)
  values (v_group_id, v_uid, v_display, 'member', 'active')
  returning id into v_member_id;

  update group_invites set use_count = use_count + 1 where id = v_invite.id;

  insert into audit_events (group_id, actor_user_id, entity_type, entity_id, action, after_json)
  values (v_group_id, v_uid, 'member', v_member_id, 'join',
          jsonb_build_object('display_name', v_display, 'via', 'invite'));

  return query select v_group_id, v_member_id, 'joined'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_placeholder_claim — link current user to an existing placeholder
-- member. Single-use, owner-issued token. Never via display name matching.
-- ---------------------------------------------------------------------------
create or replace function consume_placeholder_claim(
  p_token_hash text
)
returns table (group_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_claim placeholder_claims%rowtype;
  v_member group_members%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_claim from placeholder_claims
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'claim_not_found';
  end if;
  if v_claim.consumed_at is not null then
    raise exception 'claim_consumed';
  end if;
  if v_claim.expires_at is not null and v_claim.expires_at < now() then
    raise exception 'claim_expired';
  end if;

  select * into v_member from group_members
  where id = v_claim.member_id
  for update;

  if not found then
    raise exception 'member_not_found';
  end if;
  -- Only genuine placeholders (no user_id) can be claimed.
  if v_member.user_id is not null then
    raise exception 'member_already_linked';
  end if;

  -- The current user must not already be a member of this group.
  if exists (
    select 1 from group_members
    where group_id = v_claim.group_id and user_id = v_uid
  ) then
    raise exception 'already_member';
  end if;

  update group_members
    set user_id = v_uid, status = 'active'
    where id = v_member.id;

  update placeholder_claims set consumed_at = now() where id = v_claim.id;

  insert into audit_events (group_id, actor_user_id, entity_type, entity_id, action, after_json)
  values (v_claim.group_id, v_uid, 'member', v_member.id, 'claim_placeholder',
          jsonb_build_object('member_id', v_member.id));

  return query select v_claim.group_id, v_member.id;
end;
$$;
