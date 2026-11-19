import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  CalendarDays,
  Check,
  Database,
  FileSpreadsheet,
  Layers,
  Table2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { pageMetadata } from "@/lib/route-metadata";
import { BILLING_PLANS } from "@/lib/billing-plans";
import { LegalLinks } from "@/components/LegalLayout";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => pageMetadata(
    "Orçamento de obra pública com SINAPI e DER",
    "Monte orçamentos para obras públicas com SINAPI e DER, BDI, encargos, cronograma físico-financeiro e QCI em um só fluxo.",
  ),
  component: Landing,
});

const pricingPlans = [
  {
    name: "Free",
    price: 0,
    capacity: "Para começar",
    bullets: ["Até 3 orçamentos", "1 usuário", "Exportações PDF e XLSX", "Sem envio ao Transferegov"],
  },
  {
    name: BILLING_PLANS.pro.name,
    price: BILLING_PLANS.pro.amount,
    capacity: "Para o profissional",
    bullets: ["Até 50 orçamentos", "Até 5 usuários", "Bases e exportações", "Integração com Transferegov"],
    featured: true,
  },
  {
    name: BILLING_PLANS.business.name,
    price: BILLING_PLANS.business.amount,
    capacity: "Para equipes",
    bullets: ["Até 500 orçamentos", "Até 25 usuários", "Exportações e Transferegov", "Recursos de auditoria"],
  },
  {
    name: BILLING_PLANS.enterprise.name,
    price: BILLING_PLANS.enterprise.amount,
    capacity: "Para operações maiores",
    bullets: ["Até 5.000 orçamentos", "Até 100 usuários", "Exportações e Transferegov", "Suporte prioritário"],
  },
];

