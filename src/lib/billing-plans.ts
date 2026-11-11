// Mapeamento entre planos do app e preços do Stripe (mensal, BRL).
export const BILLING_PLANS = {
  pro: { name: "Pro", priceId: "price_1UaYWG87ptxsSD5xxwwYbTgt", productId: "prod_Vbm4g017HpSbSt", amount: 129, desc: "1 usuário, orçamentos ilimitados" },
  business: { name: "Equipe", priceId: "price_1UaYWR87ptxsSD5xNIbrBYUk", productId: "prod_Vbm4bpnikbn8Gt", amount: 349, desc: "Até 5 usuários, compartilhamento e bases próprias" },
  enterprise: { name: "Empresa", priceId: "price_1UaYWc87ptxsSD5xN8LLyrEG", productId: "prod_Vbm4QlPTutMlP2", amount: 799, desc: "Usuários ilimitados e suporte prioritário" },
} as const;
export type PaidPlanCode = keyof typeof BILLING_PLANS;

export function planFromProduct(productId: string | null | undefined): PaidPlanCode | null {
  for (const [code, p] of Object.entries(BILLING_PLANS)) if (p.productId === productId) return code as PaidPlanCode;
  return null;
}
