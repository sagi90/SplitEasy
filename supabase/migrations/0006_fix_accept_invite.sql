-- ============================================================================
-- SplitEasy — Migration 0006
-- Fix PostgreSQL 42702 (ambiguous_column) in accept_invite().
-- The function's RETURNS TABLE OUT params (group_id, member_id, status) are in
-- scope inside the body; an unqualified `group_id` in the membership lookup was
-- ambiguous with group_members.group_id. All table column references that
-- collide with an OUT param name are now qualified via explicit table aliases.
-- Signature, SECURITY DEFINER, search_path, business logic and grants unchanged.
-- ============================================================================

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
  select gi.* into v_invite from group_invites as gi
  where gi.token_hash = p_token_hash
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
  select gm.id into v_existing from group_members as gm
  where gm.group_id = v_group_id and gm.user_id = v_uid;
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
    update group_invites as gi set use_count = gi.use_count + 1 where gi.id = v_invite.id;
    return query select v_group_id, null::uuid, 'pending'::text;
    return;
  end if;

  perform upsert_profile(v_display, 'he');

  insert into group_members (group_id, user_id, display_name, role, status)
  values (v_group_id, v_uid, v_display, 'member', 'active')
  returning id into v_member_id;

  update group_invites as gi set use_count = gi.use_count + 1 where gi.id = v_invite.id;

  insert into audit_events (group_id, actor_user_id, entity_type, entity_id, action, after_json)
  values (v_group_id, v_uid, 'member', v_member_id, 'join',
          jsonb_build_object('display_name', v_display, 'via', 'invite'));

  return query select v_group_id, v_member_id, 'joined'::text;
end;
$$;

-- Re-assert execution grant (idempotent; signature unchanged).
grant execute on function accept_invite(text, text) to authenticated;

-- Refresh PostgREST schema cache.
notify pgrst, 'reload schema';