const faqs = [
  {
    question: "O que consigo fazer no plano Free?",
    answer: "Criar até 3 orçamentos com 1 usuário e exportar em PDF ou XLSX. O envio ao Transferegov está disponível nos planos pagos.",
  },
  {
    question: "O LclPlan informa a referência de preços usada?",
    answer: "A fonte e a referência selecionadas acompanham o orçamento. Confira a UF e a data-base disponíveis no próprio orçamento antes de fechar e exportar; não presumimos que toda referência seja a mais recente.",
  },
  {
    question: "Preciso instalar algum programa?",
    answer: "Não. O LclPlan é acessado pelo navegador. Você pode criar uma conta Free e conhecer o fluxo antes de escolher outro plano.",
  },
  {
    question: "Como funciona a assinatura?",
    answer: "Os planos pagos são mensais. A assinatura e o cancelamento são gerenciados na área de planos da conta; consulte também a página de suporte e cancelamento.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#142b43] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-3.5 sm:px-8">
          <Link to="/" aria-label="LclPlan — página inicial"><Brand tone="dark" /></Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-7 text-sm text-white/75 md:flex">
            <a className="transition hover:text-white" href="#produto">Como funciona</a>
            <a className="transition hover:text-white" href="#planos">Planos</a>
            <a className="transition hover:text-white" href="#duvidas">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link className="hidden text-sm text-white/80 transition hover:text-white sm:inline" to="/login">Entrar</Link>
            <Button size="sm" className="bg-[#e7ad43] font-semibold text-[#142b43] hover:bg-[#f0bf60]" asChild>
              <Link to="/login">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#142b43] text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-36 size-[34rem] rounded-full border border-white/5" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-12 size-[25rem] rounded-full border border-white/5" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e7ad43]/35 bg-[#e7ad43]/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[#f3c66f]">
                <span className="size-1.5 rounded-full bg-[#e7ad43]" /> ORÇAMENTO DE OBRA PÚBLICA
              </div>
              <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.55rem]">
                Do SINAPI e DER ao orçamento pronto para revisar.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/72 sm:text-lg">
                Feito para engenheiros e pequenas equipes que elaboram orçamentos para obras públicas. Organize composições, encargos, BDI, cronograma físico-financeiro e QCI em um só fluxo.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="h-12 bg-[#e7ad43] px-5 font-semibold text-[#142b43] hover:bg-[#f0bf60]" asChild>
                  <Link to="/login">Criar conta grátis <ArrowRight className="ml-2 size-4" /></Link>
                </Button>
                <a href="#demo" className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/20 px-5 text-sm font-medium text-white transition hover:border-white/45 hover:bg-white/5">
                  Ver exemplo de orçamento <ArrowRight className="size-4" />
                </a>
              </div>
              <p className="mt-4 text-xs text-white/55">Free com até 3 orçamentos e 1 usuário. Sem cartão para conhecer o fluxo.</p>
            </div>

            <BudgetPreview compact />
          </div>
        </section>

        <section aria-label="Resumo do fluxo" className="border-b bg-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            <ProofPoint icon={Database} title="SINAPI e DER" detail="Referência escolhida por orçamento" />
            <ProofPoint icon={Calculator} title="BDI e encargos" detail="Percentuais no cálculo do orçamento" />
            <ProofPoint icon={CalendarDays} title="Cronograma" detail="Distribuição físico-financeira" />
            <ProofPoint icon={FileSpreadsheet} title="Documentação" detail="Planilha, resumo, QCI e exportações" />
          </div>
        </section>

        <section id="produto" className="scroll-mt-24 mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">Um fluxo, do começo ao fechamento</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Foco no orçamento público — sem perder a referência no caminho.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              O LclPlan reúne as etapas que costumam ficar espalhadas entre planilhas: fonte e data-base, composições, encargos, BDI e documentos finais. Você acompanha os valores e a estrutura antes de exportar.
            </p>
            <Button className="mt-7" asChild>
              <Link to="/login">Conhecer o LclPlan <ArrowRight className="ml-2 size-4" /></Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard icon={Layers} number="01" title="Escolha a referência" text="Defina a fonte e a referência aplicável ao orçamento e mantenha esse contexto visível no trabalho." />
            <FeatureCard icon={Table2} number="02" title="Monte as composições" text="Organize itens, quantidades e composições com cálculo de custos e encargos." />
            <FeatureCard icon={Calculator} number="03" title="Aplique o BDI" text="Configure o BDI e veja o impacto no preço de venda do orçamento." />
            <FeatureCard icon={FileSpreadsheet} number="04" title="Feche a documentação" text="Prepare planilha, resumo, cronograma físico-financeiro e QCI para revisar e exportar." />
          </div>
        </section>

        <section id="demo" className="scroll-mt-24 border-y bg-[#f3f5f7]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">Veja antes de criar sua conta</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Uma amostra do orçamento dentro do LclPlan.</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Explore a estrutura da planilha, o cálculo do BDI e a consolidação do total. Esta prévia é pública e não exige cadastro.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#e7ad43]/45 bg-[#fffaf0] p-4 text-sm leading-6 text-[#5f4a25]">
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-[#a36d12]" />
                <p><strong>Exemplo demonstrativo.</strong> Quantidades e valores são fictícios; não representam preços oficiais SINAPI/DER nem uma data-base válida para licitação.</p>
              </div>
            </div>
            <BudgetPreview />
          </div>
        </section>

        <section id="planos" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">Preços sem surpresa</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Comece grátis. Escolha o tamanho do plano quando precisar.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">Planos mensais em reais, com limites de uso descritos antes do cadastro.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {pricingPlans.map((plan) => (
              <article key={plan.name} className={`flex flex-col rounded-xl border bg-card p-5 ${"featured" in plan && plan.featured ? "border-[#d69a2c] ring-1 ring-[#d69a2c]/30 shadow-lg" : "border-border"}`}>
                <div className="flex min-h-12 items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{plan.capacity}</p>
                  </div>
                  {"featured" in plan && plan.featured && <span className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#81560d]">Profissional</span>}
                </div>
                <p className="mt-5 text-3xl font-bold tracking-tight">{formatPrice(plan.price)}<span className="ml-1 text-sm font-normal text-muted-foreground">/mês</span></p>
                <ul className="mt-5 flex-1 space-y-3 border-t pt-5 text-sm">
                  {plan.bullets.map((bullet) => <li key={bullet} className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-700" /><span>{bullet}</span></li>)}
                </ul>
                <Button variant={"featured" in plan && plan.featured ? "default" : "outline"} className="mt-6 w-full" asChild>
                  <Link to="/login">{plan.price === 0 ? "Começar no Free" : "Criar conta ou entrar"}</Link>
                </Button>
              </article>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">Assinaturas pagas são mensais. A contratação e o cancelamento são gerenciados na conta.</p>
        </section>

        <section id="duvidas" className="scroll-mt-24 border-t bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">Dúvidas frequentes</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Antes do primeiro orçamento.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Ainda tem uma pergunta? <Link to="/suporte" className="font-medium text-primary underline underline-offset-4">Fale com o suporte</Link>.</p>
            </div>
            <div className="divide-y rounded-xl border px-5">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
                    {faq.question}
                    <span className="text-muted-foreground transition group-open:rotate-180" aria-hidden="true">⌄</span>
                  </summary>
                  <p className="max-w-3xl pt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#142b43] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Brand tone="dark" />
            <p className="mt-2 max-w-md text-xs leading-5 text-white/60">Orçamentos de obras públicas com referências, cálculos e documentação em um só fluxo.</p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <LegalLinks />
            <p className="text-[11px] text-white/45">© {new Date().getFullYear()} LclPlan</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function BudgetPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/20 bg-white text-foreground shadow-[0_28px_90px_-38px_rgba(0,0,0,.65)] ${compact ? "p-4 sm:p-5" : "p-4 sm:p-6"}`}>
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-[#142b43] text-[#e7ad43]"><Table2 className="size-5" /></div>
          <div>
            <p className="text-sm font-bold">Orçamento demonstrativo</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Obra pública · exemplo visual</p>
          </div>
        </div>
        <span className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#81560d]">Prévia</span>
      </div>
      <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3">
        <PreviewMetric icon={Database} label="Fonte" value="SINAPI / DER" />
        <PreviewMetric icon={CalendarDays} label="Referência" value="Selecionada no orçamento" />
        <PreviewMetric icon={Users} label="Equipe" value="Exemplo" hideOnSmall={compact} />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-[#f3f5f7] text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Item</th>
              <th className="px-3 py-2.5 font-semibold">Descrição</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qtd.</th>
              <th className="px-3 py-2.5 text-right font-semibold">Total ilustrativo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <PreviewRow code="DEMO-001" description="Mobilização e canteiro" quantity="1 vb" total="R$ 1.800,00" />
            <PreviewRow code="DEMO-002" description="Serviços preliminares" quantity="120 m²" total="R$ 5.400,00" />
            <PreviewRow code="DEMO-003" description="Administração local" quantity="2 mês" total="R$ 4.600,00" />
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-lg bg-[#f3f5f7] p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>Subtotal <strong className="ml-1 text-foreground">R$ 11.800,00</strong></span>
          <span>BDI ilustrativo <strong className="ml-1 text-foreground">25%</strong></span>
        </div>
        <p className="text-right text-xs text-muted-foreground">Total demonstrativo<strong className="mt-1 block text-xl text-foreground">R$ 14.750,00</strong></p>
      </div>
      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Valores fictícios para mostrar a estrutura. Não usar como preço de referência.</p>
    </div>
  );
}

function PreviewMetric({ icon: Icon, label, value, hideOnSmall = false }: { icon: typeof Database; label: string; value: string; hideOnSmall?: boolean }) {
  return (
    <div className={`min-w-0 ${hideOnSmall ? "hidden sm:block" : ""}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"><Icon className="size-3.5" />{label}</p>
      <p className="mt-1 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}

function PreviewRow({ code, description, quantity, total }: { code: string; description: string; quantity: string; total: string }) {
  return <tr>
    <td className="whitespace-nowrap px-3 py-3 font-mono text-[10px] text-muted-foreground">{code}</td>
    <td className="px-3 py-3 font-medium">{description}</td>
    <td className="whitespace-nowrap px-3 py-3 text-right text-muted-foreground">{quantity}</td>
    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{total}</td>
  </tr>;
}

function ProofPoint({ icon: Icon, title, detail }: { icon: typeof Database; title: string; detail: string }) {
  return <div className="flex items-center gap-3 rounded-lg px-2 py-1">
    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#142b43] text-[#e7ad43]"><Icon className="size-5" /></div>
    <div><p className="text-sm font-bold">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div>
  </div>;
}

function FeatureCard({ icon: Icon, number, title, text }: { icon: typeof Database; number: string; title: string; text: string }) {
  return <article className="relative rounded-xl border bg-card p-5">
    <div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-5" /></div><span className="font-mono text-xs text-muted-foreground/70">{number}</span></div>
    <h3 className="mt-5 font-bold">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
  </article>;
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(amount);
}
