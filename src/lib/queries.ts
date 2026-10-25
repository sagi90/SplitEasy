import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  computeNetBalances,
  simplifyDebts,
  type LedgerExpense,
  type LedgerSettlement,
  type Transfer,
} from "@/lib/balances";
import type { Tables } from "@/lib/database.types";
import { SUPPORTED_CURRENCIES, type Currency } from "@/lib/money";

export interface GroupListItem {
  id: string;
  name: string;
  emoji: string | null;
  default_currency: string;
  is_archived: boolean;
  role: string;
}

/** Groups the current user belongs to (as an active member). */
export async function getMyGroups(): Promise<GroupListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("role, status, groups!inner(id, name, emoji, default_currency, is_archived)")
    .eq("status", "active");
  if (error || !data) return [];
  return data
    .map((row) => {
      const g = row.groups as unknown as Tables<"groups">;
      return {
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        default_currency: g.default_currency,
        is_archived: g.is_archived,
        role: row.role as string,
      };
    })
    .filter((g) => !g.is_archived);
}

export interface MemberView {
  id: string;
  display_name: string;
  role: string;
  status: string;
  isPlaceholder: boolean;
  isCurrentUser: boolean;
}

export interface ExpenseView {
  id: string;
  description: string;
  amount_minor: number;
  currency: string;
  expense_date: string;
  category: string | null;
  created_by_user_id: string;
  version: number;
  payers: { member_id: string; amount_minor: number }[];
  splits: { member_id: string; amount_minor: number; split_mode: string }[];
}

export interface CurrencyBalance {
  currency: Currency;
  nets: { memberId: string; netMinor: number }[];
  transfers: Transfer[];
}

export interface GroupDetail {
  group: Tables<"groups">;
  members: MemberView[];
  expenses: ExpenseView[];
  settlements: Tables<"settlements">[];
  balancesByCurrency: CurrencyBalance[];
  currentUserId: string | null;
  currentMemberId: string | null;
  isOwner: boolean;
}

/** Full group detail with members, expenses, settlements and computed balances. */
export async function getGroupDetail(groupId: string): Promise<GroupDetail | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: group, error: gErr } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (gErr || !group) {
  console.error("[SplitEasy] Group detail diagnostic:", {
    groupId,
    userId: user?.id ?? null,
    errorCode: gErr?.code ?? null,
    errorMessage: gErr?.message ?? null,
    groupFound: !!group,
  });

  return null;
}

  const { data: memberRows } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  const members: MemberView[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    display_name: m.display_name,
    role: m.role,
    status: m.status,
    isPlaceholder: m.user_id === null,
    isCurrentUser: !!user && m.user_id === user.id,
  }));
  const currentMember = (memberRows ?? []).find(
    (m) => user && m.user_id === user.id,
  );

  const { data: expenseRows } = await supabase
    .from("expenses")
    .select(
      "*, expense_payers(member_id, amount_minor), expense_splits(member_id, amount_minor, split_mode)",
    )
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  const expenses: ExpenseView[] = (expenseRows ?? []).map((e) => ({
    id: e.id,
    description: e.description,
    amount_minor: Number(e.amount_minor),
    currency: e.currency,
    expense_date: e.expense_date,
    category: e.category,
    created_by_user_id: e.created_by_user_id,
    version: e.version,
    payers: ((e.expense_payers as { member_id: string; amount_minor: number }[]) ?? []).map(
      (p) => ({ member_id: p.member_id, amount_minor: Number(p.amount_minor) }),
    ),
    splits: ((e.expense_splits as { member_id: string; amount_minor: number; split_mode: string }[]) ?? []).map(
      (s) => ({
        member_id: s.member_id,
        amount_minor: Number(s.amount_minor),
        split_mode: s.split_mode,
      }),
    ),
  }));

  const { data: settlementRows } = await supabase
    .from("settlements")
    .select("*")
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .order("settled_at", { ascending: false });
  const settlements = (settlementRows ?? []) as Tables<"settlements">[];

  const balancesByCurrency = computeBalances(expenses, settlements);

  return {
    group: group as Tables<"groups">,
    members,
    expenses,
    settlements,
    balancesByCurrency,
    currentUserId: user?.id ?? null,
    currentMemberId: currentMember?.id ?? null,
    isOwner: !!user && group.owner_user_id === user.id,
  };
}

function computeBalances(
  expenses: ExpenseView[],
  settlements: Tables<"settlements">[],
): CurrencyBalance[] {
  const currencies = new Set<string>();
  expenses.forEach((e) => currencies.add(e.currency));
  settlements.forEach((s) => currencies.add(s.currency));

  const result: CurrencyBalance[] = [];
  for (const currency of SUPPORTED_CURRENCIES) {
    if (!currencies.has(currency)) continue;
    const ledgerExpenses: LedgerExpense[] = expenses
      .filter((e) => e.currency === currency)
      .map((e) => ({
        currency,
        payers: Object.fromEntries(
          e.payers.map((p) => [p.member_id, p.amount_minor]),
        ),
        splits: Object.fromEntries(
          e.splits.map((s) => [s.member_id, s.amount_minor]),
        ),
      }));
    const ledgerSettlements: LedgerSettlement[] = settlements
      .filter((s) => s.currency === currency)
      .map((s) => ({
        currency,
        fromMemberId: s.from_member_id,
        toMemberId: s.to_member_id,
        amountMinor: Number(s.amount_minor),
      }));
    const nets = computeNetBalances(currency, ledgerExpenses, ledgerSettlements);
    const transfers = simplifyDebts(nets);
    result.push({ currency, nets, transfers });
  }
  return result;
}

export interface InviteRow {
  id: string;
  expires_at: string | null;
  revoked_at: string | null;
  max_uses: number | null;
  use_count: number;
  requires_approval: boolean;
}

export async function getGroupInvites(groupId: string): Promise<InviteRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("group_invites")
    .select("id, expires_at, revoked_at, max_uses, use_count, requires_approval")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  return (data ?? []) as InviteRow[];
}

export async function getPendingJoinRequests(groupId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("group_join_requests")
    .select("id, requested_display_name, status, created_at")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return data ?? [];
}
