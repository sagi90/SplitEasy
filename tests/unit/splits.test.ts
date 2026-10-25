import { describe, it, expect } from "vitest";
import {
  computeSplit,
  equalSplit,
  SplitError,
} from "@/lib/splits";

describe("equalSplit", () => {
  it("allocates remainder deterministically: 10000/3", () => {
    const shares = equalSplit(10000, ["a", "b", "c"]);
    expect(shares.map((s) => s.amountMinor)).toEqual([3334, 3333, 3333]);
    expect(shares.reduce((a, s) => a + s.amountMinor, 0)).toBe(10000);
  });
  it("splits evenly when divisible", () => {
    const shares = equalSplit(9000, ["a", "b", "c"]);
    expect(shares.map((s) => s.amountMinor)).toEqual([3000, 3000, 3000]);
  });
  it("handles a single participant (whole expense)", () => {
    const shares = equalSplit(5000, ["a"]);
    expect(shares).toEqual([{ memberId: "a", amountMinor: 5000 }]);
  });
  it("throws with no participants", () => {
    expect(() => equalSplit(100, [])).toThrow(SplitError);
  });
});

describe("computeSplit — equal", () => {
  it("payer excluded from split still sums to total", () => {
    const shares = computeSplit({
      totalMinor: 9999,
      mode: "equal",
      members: [{ memberId: "x" }, { memberId: "y" }],
    });
    expect(shares.reduce((a, s) => a + s.amountMinor, 0)).toBe(9999);
  });
});

describe("computeSplit — exact", () => {
  it("accepts exact amounts that sum to total", () => {
    const shares = computeSplit({
      totalMinor: 10000,
      mode: "exact",
      members: [
        { memberId: "a", value: 6000 },
        { memberId: "b", value: 4000 },
      ],
    });
    expect(shares.map((s) => s.amountMinor)).toEqual([6000, 4000]);
  });
  it("rejects exact amounts that do not sum", () => {
    expect(() =>
      computeSplit({
        totalMinor: 10000,
        mode: "exact",
        members: [
          { memberId: "a", value: 6000 },
          { memberId: "b", value: 3000 },
        ],
      }),
    ).toThrow(/exact_sum_mismatch/);
  });
});

describe("computeSplit — percentage", () => {
  it("splits by percentages totaling 100", () => {
    const shares = computeSplit({
      totalMinor: 10000,
      mode: "percentage",
      members: [
        { memberId: "a", value: 50 },
        { memberId: "b", value: 25 },
        { memberId: "c", value: 25 },
      ],
    });
    expect(shares.map((s) => s.amountMinor)).toEqual([5000, 2500, 2500]);
  });
  it("handles decimal-safe thirds (33.34/33.33/33.33)", () => {
    const shares = computeSplit({
      totalMinor: 10000,
      mode: "percentage",
      members: [
        { memberId: "a", value: 33.34 },
        { memberId: "b", value: 33.33 },
        { memberId: "c", value: 33.33 },
      ],
    });
    expect(shares.reduce((a, s) => a + s.amountMinor, 0)).toBe(10000);
  });
  it("rejects percentages that do not total 100", () => {
    expect(() =>
      computeSplit({
        totalMinor: 10000,
        mode: "percentage",
        members: [
          { memberId: "a", value: 50 },
          { memberId: "b", value: 40 },
        ],
      }),
    ).toThrow(/percentage_sum_mismatch/);
  });
});

describe("computeSplit — weight", () => {
  it("splits proportionally to weights and sums to total", () => {
    const shares = computeSplit({
      totalMinor: 10000,
      mode: "weight",
      members: [
        { memberId: "a", value: 2 },
        { memberId: "b", value: 1 },
        { memberId: "c", value: 1 },
      ],
    });
    expect(shares.reduce((a, s) => a + s.amountMinor, 0)).toBe(10000);
    expect(shares[0]!.amountMinor).toBe(5000);
  });
  it("rejects total weight of zero", () => {
    expect(() =>
      computeSplit({
        totalMinor: 10000,
        mode: "weight",
        members: [
          { memberId: "a", value: 0 },
          { memberId: "b", value: 0 },
        ],
      }),
    ).toThrow(/weight_sum_zero/);
  });
});

describe("computeSplit — invalid totals", () => {
  it("rejects non-positive totals", () => {
    expect(() =>
      computeSplit({ totalMinor: 0, mode: "equal", members: [{ memberId: "a" }] }),
    ).toThrow(/invalid_total/);
  });
});
