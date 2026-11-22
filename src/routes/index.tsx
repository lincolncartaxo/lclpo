import { Fragment, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calculator,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSpreadsheet,
  Layers,
  Layers3,
  MousePointerClick,
  FileCheck2,
  Gauge,
  Share2,
  ShieldCheck,
  Table2,
  Target,
  Users,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { LegalLinks } from "@/components/LegalLayout";
import { Button } from "@/components/ui/button";
import { BILLING_PLANS } from "@/lib/billing-plans";
import { pageMetadata } from "@/lib/route-metadata";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => pageMetadata(
    "Orçamento público: referências, memória de cálculo e licitações",
    "Use SINAPI, SICRO3, ORSE, DER, SBC e outras referências. Automatize a memória de cálculo, prepare licitações e envie ao Transferegov.",
    "/",
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
    question: "Quais referências de preços posso usar?",
    answer: "O LclPlan apresenta as bases disponíveis para a UF e a referência selecionadas, incluindo SINAPI, SICRO3, ORSE, DER, SBC, composições próprias e outras fontes disponíveis. Confira sempre a data-base indicada no orçamento.",
  },
  {
    question: "Como funciona a memória de cálculo?",
    answer: "Você informa dimensões e repetições dos itens; o LclPlan calcula automaticamente os parciais e totais da memória e relaciona o resultado às quantidades do orçamento.",
  },
  {
    question: "O envio ao Transferegov é integrado?",
    answer: "O módulo prepara e valida estruturas PLE/BM e permite o envio integrado. Para efetivar o envio, as credenciais válidas do Transferegov precisam estar configuradas.",
  },
  {
    question: "O que consigo fazer no plano Free?",
    answer: "Criar até 3 orçamentos com 1 usuário e exportar em PDF ou XLSX. O envio ao Transferegov está disponível nos planos pagos.",
  },
  {
    question: "Como funciona a assinatura?",
    answer: "Os planos pagos são mensais. A assinatura e o cancelamento são gerenciados na área de planos da conta; consulte também a página de suporte e cancelamento.",
  },
  {
    question: "O LclPlan substitui a análise do responsável técnico?",
    answer: "Não. O LclPlan organiza referências, quantitativos, BDI, memória e relatórios, mas a revisão final dos códigos, preços, encargos, regime, quantitativos e documentos deve ser feita pelo profissional responsável e pelo órgão contratante.",
  },
  {
    question: "Quais normas e referências orientam o orçamento?",
    answer: "A aplicação apoia o uso de referências como SINAPI e SICRO e pode ajudar na organização de documentos relacionados à Lei 14.133/2021 e ao Decreto 7.983. A adequação jurídica e técnica de cada orçamento deve ser validada no caso concreto.",
  },
  {
    question: "Como meus dados são tratados?",
    answer: "O acesso é separado por empresa, com permissões e compartilhamentos controlados. Consulte a Política de Privacidade para saber sobre prestadores, solicitações de acesso, correção e exclusão de dados.",
  },
  {
    question: "Posso exportar meus dados e cancelar?",
    answer: "Sim. Exporte os documentos antes de solicitar a exclusão. O responsável pela empresa pode gerenciar a assinatura na área Planos ou falar com o suporte para cancelamento e solicitações relacionadas aos dados.",
  },
];

const benefitCards = [
  {
    icon: Target,
    title: "Decida com referência clara",
    text: "Escolha a UF, a data-base e a fonte antes de montar o orçamento. A referência fica registrada para facilitar a conferência e a defesa da proposta.",
  },
  {
    icon: Gauge,
    title: "Reduza o retrabalho",
    text: "Quantidades, BDI, cronograma e relatórios partem da mesma estrutura. Ajuste uma vez e mantenha os documentos alinhados.",
  },
  {
    icon: FileCheck2,
    title: "Entregue com mais segurança",
    text: "Revise planilha, memória de cálculo, QCI, licitação e exportações em um fluxo preparado para a rotina de obras públicas.",
  },
];

type DemoView = "planilha" | "memoria" | "cronograma" | "abc";

const demoViews: Record<DemoView, { label: string; eyebrow: string; title: string }> = {
  planilha: {
    label: "Planilha",
    eyebrow: "1 · Composição do orçamento",
    title: "Itens, quantidades e preços em uma visão só",
  },
  memoria: {
    label: "Memória de cálculo",
    eyebrow: "2 · Formação do preço",
    title: "Veja de onde vem cada valor antes de fechar",
  },
  cronograma: {
    label: "Cronograma",
    eyebrow: "3 · Planejamento físico-financeiro",
    title: "Distribua o orçamento por etapa e mês",
  },
  abc: {
    label: "Curva ABC",
    eyebrow: "4 · Priorização de custos",
    title: "Identifique os itens que mais pesam na obra",
  },
};

