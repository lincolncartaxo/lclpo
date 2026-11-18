import { describe, expect, it } from "vitest";
import { discountedPrice, measurementBalance, measurementAmount } from "./contract-calculations";
describe("licitação e medições", () => {
  it("aplica redução individual de 15% ao preço de 100", () => expect(discountedPrice(100, 15)).toBe(85));
  it("aceita desconto total e rejeita redução acima de 100%", () => { expect(discountedPrice(100, 100)).toBe(0); expect(() => discountedPrice(100, 101)).toThrow(); });
  it("acumula quantidades e calcula saldo da medição", () => expect(measurementBalance(100, 30, 20)).toEqual({ accumulated: 50, remaining: 50 }));
  it("não permite medir além da quantidade contratada", () => expect(() => measurementBalance(100, 90, 11)).toThrow());
  it("não aceita quantidade negativa", () => expect(() => measurementBalance(100, 0, -1)).toThrow());
  it("valor medido usa preço licitado e BDI", () => expect(measurementAmount(2, discountedPrice(100, 10), 0.25)).toBe(225));
});