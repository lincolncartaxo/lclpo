import { describe, expect, it } from "vitest";
import { budgetItemTotal, trunc2 } from "./budget-calculations";

describe("SINAPI subtotals", () => {
  it("truncates instead of rounding up", () => expect(trunc2(0.0212 * 17.19)).toBe(0.36));
  it("uses the desonerado price in the same reference", () => expect(trunc2(0.0212 * 15.92)).toBe(0.33));
  it("sums truncated line costs", () => expect(trunc2(0.0212 * 15.92) + trunc2(1.234 * 1.82)).toBe(2.57));
  it("avoids losing a cent through floating-point representation", () => expect(trunc2(0.58)).toBe(0.58));
});
describe("budget totals", () => {
  it("multiplies quantity by unit price including BDI", () => expect(budgetItemTotal(10, 100, 0.25)).toBe(1250));
  it("supports a zero BDI", () => expect(budgetItemTotal(2.5, 20, 0)).toBe(50));
});