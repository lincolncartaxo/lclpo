import { budgetItemTotal } from "./budget-calculations";

export function discountedPrice(original: number, percentage: number) {
  if (!Number.isFinite(original) || original < 0 || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new Error("Desconto deve estar entre 0 e 100%.");
  return original * (1 - percentage / 100);
}
export function measurementBalance(contracted: number, previous: number, current: number) {
  if (![contracted, previous, current].every(Number.isFinite) || Math.min(contracted, previous, current) < 0 || previous + current > contracted + 0.00000001) throw new Error("Quantidade medida excede o saldo do item.");
  return { accumulated: previous + current, remaining: Math.max(0, contracted - previous - current) };
}
export function measurementAmount(quantity: number, unitPrice: number, bdi: number) {
  return Math.round(budgetItemTotal(quantity, unitPrice, bdi) * 100) / 100;
}