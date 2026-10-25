import { describe, it, expect } from "vitest";
import {
  parseAmountToMinor,
  formatMinor,
  isSupportedCurrency,
} from "@/lib/money";

describe("parseAmountToMinor", () => {
  it("parses whole numbers", () => {
    expect(parseAmountToMinor("100")).toBe(10000);
  });
  it("parses two decimals", () => {
    expect(parseAmountToMinor("12.34")).toBe(1234);
  });
  it("pads single decimal", () => {
    expect(parseAmountToMinor("12.3")).toBe(1230);
  });
  it("strips thousands commas", () => {
    expect(parseAmountToMinor("1,000.50")).toBe(100050);
  });
  it("rejects excess precision", () => {
    expect(parseAmountToMinor("1.234")).toBeNull();
  });
  it("rejects zero and negatives", () => {
    expect(parseAmountToMinor("0")).toBeNull();
    expect(parseAmountToMinor("-5")).toBeNull();
  });
  it("rejects non-numeric", () => {
    expect(parseAmountToMinor("abc")).toBeNull();
    expect(parseAmountToMinor("")).toBeNull();
    expect(parseAmountToMinor("1.2.3")).toBeNull();
  });
});

describe("formatMinor", () => {
  it("formats minor units", () => {
    expect(formatMinor(1234)).toBe("12.34");
    expect(formatMinor(1000)).toBe("10.00");
    expect(formatMinor(5)).toBe("0.05");
  });
});

describe("isSupportedCurrency", () => {
  it("accepts supported", () => {
    expect(isSupportedCurrency("ILS")).toBe(true);
    expect(isSupportedCurrency("USD")).toBe(true);
  });
  it("rejects unsupported", () => {
    expect(isSupportedCurrency("JPY")).toBe(false);
    expect(isSupportedCurrency("btc")).toBe(false);
  });
});
