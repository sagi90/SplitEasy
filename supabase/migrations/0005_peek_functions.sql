-- ============================================================================
-- SplitEasy — minimal pre-session lookups for invite/claim landing pages
-- Migration 0005
-- These SECURITY DEFINER functions expose ONLY minimal display info after
-- token validation (group name/emoji + validity). No members, balances or
-- expenses are revealed before acceptance. Callable by anon + authenticated.
-- ============================================================================

create or replace function peek_invite(p_token_hash text)
returns table (
  group_name text,
  group_emoji text,
  requires_approval boolean,
  valid boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite group_invites%rowtype;
  v_group groups%rowtype;
  v_valid boolean;
begin
  select * into v_invite from group_invites where token_hash = p_token_hash;
  if not found then
    return query select null::text, null::text, false, false;
    return;
  end if;
  v_valid := v_invite.revoked_at is null
    and (v_invite.expires_at is null or v_invite.expires_at >= now())
    and (v_invite.max_uses is null or v_invite.use_count < v_invite.max_uses);

  select * into v_group from groups where id = v_invite.group_id;
  return query select v_group.name, v_group.emoji, v_invite.requires_approval, v_valid;
end;
$$;

create or replace function peek_claim(p_token_hash text)
returns table (
  group_name text,
  member_name text,
  valid boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claim placeholder_claims%rowtype;
  v_group groups%rowtype;
  v_member group_members%rowtype;
  v_valid boolean;
begin
  select * into v_claim from placeholder_claims where token_hash = p_token_hash;
  if not found then
    return query select null::text, null::text, false;
    return;
  end if;
  select * into v_member from group_members where id = v_claim.member_id;
  v_valid := v_claim.consumed_at is null
    and (v_claim.expires_at is null or v_claim.expires_at >= now())
    and v_member.user_id is null;
  select * into v_group from groups where id = v_claim.group_id;
  return query select v_group.name, v_member.display_name, v_valid;
end;
$$;

grant execute on function peek_invite(text) to anon, authenticated;
grant execute on function peek_claim(text) to anon, authenticated;
