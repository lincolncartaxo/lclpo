// Decimal products are normalized to six places before truncation to match SINAPI.
export const trunc2 = (value: number) => Math.trunc(Math.round(value * 1e6) / 1e4) / 100;
export const budgetItemTotal = (quantity: number, unitPrice: number, bdi: number) => quantity * unitPrice * (1 + bdi);