function DemoShowcase() {
  const [view, setView] = useState<DemoView>("planilha");
  const active = demoViews[view];

  return (
    <section id="demonstracao" className="border-y bg-card/70 py-16 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <MousePointerClick className="size-4" /> Explore o fluxo
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{active.eyebrow}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{active.title}</h2>
          <p className="mt-4 max-w-lg text-muted-foreground">
            Esta é uma demonstração navegável baseada na estrutura de um orçamento genérico e exemplificativo de quadra poliesportiva. Os valores abaixo são uma amostra técnica; a referência exibida é <strong className="text-foreground">SINAPI · PB · 08/2026</strong>.
          </p>
          <div className="mt-7 flex flex-wrap gap-2" role="tablist" aria-label="Visões da demonstração">
            {(Object.keys(demoViews) as DemoView[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  view === key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"
                }`}
              >
                {demoViews[key].label}
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4 text-primary" />
            A UF e o mês são escolhidos no orçamento e ficam visíveis na base consultada.
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-background shadow-xl shadow-primary/5">
          <div className="flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground">
            <div className="flex items-center gap-2 text-sm font-medium"><Layers3 className="size-4" /> LclPlan / Orçamento demonstrativo</div>
            <span className="rounded-full bg-sidebar-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">{active.label}</span>
          </div>
          {view === "planilha" && <PlanilhaDemo />}
          {view === "memoria" && <MemoriaDemo />}
          {view === "cronograma" && <CronogramaDemo />}
          {view === "abc" && <AbcDemo />}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
            <span>Exemplo genérico · SINAPI / PB · 08/2026 · 110 itens</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> revisão antes da exportação</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanilhaDemo() {
  const rows = [
    ["1.6.1", "SINAPI", "102494", "PINTURA DE PISO COM TINTA EPÓXI, APLICAÇÃO MANUAL, 2 DEMÃOS, INCLUSO PRIMER EPÓXI. AF_05/2021", "M2", "503,4", "57,65", "16,75%", "67,30", "33.881,27"],
    ["1.4.1", "SINAPI", "87265", "REVESTIMENTO CERÂMICO PARA PAREDES INTERNAS COM PLACAS TIPO ESMALTADA. AF_02/2023_PE", "M2", "159,5", "70,02", "16,75%", "81,75", "13.039,27"],
    ["1.4.2", "SINAPI", "87529", "MASSA ÚNICA, EM ARGAMASSA TRAÇO 1:2:8, APLICADA MANUALMENTE EM PAREDES INTERNAS. AF_03/2024", "M2", "217,96", "39,78", "16,75%", "46,44", "10.121,73"],
    ["1.4.3", "SINAPI", "87548", "MASSA ÚNICA, EM ARGAMASSA TRAÇO 1:2:8, PREPARO MANUAL, APLICADA MANUALMENTE. AF_03/2024", "M2", "239,88", "31,65", "16,75%", "36,95", "8.862,94"],
    ["1.2.1", "SINAPI", "92480", "MONTAGEM E DESMONTAGEM DE FÔRMA DE VIGA, ESCORAMENTO METÁLICO. AF_09/2020", "M2", "83,88", "86,89", "16,75%", "101,44", "8.508,93"],
    ["1.2.2", "SINAPI", "103670", "LANÇAMENTO COM USO DE BALDES, ADENSAMENTO E ACABAMENTO DE CONCRETO. AF_02/2022", "M3", "17,96", "332,93", "16,75%", "388,69", "6.979,93"],
    ["1.2.3", "SINAPI", "94970", "CONCRETO FCK = 20MPA, PREPARO MECÂNICO COM BETONEIRA 600 L. AF_05/2021", "M3", "11,18", "533,05", "16,75%", "622,34", "6.960,57"],
  ] as const;
  const groups = ["1.1 - SERVIÇOS PRELIMINARES", "1.2 - QUADRA - ARQUIBANCADA", "1.4 - QUADRA - REVESTIMENTO DE PAREDES", "1.6 - QUADRA - PINTURA", "1.7 - QUADRA - EQUIPAMENTOS"];
  return (
    <div className="overflow-hidden p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5">
        <div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Planilha orçamentária</div><div className="mt-1 text-sm font-semibold">Quadra poliesportiva · 110 itens</div></div>
        <div className="text-right"><div className="text-[10px] text-muted-foreground">Identificação</div><div className="font-mono text-xs font-semibold">Orçamento genérico</div></div>
      </div>
      <div className="max-h-[31rem] overflow-auto rounded-lg border">
      <table className="min-w-[1120px] border-collapse text-[10px] leading-tight">
        <thead className="sticky top-0 z-10 bg-sidebar text-sidebar-foreground"><tr><th className="px-2 py-2 text-left">ITEM</th><th className="px-2 py-2 text-left">FONTE</th><th className="px-2 py-2 text-left">CÓDIGO</th><th className="min-w-80 px-2 py-2 text-left">DESCRIÇÃO</th><th className="px-2 py-2 text-center">UN.</th><th className="px-2 py-2 text-right">QUANT.</th><th className="px-2 py-2 text-right">PREÇO UNIT.</th><th className="px-2 py-2 text-right">BDI</th><th className="px-2 py-2 text-right">PREÇO UNIT. c/ BDI</th><th className="px-2 py-2 text-right">TOTAL</th></tr></thead>
        <tbody>
          {groups.map((group, groupIndex) => <Fragment key={group}><tr className="bg-secondary/70"><td colSpan={10} className="px-2 py-2 font-semibold">{group}</td></tr>{(groupIndex === 4 ? rows.slice(4) : [rows[groupIndex]]).map((row) => <tr key={row[0]} className="border-t bg-card"><td className="px-2 py-2 font-semibold">{row[0]}</td>{row.slice(1).map((value, index) => <td key={`${row[0]}-${index}`} className={`px-2 py-2 ${index >= 4 ? "text-right" : index === 3 ? "text-center" : "text-left"} ${index === 7 ? "font-semibold text-primary" : ""}`}>{value}</td>)}</tr>)}</Fragment>)}
          <tr className="border-t bg-secondary/70 font-semibold"><td colSpan={9} className="px-2 py-2 text-right">TOTAL c/ BDI</td><td className="px-2 py-2 text-right text-primary">R$ 200.253,40</td></tr>
        </tbody>
      </table>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Amostra técnica genérica: BDI exemplificativo de 16,75%, composição SINAPI e curva ABC disponíveis no relatório. Não representa cliente, contrato ou contratação.</p>
    </div>
  );
}

function MemoriaDemo() {
  const rows = [
    { etapa: "1.1 - SERVIÇOS PRELIMINARES", item: "1.1.1", servico: "FORNECIMENTO E INSTALAÇÃO DE PLACA DE OBRA COM CHAPA GALVANIZADA E ESTRUTURA DE MADEIRA. AF_03/2022_PS", unidade: "M2", total: "6", formulas: [{ description: "Descrição do subitem...", inputs: ["1", "2", "0", "3", "0", "0"], partial: "6", total: "6" }] },
    { etapa: "1.1 - SERVIÇOS PRELIMINARES", item: "1.1.2", servico: "LIMPEZA MANUAL DE VEGETAÇÃO EM TERRENO COM ENXADA. AF_03/2024", unidade: "M2", total: "261,288", formulas: [{ description: "40 % da Área de intervenção", inputs: ["0,4", "28,65", "0", "22,8", "0", "0"], partial: "653,22", total: "261,288" }] },
    { etapa: "1.1 - SERVIÇOS PRELIMINARES", item: "1.1.3", servico: "DEMOLIÇÃO DE ALVENARIA DE BLOCO FURADO, DE FORMA MANUAL, SEM REAPROVEITAMENTO. AF_09/2023", unidade: "M3", total: "3,96", formulas: [{ description: "Excedente na mureta do alambrado existente", inputs: ["1", "19,8", "0", "0,2", "0", "0"], partial: "3,96", total: "3,96" }] },
    { etapa: "1.2 - QUADRA - ARQUIBANCADA", item: "1.2.1", servico: "ESCAVAÇÃO MANUAL EM SOLO - PROF. ATÉ 1,50 M [ADAPTADO SINAPI 79561/001]", unidade: "M3", total: "1,25", formulas: [{ description: "Blocos (50x50)", inputs: ["10", "0,5", "0", "0,5", "0", "0,5"], partial: "0,125", total: "1,25" }] },
    { etapa: "1.2 - QUADRA - ARQUIBANCADA", item: "1.2.2", servico: "PREPARO DE FUNDO DE VALA COM LARGURA MAIOR OU IGUAL A 1,5 M E MENOR QUE 2,5 M. AF_01/2026", unidade: "M2", total: "2,5", formulas: [{ description: "Blocos (50x50)", inputs: ["10", "0,5", "0", "0,5", "0", "0"], partial: "0,25", total: "2,5" }] },
    { etapa: "1.2 - QUADRA - ARQUIBANCADA", item: "1.2.3", servico: "ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS FURADOS NA HORIZONTAL DE 19X19X29 CM. AF_08/2026", unidade: "M2", total: "43,18", formulas: [{ description: "Primeira fiada", inputs: ["1", "25,4", "0", "0,3", "0", "0"], partial: "7,62", total: "7,62" }, { description: "Segunda fiada", inputs: ["1", "25,4", "0", "0,6", "0", "0"], partial: "15,24", total: "15,24" }, { description: "Terceira fiada", inputs: ["1", "25,4", "0", "0,8", "0", "0"], partial: "20,32", total: "20,32" }] },
    { etapa: "1.2 - QUADRA - ARQUIBANCADA", item: "1.2.4", servico: "MONTAGEM E DESMONTAGEM DE FÔRMA DE LAJE MACIÇA, PÉ-DIREITO SIMPLES. AF_09/2020", unidade: "M2", total: "46,99", formulas: [{ description: "Primeiro lance", inputs: ["1", "25,4", "0", "1,1", "0", "0"], partial: "27,94", total: "27,94" }, { description: "Segundo lance", inputs: ["1", "25,4", "0", "0,75", "0", "0"], partial: "19,05", total: "19,05" }] },
    { etapa: "1.2 - QUADRA - ARQUIBANCADA", item: "1.2.8", servico: "CONCRETO FCK = 20MPA, PREPARO MECÂNICO COM BETONEIRA 600 L. AF_05/2021", unidade: "M3", total: "11,1845", formulas: [{ description: "Quantidade calculada para a estrutura", inputs: ["1", "11,1845", "0", "0", "0", "0"], partial: "11,1845", total: "11,1845" }] },
  ];
  return (
    <div className="overflow-hidden p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5">
        <div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Memória de cálculo</div><div className="mt-1 text-sm font-semibold">Quadra poliesportiva · exemplo genérico</div></div>
        <div className="text-right"><div className="text-[10px] text-muted-foreground">Estrutura de exemplo</div><div className="font-mono text-xs font-semibold">110 itens</div></div>
      </div>
      <div className="max-h-[31rem] overflow-auto rounded-lg border">
        <table className="min-w-[1040px] border-collapse text-[10px] leading-tight">
          <thead className="sticky top-0 z-10 bg-sidebar text-sidebar-foreground">
            <tr><th rowSpan={2} className="w-16 px-2 py-2 text-left">ITEM</th><th rowSpan={2} className="w-56 px-2 py-2 text-left">SERVIÇO</th><th rowSpan={2} className="w-72 px-2 py-2 text-left">DESCRIÇÃO</th><th rowSpan={2} className="px-2 py-2 text-center">VEZ</th><th colSpan={6} className="px-2 py-1.5 text-center">DADOS</th><th colSpan={3} className="px-2 py-1.5 text-center">RESULTADO</th><th rowSpan={2} className="px-2 py-2 text-center">UNID.</th></tr>
            <tr>{["X1", "X2", "Y1", "Y2", "Z1", "Z2", "PARCIAL", "TOTAL", "GERAL"].map((label) => <th key={label} className="min-w-12 border-t border-sidebar-border px-2 py-1.5 text-center">{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <Fragment key={`${row.item}-${rowIndex}`}>
                {(rowIndex === 0 || row.etapa !== rows[rowIndex - 1].etapa) && <tr className="bg-secondary/70"><td colSpan={14} className="px-2 py-2 font-semibold text-foreground">{row.etapa}</td></tr>}
                <tr className="border-t bg-card align-top"><td className="px-2 py-2 font-semibold">{row.item}</td><td colSpan={2} className="max-w-0 px-2 py-2 font-medium">{row.servico}</td><td className="px-2 py-2 text-center">1</td><td colSpan={6} className="px-2 py-2 text-center text-muted-foreground">—</td><td className="px-2 py-2 text-right text-muted-foreground">—</td><td className="px-2 py-2 text-right font-semibold text-primary">{row.total}</td><td className="px-2 py-2 text-right font-semibold text-primary">{row.total}</td><td className="px-2 py-2 text-center">{row.unidade}</td></tr>
                {row.formulas.map((formula) => <tr key={`${row.item}-${formula.description}`} className="border-t bg-background"><td></td><td></td><td className="px-2 py-1.5 pl-4 text-muted-foreground">{formula.description}</td><td className="px-2 py-1.5 text-center">1</td>{formula.inputs.map((value, inputIndex) => <td key={`${row.item}-${formula.description}-${inputIndex}`} className="px-2 py-1.5 text-center">{value}</td>)}<td className="px-2 py-1.5 text-right font-medium">{formula.partial}</td><td className="px-2 py-1.5 text-right font-medium text-primary">{formula.total}</td><td className="px-2 py-1.5 text-right font-medium text-primary">{formula.total}</td><td className="px-2 py-1.5 text-center">{row.unidade}</td></tr>)}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Prévia baseada em uma estrutura genérica de memória analítica. Os campos e números são exemplificativos e não expõem dados de cliente ou contrato.</p>
    </div>
  );
}

function CronogramaDemo() {
  return (
    <div className="overflow-x-auto p-4">
      <div className="mb-3 flex items-center justify-between rounded-lg border bg-card px-3 py-2.5"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cronograma F/F</div><div className="mt-1 text-sm font-semibold">Quadra poliesportiva · 3 meses</div></div><div className="text-right"><div className="text-[10px] text-muted-foreground">Total c/ BDI</div><div className="font-mono text-xs font-semibold">R$ 200.253,40</div></div></div>
      <table className="budget-table min-w-[700px] text-xs">
        <thead><tr><th>Etapa</th><th className="num">M1</th><th className="num">M2</th><th className="num">M3</th><th className="num">Σ</th></tr></thead>
        <tbody>
          <tr><td>1.1 - SERVIÇOS PRELIMINARES</td><td className="num">100%</td><td className="num">—</td><td className="num">—</td><td className="num text-emerald-700">100,00%</td></tr>
          <tr><td>1.2 - QUADRA - ARQUIBANCADA</td><td className="num">100%</td><td className="num">—</td><td className="num">—</td><td className="num text-emerald-700">100,00%</td></tr>
          <tr><td>1.4 - QUADRA - REVESTIMENTO</td><td className="num">—</td><td className="num">100%</td><td className="num">—</td><td className="num text-emerald-700">100,00%</td></tr>
          <tr><td>1.5 - QUADRA - PAVIMENTAÇÃO</td><td className="num">—</td><td className="num">50%</td><td className="num">50%</td><td className="num text-emerald-700">100,00%</td></tr>
          <tr><td>1.6 - QUADRA - PINTURA</td><td className="num">—</td><td className="num">—</td><td className="num">100%</td><td className="num text-emerald-700">100,00%</td></tr>
          <tr className="bg-[#dce6f1] font-semibold text-[#213f68]"><td>TOTAL PERÍODO</td><td className="num">R$ 62.255,43</td><td className="num">R$ 45.385,28</td><td className="num">R$ 92.612,69</td><td className="num">R$ 200.253,40</td></tr>
          <tr className="bg-[#dce6f1] font-semibold text-[#213f68]"><td>TOTAL ACUMULADO</td><td className="num">R$ 62.255,43</td><td className="num">R$ 107.640,71</td><td className="num">R$ 200.253,40</td><td className="num">R$ 200.253,40</td></tr>
        </tbody>
      </table>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Distribuição mensal de um cronograma genérico de 3 meses, apresentada apenas para demonstrar o formato.</p>
    </div>
  );
}

function AbcDemo() {
  const rows = [
    ["1", "SINAPI · 102494", "Pintura de piso com tinta epóxi", "503,4 m²", "R$ 33.881,27", "17,44%", "17,44%"],
    ["2", "SINAPI · 87265", "Revestimento cerâmico para paredes", "159,5 m²", "R$ 13.039,27", "6,71%", "24,15%"],
    ["3", "SINAPI · 87529", "Massa única em argamassa", "217,96 m²", "R$ 10.121,73", "5,21%", "29,37%"],
    ["4", "SINAPI · 87548", "Massa única com preparo manual", "239,88 m²", "R$ 8.862,94", "4,56%", "33,93%"],
    ["5", "SINAPI · 92480", "Fôrma de viga com escoramento metálico", "83,88 m²", "R$ 8.508,93", "4,38%", "38,31%"],
    ["6", "SINAPI · 103670", "Lançamento e acabamento de concreto", "17,96 m³", "R$ 6.979,93", "3,59%", "41,90%"],
    ["7", "SINAPI · 94970", "Concreto FCK 20MPA", "11,18 m³", "R$ 6.960,57", "3,58%", "45,48%"],
  ];
  return (
    <div className="overflow-hidden p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Curva ABC · Pareto</div><div className="mt-1 text-sm font-semibold">Itens mais representativos · total c/ BDI R$ 200.253,40</div></div><div className="text-right"><div className="text-[10px] text-muted-foreground">Faixa exibida</div><div className="font-mono text-xs font-semibold">A · B · C</div></div></div>
      <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg border-l-4 border-l-[#1d4f82] bg-[#edf4fb] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#1d4f82]">Classe A</p><p className="mt-1 text-xs text-muted-foreground">Itens de maior impacto, priorizados para revisão.</p></div><div className="rounded-lg border-l-4 border-l-[#6f9fca] bg-[#f2f7fb] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#1d4f82]">Classe B</p><p className="mt-1 text-xs text-muted-foreground">Itens intermediários na composição do custo.</p></div><div className="rounded-lg border-l-4 border-l-[#b8c9d8] bg-[#f7fafc] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#1d4f82]">Classe C</p><p className="mt-1 text-xs text-muted-foreground">Itens de menor peso individual.</p></div></div>
      <div className="mt-3 rounded-lg border bg-card p-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gráfico Pareto · peso dos 7 primeiros itens</p><svg viewBox="0 0 560 190" className="h-44 w-full" role="img" aria-label="Gráfico de barras do peso dos itens da Curva ABC e linha de peso acumulado"><line x1="32" y1="155" x2="540" y2="155" stroke="currentColor" className="text-border" /><line x1="32" y1="25" x2="32" y2="155" stroke="currentColor" className="text-border" /><text x="38" y="35" fontSize="9" className="fill-muted-foreground">20%</text><text x="38" y="94" fontSize="9" className="fill-muted-foreground">10%</text><text x="38" y="153" fontSize="9" className="fill-muted-foreground">0%</text><text x="522" y="35" fontSize="9" className="fill-muted-foreground">100%</text><text x="522" y="96" fontSize="9" className="fill-muted-foreground">50%</text>{[17.44, 6.71, 5.21, 4.56, 4.38, 3.59, 3.58].map((value, index) => <g key={value}><rect x={58 + index * 58} y={155 - value * 6.2} width="30" height={value * 6.2} rx="2" className="fill-[#6f9fca]" /><text x={68 + index * 58} y="172" fontSize="9" textAnchor="middle" className="fill-muted-foreground">{index + 1}</text></g>)}<polyline points="73,132 131,124 189,117 247,111 305,105 363,101 421,96" fill="none" stroke="#e7ad43" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="73" cy="132" r="3" fill="#e7ad43" /><circle cx="131" cy="124" r="3" fill="#e7ad43" /><circle cx="189" cy="117" r="3" fill="#e7ad43" /><circle cx="247" cy="111" r="3" fill="#e7ad43" /><circle cx="305" cy="105" r="3" fill="#e7ad43" /><circle cx="363" cy="101" r="3" fill="#e7ad43" /><circle cx="421" cy="96" r="3" fill="#e7ad43" /></svg><div className="mt-1 flex justify-end gap-4 text-[10px] text-muted-foreground"><span><i className="mr-1 inline-block size-2 rounded-sm bg-[#6f9fca]" />Peso individual</span><span><i className="mr-1 inline-block size-2 rounded-full bg-[#e7ad43]" />Peso acumulado</span></div></div>
      <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border"><table className="min-w-[760px] border-collapse text-[10px] leading-tight"><thead className="sticky top-0 z-10 bg-sidebar text-sidebar-foreground"><tr><th className="px-2 py-2 text-left">ITEM</th><th className="px-2 py-2 text-left">CÓDIGO</th><th className="px-2 py-2 text-left">DESCRIÇÃO</th><th className="px-2 py-2 text-right">QTD.</th><th className="px-2 py-2 text-right">TOTAL</th><th className="px-2 py-2 text-right">PESO %</th><th className="px-2 py-2 text-right">ACUM.</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]} className="border-t bg-card"><td className="px-2 py-2 font-semibold">{row[0]}</td><td className="px-2 py-2 font-mono">{row[1]}</td><td className="max-w-[260px] px-2 py-2">{row[2]}</td><td className="px-2 py-2 text-right">{row[3]}</td><td className="px-2 py-2 text-right font-semibold">{row[4]}</td><td className="px-2 py-2 text-right">{row[5]}</td><td className="px-2 py-2 text-right font-semibold text-primary">{row[6]}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Amostra genérica dos itens mais representativos da Curva ABC. Os percentuais demonstram como priorizar a revisão de custos.</p>
    </div>
  );
}


function Landing() {
  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#142b43] text-white">
        <div className="mx-auto flex min-w-0 max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-5 sm:px-8">
          <Link className="shrink-0" to="/" aria-label="LclPlan — página inicial"><Brand tone="dark" /></Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-7 text-sm text-white/75 md:flex">
            <a className="transition hover:text-white" href="#produto">Recursos</a>
            <a className="transition hover:text-white" href="#planos">Planos</a>
            <Link className="transition hover:text-white" to="/bases-publicas">Bases e atualização</Link>
            <a className="transition hover:text-white" href="#duvidas">Dúvidas</a>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <Link className="hidden text-sm text-white/80 transition hover:text-white sm:inline" to="/login">Entrar</Link>
            <Button size="sm" className="bg-[#e7ad43] font-semibold text-[#142b43] hover:bg-[#f0bf60]" asChild>
              <Link to="/login">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="min-w-0">
        <section className="relative overflow-hidden bg-[#142b43] text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-36 size-[34rem] rounded-full border border-white/5" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-12 size-[25rem] rounded-full border border-white/5" />
          <div className="relative mx-auto grid min-w-0 max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-20">
            <div className="min-w-0 max-w-2xl">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#e7ad43]/35 bg-[#e7ad43]/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[#f3c66f]">
                <span className="size-1.5 shrink-0 rounded-full bg-[#e7ad43]" /> ORÇAMENTO DE OBRA PÚBLICA
              </div>
              <h1 className="mt-6 text-3xl font-bold leading-[1.08] tracking-tight [overflow-wrap:anywhere] sm:text-5xl lg:text-[3.55rem]">
                Do preço de referência à licitação, sem retrabalho.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
                Use SINAPI, SICRO3, ORSE, DER, SBC, composições próprias e outras referências disponíveis. Automatize a memória de cálculo e organize BDI, cronograma, QCI, licitações e envio ao Transferegov.
              </p>
              <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Button size="lg" className="h-12 w-full bg-[#e7ad43] px-5 font-semibold text-[#142b43] hover:bg-[#f0bf60] sm:w-auto" asChild>
                  <Link to="/login">Criar conta grátis <ArrowRight className="ml-2 size-4 shrink-0" /></Link>
                </Button>
                <a href="#demonstracao" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-white/20 px-4 text-center text-sm font-medium text-white transition hover:border-white/45 hover:bg-white/5 sm:w-auto sm:px-5">
                  Ver exemplo de orçamento <ArrowRight className="size-4 shrink-0" />
                </a>
              </div>
              <p className="mt-4 text-xs text-white/60">Plano Free: até 3 orçamentos e 1 usuário.</p>
            </div>

            <BudgetPreview compact />
          </div>
        </section>

        <section aria-label="Diferenciais do LclPlan" className="border-b bg-white">
          <div className="mx-auto grid min-w-0 max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            <ProofPoint icon={Database} title="Referências de mercado" detail="SINAPI, SICRO3, ORSE, DER, SBC e outras" />
            <ProofPoint icon={Calculator} title="Memória automática" detail="Quantidades calculadas por dimensões" />
            <ProofPoint icon={Layers} title="Módulo de licitações" detail="Desconto vencedor e planilha ajustada" />
            <ProofPoint icon={FileSpreadsheet} title="Transferegov" detail="Validação e envio PLE/BM" />
            <ProofPoint icon={Share2} title="Compartilhamento" detail="Orçamentos e composições próprias entre empresas" />
          </div>
        </section>

        <section aria-labelledby="beneficios-title" className="border-b bg-[#f7f9fb]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-18">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">O resultado no dia a dia</p>
              <h2 id="beneficios-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Mais tempo para revisar. Menos tempo refazendo.</h2>
              <p className="mt-4 leading-7 text-muted-foreground">O LclPlan organiza as partes que mais geram retrabalho em uma proposta pública — sem esconder a referência usada nem transformar a planilha em uma caixa-preta.</p>
            </div>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {benefitCards.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="grid size-10 place-items-center rounded-lg bg-[#142b43] text-[#e7ad43]"><Icon className="size-5" /></div>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="quem-faz-title" className="border-b bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div className="flex items-start gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#142b43] text-[#e7ad43]"><Building2 className="size-6" /></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">Quem faz o LclPlan</p><h2 id="quem-faz-title" className="mt-2 text-3xl font-bold tracking-tight">Produto operado pela LCL Serviços de Engenharia.</h2></div></div>
            <div className="rounded-xl border bg-[#f7f9fb] p-5 text-sm leading-6 text-muted-foreground"><p className="font-semibold text-foreground">LCL SERVICOS DE ENGENHARIA LTDA - ME · CNPJ 28.536.867/0001-85</p><p>Avenida Governador Flávio Ribeiro Coutinho, nº 500, Sala 601, Jardim Oceania, João Pessoa–PB, CEP 58037-005.</p><p className="mt-2"><a className="font-medium text-primary underline underline-offset-4" href="mailto:contato@lclprojetos.com">contato@lclprojetos.com</a> · (83) 3578.3426</p><p className="mt-3 text-xs">O LclPlan é uma ferramenta de apoio. A validação final dos quantitativos, referências, BDI, encargos e documentos cabe ao responsável técnico e ao órgão contratante.</p></div>
          </div>
        </section>

        <section id="produto" className="mx-auto grid min-w-0 max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:px-8 sm:py-18 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-16">
          <div className="min-w-0 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">Do levantamento à proposta</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">O que diferencia o LclPlan.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Um fluxo de orçamento público com bases de preço variadas, cálculo automático da memória, BDI, cronograma físico-financeiro e QCI — com recursos dedicados para licitações e envio ao Transferegov.
            </p>
            <Button className="mt-7" asChild>
              <Link to="/login">Conhecer o LclPlan <ArrowRight className="ml-2 size-4" /></Link>
            </Button>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <FeatureCard icon={Database} number="01" title="Referências de mercado" text="Consulte SINAPI, SICRO3, ORSE, DER, SBC, composições próprias e outras fontes disponíveis para a UF e data-base do orçamento." />
            <FeatureCard icon={Calculator} number="02" title="Memória de cálculo automática" text="Informe dimensões e repetições; o sistema calcula parciais, totais e as quantidades vinculadas aos itens do orçamento." />
            <FeatureCard icon={FileSpreadsheet} number="03" title="Módulo Transferegov (PLE/BM)" text="Valide e prepare a estrutura para envio integrado. O envio requer credenciais válidas configuradas." />
            <FeatureCard icon={Layers} number="04" title="Módulo de Licitações" text="Aplique o desconto da proposta vencedora, recalcule os preços e gere planilha e relatórios ajustados." />
            <FeatureCard icon={Share2} number="05" title="Compartilhe com outras empresas" text="Compartilhe orçamentos para consulta ou edição e disponibilize suas composições próprias para uso. A empresa dona mantém o controle e pode revogar o acesso." />
          </div>
        </section>

        <DemoShowcase />

        <section aria-labelledby="comparativo-title" className="border-y bg-[#f7f9fb]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8">
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">Escolha com clareza</p><h2 id="comparativo-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">LclPlan, Excel ou plataforma especializada?</h2><p className="mt-4 leading-7 text-muted-foreground">Cada ferramenta serve a um momento. O LclPlan busca reduzir o trabalho manual sem prometer substituir a revisão técnica.</p></div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                { icon: Scale, title: "Excel", text: "Flexível e conhecido, mas exige controle manual de referências, fórmulas, versões, relatórios e permissões." },
                { icon: Calculator, title: "LclPlan", text: "Referências identificadas, memória, BDI, cronograma, QCI, licitação e compartilhamento em um fluxo mais simples." },
                { icon: Layers, title: "Plataformas especializadas", text: "Podem oferecer maior cobertura e maturidade, normalmente com mais custo, configuração ou complexidade operacional." },
              ].map(({ icon: Icon, title, text }) => <article key={title} className="rounded-xl border bg-white p-5"><Icon className="size-5 text-primary" /><h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></article>)}
            </div>
          </div>
        </section>

        <section aria-labelledby="prova-title" className="border-y bg-[#142b43] text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f3c66f]">Prova sem promessa vazia</p>
              <h2 id="prova-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Veja o produto antes de decidir.</h2>
              <p className="mt-4 max-w-xl leading-7 text-white/70">A demonstração usa uma estrutura técnica genérica e deixa claro o que é exemplo. No plano Free, você pode testar o fluxo com os seus próprios dados.</p>
              <Button size="lg" className="mt-7 bg-[#e7ad43] font-semibold text-[#142b43] hover:bg-[#f0bf60]" asChild>
                <Link to="/login">Testar grátis agora <ArrowRight className="ml-2 size-4" /></Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Fluxo completo", "Planilha, memória, cronograma e relatório no mesmo orçamento."],
                ["Referência visível", "Fonte, UF e mês escolhidos ficam identificados no processo."],
                ["Entrada simples", "Comece com até 3 orçamentos no plano Free e avance quando fizer sentido."],
              ].map(([title, text]) => (
                <div key={title} className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <BadgeCheck className="size-5 text-[#f3c66f]" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-8 sm:py-18">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">Preços sem surpresa</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Comece grátis. Escolha o tamanho do plano quando precisar.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">Planos mensais em reais, com limites de uso descritos antes do cadastro.</p>
          </div>
          <div className="mt-10 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {pricingPlans.map((plan) => (
              <article key={plan.name} className={`flex min-w-0 flex-col rounded-xl border bg-card p-5 ${"featured" in plan && plan.featured ? "border-[#d69a2c] ring-1 ring-[#d69a2c]/30 shadow-lg" : "border-border"}`}>
                <div className="flex min-h-12 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{plan.capacity}</p>
                  </div>
                  {"featured" in plan && plan.featured && <span className="shrink-0 rounded-full bg-[#fff3d8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#81560d]">Profissional</span>}
                </div>
                <p className="mt-5 text-3xl font-bold tracking-tight">{formatPrice(plan.price)}<span className="ml-1 text-sm font-normal text-muted-foreground">/mês</span></p>
                <ul className="mt-5 flex-1 space-y-3 border-t pt-5 text-sm">
                  {plan.bullets.map((bullet) => <li key={bullet} className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-700" /><span className="min-w-0">{bullet}</span></li>)}
                </ul>
                <Button variant={"featured" in plan && plan.featured ? "default" : "outline"} className="mt-6 w-full" asChild>
                  <a href={plan.price === 0 ? "/login" : "/login?next=%2Fplanos"}>{plan.price === 0 ? "Começar no Free" : `Assinar ${plan.name}`}</a>
                </Button>
              </article>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">Assinaturas pagas são mensais. A contratação e o cancelamento são gerenciados na conta.</p>
        </section>

        <section id="duvidas" className="scroll-mt-24 border-t bg-white">
          <div className="mx-auto grid min-w-0 max-w-7xl grid-cols-1 gap-8 px-4 py-14 sm:px-8 sm:py-18 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-10">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a36d12]">Dúvidas frequentes</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Antes do primeiro orçamento.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Ainda tem uma pergunta? <Link to="/suporte" className="font-medium text-primary underline underline-offset-4">Fale com o suporte</Link>.</p>
            </div>
            <div className="min-w-0 divide-y rounded-xl border px-4 sm:px-5">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-4">
                  <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-3 font-semibold marker:hidden">
                    <span className="min-w-0">{faq.question}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="max-w-3xl pt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#142b43] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Brand tone="dark" />
            <p className="mt-2 max-w-md text-xs leading-5 text-white/60">Referências de preço, cálculos e documentação para orçamentos de obras públicas.</p>
            <div className="mt-4 max-w-md text-xs leading-5 text-white/60">
              <p className="font-medium text-white/80">LCL SERVICOS DE ENGENHARIA LTDA - ME · CNPJ 28.536.867/0001-85</p>
              <p>Avenida Governador Flávio Ribeiro Coutinho, nº 500, Sala 601 · Jardim Oceania · João Pessoa–PB · CEP 58037-005</p>
              <p><a className="hover:text-white hover:underline" href="mailto:contato@lclprojetos.com">contato@lclprojetos.com</a> · (83) 3578.3426</p>
            </div>
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
    <div className={`w-full min-w-0 max-w-full rounded-2xl border border-white/20 bg-white text-foreground shadow-[0_28px_90px_-38px_rgba(0,0,0,.65)] ${compact ? "p-4 sm:p-5" : "p-4 sm:p-6"}`}>
      <div className="flex min-w-0 items-start justify-between gap-3 border-b pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#142b43] text-[#e7ad43]"><Table2 className="size-5" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Orçamento demonstrativo</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Obra pública · exemplo visual</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#fff3d8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#81560d]">Prévia</span>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 py-4 sm:grid-cols-3">
        <PreviewMetric icon={Database} label="Fonte" value="SINAPI · PB" />
        <PreviewMetric icon={CalendarDays} label="Data-base" value="08/2026" />
        <PreviewMetric icon={Users} label="Itens" value="110 itens" hideOnSmall={compact} />
      </div>
      <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border">
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
            <PreviewRow code="102494" description="Pintura de piso com tinta epóxi" quantity="503,4 m²" total="R$ 33.881,27" />
            <PreviewRow code="87265" description="Revestimento cerâmico de paredes" quantity="159,5 m²" total="R$ 13.039,27" />
            <PreviewRow code="87529" description="Massa única em argamassa" quantity="217,96 m²" total="R$ 10.121,73" />
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex min-w-0 flex-wrap items-end justify-between gap-4 rounded-lg bg-[#f3f5f7] p-4">
        <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>Subtotal <strong className="ml-1 text-foreground">R$ 166.382,77</strong></span>
          <span>BDI aplicado <strong className="ml-1 text-foreground">16,75%</strong></span>
        </div>
        <p className="text-right text-xs text-muted-foreground">Total c/ BDI<strong className="mt-1 block text-xl text-foreground">R$ 200.253,40</strong></p>
      </div>
      <div className="mt-3 grid gap-2 rounded-lg border bg-card p-3 text-[10px] sm:grid-cols-3"><div><span className="font-semibold text-foreground">Curva ABC A</span><span className="ml-1 text-muted-foreground">pintura epóxi · 17,44%</span></div><div><span className="font-semibold text-foreground">Curva ABC B</span><span className="ml-1 text-muted-foreground">revestimentos e estrutura</span></div><div><span className="font-semibold text-foreground">Curva ABC C</span><span className="ml-1 text-muted-foreground">equipamentos e instalações</span></div></div>
      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Amostra genérica para demonstração. A referência exibida é SINAPI/PB 08/2026; valide os dados antes de usar.</p>
    </div>
  );
}

function PreviewMetric({ icon: Icon, label, value, hideOnSmall = false }: { icon: LucideIcon; label: string; value: string; hideOnSmall?: boolean }) {
  return (
    <div className={`min-w-0 ${hideOnSmall ? "hidden sm:block" : ""}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"><Icon className="size-3.5 shrink-0" />{label}</p>
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

function ProofPoint({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1">
    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#142b43] text-[#e7ad43]"><Icon className="size-5" /></div>
    <div className="min-w-0"><p className="text-sm font-bold">{title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p></div>
  </div>;
}

function FeatureCard({ icon: Icon, number, title, text }: { icon: LucideIcon; number: string; title: string; text: string }) {
  return <article className="relative min-w-0 rounded-xl border bg-card p-5">
    <div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-5" /></div><span className="font-mono text-xs text-muted-foreground/70">{number}</span></div>
    <h3 className="mt-5 font-bold">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
  </article>;
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(amount);
}
