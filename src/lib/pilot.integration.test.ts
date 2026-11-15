import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";

// Explicitly opt in: creates isolated disposable users/companies, then removes them.
describe.runIf(process.env.RUN_DB_TESTS === "true")("commercial pilot database integration", () => {
  let admin: SupabaseClient<Database>;
  let alice: SupabaseClient<Database>;
  let bob: SupabaseClient<Database>;
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const users: string[] = [];
  let budgetA = "";
  let budgetB = "";
  const marker = crypto.randomUUID().replaceAll("-", "");
  const customer = `cus_test${marker}`;
  const subscription = `sub_test${marker}`;
  const requireData = <T,>(result: { data: T; error: { message: string } | null }) => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  };
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Server test connection unavailable");
    admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } } });
    requireData(await admin.from("empresas").insert([{ id: orgA, nome: `PILOT TEST A ${marker}` }, { id: orgB, nome: `PILOT TEST B ${marker}` }]));
    requireData(await admin.from("organization_subscriptions").upsert([{ organization_id: orgA, plan_code: "enterprise", status: "active" }, { organization_id: orgB, plan_code: "free", status: "active" }]));
    const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!publicKey) throw new Error("Public test connection unavailable");
    for (const [index, org] of [orgA, orgB].entries()) {
      const email = `pilot-${marker}-${index}@example.invalid`;
      const password = `Pilot-${crypto.randomUUID()}-Aa1`;
      // Confirmation applies only to disposable fixtures, never hosted auth settings.
      const creation = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (creation.error) throw new Error(creation.error.message);
      const created = creation.data;
      if (!created.user) throw new Error("Fixture creation failed");
      users.push(created.user.id);
      requireData(await admin.from("profiles").upsert({ id: created.user.id, id_empresa: org }));
      requireData(await admin.from("organization_members").update({ role: index === 0 ? "owner" : "member" }).eq("organization_id", org).eq("user_id", created.user.id));
      const client = createClient<Database>(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error) throw new Error(login.error.message);
      const memberCheck = requireData(await client.rpc("is_organization_member", { p_organization_id: org }));
      if (!memberCheck) throw new Error(`Fixture membership unavailable for company ${index}`);
      if (index === 0) alice = client; else bob = client;
    }
    const rowA = requireData(await alice.from("orcamentos").insert({ nome: "Pilot isolated budget A", user_id: users[0], organization_id: orgA }).select("id").single());
    const rowB = requireData(await bob.from("orcamentos").insert({ nome: "Pilot isolated budget B", user_id: users[1], organization_id: orgB }).select("id").single());
    if (!rowA || !rowB) throw new Error("Fixture budget creation failed");
    budgetA = rowA.id; budgetB = rowB.id;
    requireData(await alice.from("orcamento_itens").insert({ orcamento_id: budgetA, descricao: "Fixture A", quantidade: 1, preco_unitario: 10 }));
    requireData(await alice.from("orcamento_cronograma").insert({ orcamento_id: budgetA, etapa: "1", mes: 1, percentual: 1 }));
  }, 60000);
  afterAll(async () => {
    if (!admin) return;
    requireData(await admin.from("billing_events").delete().in("organization_id", [orgA, orgB]));
    for (const user of users) { const { error } = await admin.auth.admin.deleteUser(user); if (error) throw new Error("Fixture user cleanup failed"); }
    const { error } = await admin.from("empresas").delete().in("id", [orgA, orgB]);
    if (error) throw new Error("Fixture company cleanup failed");
  }, 60000);
  it("company B cannot read company A budgets", async () => expect(requireData(await bob.from("orcamentos").select("id").eq("id", budgetA))).toEqual([]));
  it("company A cannot read company B budgets", async () => expect(requireData(await alice.from("orcamentos").select("id").eq("id", budgetB))).toEqual([]));
  it("company B cannot read company A items", async () => expect(requireData(await bob.from("orcamento_itens").select("id").eq("orcamento_id", budgetA))).toEqual([]));
  it("company B cannot read company A schedule", async () => expect(requireData(await bob.from("orcamento_cronograma").select("id").eq("orcamento_id", budgetA))).toEqual([]));
  it("company B cannot edit company A budget", async () => expect(requireData(await bob.from("orcamentos").update({ nome: "unauthorized" }).eq("id", budgetA).select("id"))).toEqual([]));
  it("company B cannot add items to company A budget", async () => expect((await bob.from("orcamento_itens").insert({ orcamento_id: budgetA, descricao: "unauthorized" })).error).not.toBeNull());
  it("an owner cannot transfer a budget to another company", async () => expect((await alice.from("orcamentos").update({ organization_id: orgB }).eq("id", budgetA)).error).not.toBeNull());
  it("an owner can manage its own billing", async () => expect(requireData(await alice.rpc("can_manage_organization_billing", { p_organization_id: orgA }))).toBe(true));
  it("an owner cannot manage another company's billing", async () => expect(requireData(await alice.rpc("can_manage_organization_billing", { p_organization_id: orgB }))).toBe(false));
  it("ordinary members cannot manage billing", async () => expect(requireData(await bob.rpc("can_manage_organization_billing", { p_organization_id: orgB }))).toBe(false));
  it("authenticated members cannot bind arbitrary Stripe customers", async () => expect((await alice.rpc("bind_stripe_customer", { p_organization_id: orgA, p_customer_id: customer })).error).not.toBeNull());
  it("Free permits exactly two budgets and blocks a third", async () => {
    requireData(await bob.from("orcamentos").insert({ nome: "Second free fixture", user_id: users[1], organization_id: orgB }));
    expect((await bob.from("orcamentos").insert({ nome: "Third free fixture", user_id: users[1], organization_id: orgB })).error).not.toBeNull();
  });
  it("existing budgets remain editable at the Free limit", async () => expect(requireData(await bob.from("orcamentos").update({ nome: "Edited at quota" }).eq("id", budgetB).select("id"))).toHaveLength(1));
  it.each([["88316", "desonerado", 22.75], ["88316", "nao_desonerado", 24.05], ["95378", "desonerado", 0.33], ["95378", "nao_desonerado", 0.36]])("real SINAPI PB May 2026 %s %s = %s", async (code, regime, price) => {
    expect(requireData(await alice.rpc("calcular_custo_composicao", { p_fonte: "SINAPI", p_codigo: String(code), p_uf: "PB", p_mes_ref: "2026-05", p_regime: String(regime) }))).toBe(price);
  });
  it("events preserve manual paid grants and are idempotent", async () => {
    requireData(await admin.rpc("bind_stripe_customer", { p_organization_id: orgA, p_customer_id: customer }));
    const args = { p_event_id: `evt_${marker}`, p_event_type: "customer.subscription.updated", p_event_created: 100, p_organization_id: orgA, p_customer_id: customer, p_subscription_id: subscription, p_plan_code: "pro", p_status: "active", p_period_end: "2030-01-01T00:00:00Z", p_trial_end: "2030-01-01T00:00:00Z" };
    expect(requireData(await admin.rpc("apply_stripe_billing_event", args))).toBe("manual_preserved");
    expect(requireData(await admin.rpc("apply_stripe_billing_event", args))).toBe("duplicate");
    expect(requireData(await admin.from("organization_subscriptions").select("plan_code").eq("organization_id", orgA).single())?.plan_code).toBe("enterprise");
    requireData(await admin.from("organization_subscriptions").update({ provider: "stripe" }).eq("organization_id", orgA));
    expect(requireData(await admin.rpc("apply_stripe_billing_event", { ...args, p_event_id: `evt_new${marker}`, p_event_created: 200 }))).toBe("applied");
    expect(requireData(await admin.rpc("apply_stripe_billing_event", { ...args, p_event_id: `evt_old${marker}`, p_event_created: 199, p_status: "canceled" }))).toBe("stale");
    expect(requireData(await admin.from("organization_subscriptions").select("status").eq("organization_id", orgA).single())?.status).toBe("active");
  });
});