/**
 * Balance ledger and debt simplification. All amounts are integer minor units
 * and are computed per currency (currencies are never netted together).
 */

export interface LedgerExpense {
  currency: string;
  /** memberId -> amount paid (minor units) */
  payers: Record<string, number>;
  /** memberId -> allocated share (minor units) */
  splits: Record<string, number>;
}

export interface LedgerSettlement {
  currency: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

export interface MemberNet {
  memberId: string;
  /** Positive => the group owes this member (creditor). Negative => member owes (debtor). */
  netMinor: number;
}

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

/**
 * Net balance per member for a single currency.
 * net = paid(expenses) - allocated(shares) + outgoing(settlements) - incoming(settlements)
 */
export function computeNetBalances(
  currency: string,
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[],
): MemberNet[] {
  const nets = new Map<string, number>();
  const add = (memberId: string, delta: number) => {
    nets.set(memberId, (nets.get(memberId) ?? 0) + delta);
  };

  for (const exp of expenses) {
    if (exp.currency !== currency) continue;
    for (const [memberId, paid] of Object.entries(exp.payers)) {
      add(memberId, paid);
    }
    for (const [memberId, share] of Object.entries(exp.splits)) {
      add(memberId, -share);
    }
  }

  for (const s of settlements) {
    if (s.currency !== currency) continue;
    // A pays B: A settles a debt, so A's net increases, B's net decreases.
    add(s.fromMemberId, s.amountMinor);
    add(s.toMemberId, -s.amountMinor);
  }

  return [...nets.entries()].map(([memberId, netMinor]) => ({
    memberId,
    netMinor,
  }));
}

/**
 * Greedy debt simplification for a single currency. Matches largest debtor with
 * largest creditor. Deterministic tie-breaking by memberId. This is NOT
 * guaranteed to be the global minimum number of transfers.
 */
export function simplifyDebts(nets: MemberNet[]): Transfer[] {
  const debtors = nets
    .filter((n) => n.netMinor < 0)
    .map((n) => ({ memberId: n.memberId, amount: -n.netMinor }))
    .sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));
  const creditors = nets
    .filter((n) => n.netMinor > 0)
    .map((n) => ({ memberId: n.memberId, amount: n.netMinor }))
    .sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));

  const transfers: Transfer[] = [];
  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di]!;
    const creditor = creditors[ci]!;
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountMinor: amount,
      });
    }
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) di += 1;
    if (creditor.amount === 0) ci += 1;
  }
  return transfers;
}
