import { describe, it, expect } from "vitest";
import {
  computeNetBalances,
  simplifyDebts,
  type LedgerExpense,
  type LedgerSettlement,
} from "@/lib/balances";
import { equalSplit } from "@/lib/splits";

describe("computeNetBalances", () => {
  it("payer net increases, split participants net decreases", () => {
    const expenses: LedgerExpense[] = [
      {
        currency: "ILS",
        payers: { a: 9000 },
        splits: { a: 3000, b: 3000, c: 3000 },
      },
    ];
    const nets = computeNetBalances("ILS", expenses, []);
    const map = Object.fromEntries(nets.map((n) => [n.memberId, n.netMinor]));
    expect(map.a).toBe(6000);
    expect(map.b).toBe(-3000);
    expect(map.c).toBe(-3000);
    expect(nets.reduce((s, n) => s + n.netMinor, 0)).toBe(0);
  });

  it("settlement from A to B increases A and decreases B", () => {
    const settlements: LedgerSettlement[] = [
      { currency: "ILS", fromMemberId: "b", toMemberId: "a", amountMinor: 3000 },
    ];
    const nets = computeNetBalances("ILS", [], settlements);
    const map = Object.fromEntries(nets.map((n) => [n.memberId, n.netMinor]));
    expect(map.b).toBe(3000);
    expect(map.a).toBe(-3000);
  });

  it("ignores other currencies", () => {
    const expenses: LedgerExpense[] = [
      { currency: "USD", payers: { a: 5000 }, splits: { a: 5000 } },
    ];
    const nets = computeNetBalances("ILS", expenses, []);
    expect(nets.length).toBe(0);
  });
});

describe("simplifyDebts", () => {
  it("matches debtors with creditors", () => {
    const nets = [
      { memberId: "a", netMinor: 6000 },
      { memberId: "b", netMinor: -3000 },
      { memberId: "c", netMinor: -3000 },
    ];
    const transfers = simplifyDebts(nets);
    const total = transfers.reduce((s, t) => s + t.amountMinor, 0);
    expect(total).toBe(6000);
    transfers.forEach((t) => expect(t.toMemberId).toBe("a"));
  });

  it("produces deterministic output", () => {
    const nets = [
      { memberId: "a", netMinor: 5000 },
      { memberId: "b", netMinor: 5000 },
      { memberId: "c", netMinor: -4000 },
      { memberId: "d", netMinor: -6000 },
    ];
    const t1 = simplifyDebts(nets);
    const t2 = simplifyDebts([...nets]);
    expect(t1).toEqual(t2);
  });
});

describe("1000 random balanced ledgers always net to zero", () => {
  it("sum of nets per currency equals zero and transfers balance", () => {
    for (let iter = 0; iter < 1000; iter++) {
      const memberCount = 2 + (iter % 5);
      const members = Array.from({ length: memberCount }, (_, i) => `m${i}`);
      const expenses: LedgerExpense[] = [];
      const txCount = 1 + (iter % 4);
      for (let k = 0; k < txCount; k++) {
        const total = 100 + ((iter * 7 + k * 13) % 100000);
        const payer = members[(iter + k) % members.length]!;
        const shares = equalSplit(total, members);
        expenses.push({
          currency: "ILS",
          payers: { [payer]: total },
          splits: Object.fromEntries(shares.map((s) => [s.memberId, s.amountMinor])),
        });
      }
      const nets = computeNetBalances("ILS", expenses, []);
      const sum = nets.reduce((s, n) => s + n.netMinor, 0);
      expect(sum).toBe(0);
      const transfers = simplifyDebts(nets);
      const creditTotal = nets
        .filter((n) => n.netMinor > 0)
        .reduce((s, n) => s + n.netMinor, 0);
      const transferred = transfers.reduce((s, t) => s + t.amountMinor, 0);
      expect(transferred).toBe(creditTotal);
    }
  });
});

describe("multi-currency isolation", () => {
  it("computes each currency separately", () => {
    const expenses: LedgerExpense[] = [
      { currency: "ILS", payers: { a: 10000 }, splits: { a: 5000, b: 5000 } },
      { currency: "USD", payers: { b: 8000 }, splits: { a: 4000, b: 4000 } },
    ];
    const ils = computeNetBalances("ILS", expenses, []);
    const usd = computeNetBalances("USD", expenses, []);
    expect(Object.fromEntries(ils.map((n) => [n.memberId, n.netMinor])).a).toBe(5000);
    expect(Object.fromEntries(usd.map((n) => [n.memberId, n.netMinor])).a).toBe(-4000);
  });
});
