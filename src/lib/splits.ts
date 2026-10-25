/**
 * Expense split computation. All amounts are integer minor units.
 * Members are identified by a stable string id (group_member id). Split order
 * is the provided array order, which callers must keep deterministic.
 */

export type SplitMode = "equal" | "exact" | "percentage" | "weight";

export interface SplitInputMember {
  memberId: string;
  /** For exact: minor units. For percentage: percent (e.g. 25 or 33.33). For weight: nonnegative weight. */
  value?: number;
}

export interface SplitShare {
  memberId: string;
  amountMinor: number;
}

export class SplitError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "SplitError";
  }
}

/**
 * Equal split with deterministic remainder allocation in member order.
 * Example: 10000 / 3 => [3334, 3333, 3333].
 */
export function equalSplit(
  totalMinor: number,
  memberIds: string[],
): SplitShare[] {
  if (memberIds.length === 0) {
    throw new SplitError("No participants for split", "no_participants");
  }
  const base = Math.floor(totalMinor / memberIds.length);
  let remainder = totalMinor - base * memberIds.length;
  return memberIds.map((memberId) => {
    let amount = base;
    if (remainder > 0) {
      amount += 1;
      remainder -= 1;
    }
    return { memberId, amountMinor: amount };
  });
}

/** Exact split — provided amounts must sum exactly to the total. */
export function exactSplit(
  totalMinor: number,
  members: SplitInputMember[],
): SplitShare[] {
  const shares = members.map((m) => {
    const amount = m.value ?? 0;
    if (!Number.isInteger(amount) || amount < 0) {
      throw new SplitError("Exact amounts must be nonnegative integers", "invalid_exact");
    }
    return { memberId: m.memberId, amountMinor: amount };
  });
  const sum = shares.reduce((acc, s) => acc + s.amountMinor, 0);
  if (sum !== totalMinor) {
    throw new SplitError(
      `Exact split must sum to total (${sum} != ${totalMinor})`,
      "exact_sum_mismatch",
    );
  }
  return shares;
}

/**
 * Percentage split. Percentages must total 100 (decimal-safe to 2 places).
 * Allocation uses largest-remainder method for deterministic rounding.
 */
export function percentageSplit(
  totalMinor: number,
  members: SplitInputMember[],
): SplitShare[] {
  if (members.length === 0) {
    throw new SplitError("No participants for split", "no_participants");
  }
  // Work in basis points (percent * 100) to avoid float issues.
  const bps = members.map((m) => {
    const pct = m.value ?? 0;
    const asBps = Math.round(pct * 100);
    if (asBps < 0) throw new SplitError("Negative percentage", "invalid_percentage");
    return asBps;
  });
  const totalBps = bps.reduce((a, b) => a + b, 0);
  if (totalBps !== 10000) {
    throw new SplitError("Percentages must total 100", "percentage_sum_mismatch");
  }
  return largestRemainderAllocate(totalMinor, members, bps);
}

/** Weighted split. Weights nonnegative and sum to a positive total. */
export function weightSplit(
  totalMinor: number,
  members: SplitInputMember[],
): SplitShare[] {
  if (members.length === 0) {
    throw new SplitError("No participants for split", "no_participants");
  }
  const weights = members.map((m) => {
    const w = m.value ?? 0;
    if (!(w >= 0) || !Number.isFinite(w)) {
      throw new SplitError("Weights must be nonnegative", "invalid_weight");
    }
    // Store weights as integer thousandths for determinism.
    return Math.round(w * 1000);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    throw new SplitError("Total weight must be positive", "weight_sum_zero");
  }
  return largestRemainderAllocate(totalMinor, members, weights);
}

/**
 * Allocate totalMinor across members proportionally to integer ratios,
 * distributing the rounding remainder deterministically (largest fractional
 * remainder first, then member order) so shares always sum to total.
 */
function largestRemainderAllocate(
  totalMinor: number,
  members: SplitInputMember[],
  ratios: number[],
): SplitShare[] {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  const provisional = members.map((m, i) => {
    const ratio = ratios[i] ?? 0;
    const exact = (totalMinor * ratio) / totalRatio;
    const floorAmount = Math.floor(exact);
    return {
      memberId: m.memberId,
      amountMinor: floorAmount,
      remainder: exact - floorAmount,
      index: i,
    };
  });
  const allocated = provisional.reduce((acc, p) => acc + p.amountMinor, 0);
  let leftover = totalMinor - allocated;
  const byRemainder = [...provisional].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.index - b.index;
  });
  for (const p of byRemainder) {
    if (leftover <= 0) break;
    p.amountMinor += 1;
    leftover -= 1;
  }
  return provisional.map((p) => ({
    memberId: p.memberId,
    amountMinor: p.amountMinor,
  }));
}

export interface ComputeSplitParams {
  totalMinor: number;
  mode: SplitMode;
  members: SplitInputMember[];
}

/** Dispatch to the correct split algorithm and validate the result sum. */
export function computeSplit({
  totalMinor,
  mode,
  members,
}: ComputeSplitParams): SplitShare[] {
  if (!Number.isInteger(totalMinor) || totalMinor <= 0) {
    throw new SplitError("Total must be a positive integer", "invalid_total");
  }
  let shares: SplitShare[];
  switch (mode) {
    case "equal":
      shares = equalSplit(
        totalMinor,
        members.map((m) => m.memberId),
      );
      break;
    case "exact":
      shares = exactSplit(totalMinor, members);
      break;
    case "percentage":
      shares = percentageSplit(totalMinor, members);
      break;
    case "weight":
      shares = weightSplit(totalMinor, members);
      break;
    default:
      throw new SplitError(`Unknown split mode: ${mode as string}`, "unknown_mode");
  }
  const sum = shares.reduce((acc, s) => acc + s.amountMinor, 0);
  if (sum !== totalMinor) {
    throw new SplitError("Split shares do not sum to total", "sum_invariant");
  }
  return shares;
}
