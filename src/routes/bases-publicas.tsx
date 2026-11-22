import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Database, MapPin, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/Brand";
import { LegalLinks } from "@/components/LegalLayout";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/route-metadata";

export const Route = createFileRoute("/bases-publicas")({
  head: () => pageMetadata("Bases e atualização", "Veja como o LclPlan identifica fontes, UF e data-base dos preços usados nos orçamentos.", "/bases-publicas"),
  component: BasesPublicas,
});

const bases = [
  { name: "SINAPI", description: "Referência de custos de insumos e composições consultada por UF e mês.", coverage: "Cobertura varia por UF e data-base", reference: "Exemplo da demonstração: PB · 2026-05", note: "Confira a referência no orçamento antes da exportação." },
  { name: "SICRO3", description: "Referências para serviços e custos relacionados à infraestrutura de transportes.", coverage: "Disponibilidade varia por UF e mês", reference: "Consultar no aplicativo", note: "A fonte e o mês selecionados ficam registrados no orçamento." },
  { name: "ORSE", description: "Base regional disponível conforme a carga e a referência selecionadas.", coverage: "Disponibilidade varia por UF e mês", reference: "Consultar no aplicativo", note: "A cobertura apresentada pode mudar conforme novas cargas." },
  { name: "DER", description: "Referências estaduais quando disponíveis para a UF consultada.", coverage: "Disponibilidade varia por órgão e UF", reference: "Consultar no aplicativo", note: "O nome do órgão e a data-base devem ser conferidos pelo usuário." },
  { name: "SBC", description: "Fonte disponível conforme a licença, a carga e a referência configuradas no projeto.", coverage: "Disponibilidade e licenciamento variam", reference: "Consultar no aplicativo", note: "A utilização deve respeitar as condições da fonte." },
  { name: "PRÓPRIA", description: "Composições criadas pela empresa, com possibilidade de compartilhamento controlado.", coverage: "Sua empresa", reference: "Versionada no workspace", note: "Registre a origem e a justificativa da adaptação." },
];

function BasesPublicas() {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-[#142b43] text-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8"><Link to="/" aria-label="LclPlan — página inicial"><Brand tone="dark" /></Link><div className="flex items-center gap-3"><Link className="hidden text-sm text-white/80 hover:text-white sm:inline" to="/login">Entrar</Link><Button size="sm" className="bg-[#e7ad43] font-semibold text-[#142b43] hover:bg-[#f0bf60]" asChild><Link to="/login">Testar grátis</Link></Button></div></div></header>
    <main>
      <section className="bg-[#142b43] px-4 pb-16 text-white sm:px-8"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f3c66f]">Transparência da referência</p><h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Bases, UF e data-base visíveis no orçamento.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-white/75">O LclPlan não esconde a origem do preço. A disponibilidade depende da fonte, da UF e do mês carregado; por isso, cada orçamento deve ser conferido antes da exportação.</p></div></section>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8"><div className="grid gap-4 md:grid-cols-3"><div className="rounded-xl border bg-card p-5"><Database className="size-5 text-primary" /><h2 className="mt-4 font-bold">Fonte identificada</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Cada consulta informa a base utilizada e separa referências de composições próprias.</p></div><div className="rounded-xl border bg-card p-5"><MapPin className="size-5 text-primary" /><h2 className="mt-4 font-bold">UF selecionada</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">A UF faz parte da escolha da referência e deve ser validada em cada orçamento.</p></div><div className="rounded-xl border bg-card p-5"><CalendarDays className="size-5 text-primary" /><h2 className="mt-4 font-bold">Mês de referência</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">A data-base fica visível para facilitar revisão, memória e documentação.</p></div></div>
        <div className="mt-10 overflow-hidden rounded-xl border"><div className="border-b bg-secondary/60 px-5 py-4"><h2 className="text-xl font-bold">Cobertura informada</h2><p className="mt-1 text-sm text-muted-foreground">A tabela não promete cobertura nacional onde ela ainda não foi confirmada.</p></div><div className="divide-y">{bases.map((base) => <article key={base.name} className="grid gap-3 px-5 py-5 md:grid-cols-[0.7fr_1.4fr_1fr_1fr] md:items-start"><div><h3 className="font-bold">{base.name}</h3><p className="mt-1 text-xs text-muted-foreground">{base.coverage}</p></div><p className="text-sm leading-6 text-muted-foreground">{base.description}</p><div className="text-sm"><p className="font-medium">{base.reference}</p><p className="mt-1 text-xs text-muted-foreground">{base.note}</p></div><span className="inline-flex items-center gap-1 text-xs text-emerald-700"><ShieldCheck className="size-3.5" /> Fonte visível no fluxo</span></article>)}</div></div>
        <div className="mt-8 rounded-xl border border-[#e7ad43]/40 bg-[#fff8e8] p-5 text-sm leading-6 text-[#5c471e]"><p className="font-semibold">Importante sobre atualização e licenciamento</p><p className="mt-1">As datas e coberturas podem mudar conforme novas cargas e condições das fontes. Bases comerciais ou licenciadas devem ser usadas conforme suas autorizações. O profissional deve verificar código, descrição, unidade, regime, data-base e pertinência do preço ao objeto.</p></div>
        <div className="mt-8 flex flex-wrap gap-3"><Button asChild><Link to="/login">Consultar no LclPlan <ArrowRight className="ml-2 size-4" /></Link></Button><Button variant="outline" asChild><Link to="/">Voltar à página inicial</Link></Button></div>
      </section>
    </main>
    <footer className="border-t px-4 py-8 sm:px-8"><div className="mx-auto max-w-7xl space-y-3"><LegalLinks /><p className="text-center text-xs leading-5 text-muted-foreground">LCL SERVICOS DE ENGENHARIA LTDA - ME · CNPJ 28.536.867/0001-85 · contato@lclprojetos.com · (83) 3578.3426</p></div></footer>
  </div>;
}
