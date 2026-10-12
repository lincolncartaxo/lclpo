/**
 * Converte valores monetários vindos de CSV/XLSX para número.
 * Aceita: 1,82 | 1.82 | 1.234,56 | 1,234.56 | R$ 1.234,56.
 */
export function parseLocalizedNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;

  let text = String(value).trim();
  if (!text) return 0;

  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  text = text.replace(/[()]/g, "").replace(/[^0-9,.-]/g, "");
  if (!text) return 0;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // O separador que aparece por último é tratado como decimal.
    if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
    else text = text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if ((text.match(/\./g) ?? []).length > 1) {
    const decimal = text.lastIndexOf(".");
    text = `${text.slice(0, decimal).replace(/\./g, "")}.${text.slice(decimal + 1)}`;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}
