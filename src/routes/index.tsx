import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Building2, FileSpreadsheet, Calculator, Table2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Orça — Plataforma de Orçamentos de Engenharia" },
      { name: "description", content: "Crie planilhas orçamentárias completas com SINAPI e DER, BDI, encargos e cronograma físico-financeiro." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <Building2 className="size-5 text-sidebar-primary" />
            Orça
          </div>
          <Link to="/login"><Button variant="secondary" size="sm">Entrar</Button></Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">SINAPI · DER · BDI · Cronograma</span>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Orçamentos de obra, do projeto à composição final.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Plataforma completa para engenheiros: capa, encargos, BDI, composições, planilha
            orçamentária, resumo, cronograma físico-financeiro e QCI — em um único fluxo.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/login"><Button size="lg">Começar agora <ArrowRight className="ml-1 size-4" /></Button></Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            { icon: Table2, title: "Planilha Orçamentária", desc: "Itens com fonte SINAPI/DER, quantidades e preços com cálculo automático." },
            { icon: Calculator, title: "BDI & Encargos", desc: "Configure percentuais e veja impacto direto no preço de venda." },
            { icon: FileSpreadsheet, title: "Cronograma Físico-Financeiro", desc: "Distribua etapas por mês com percentuais e valores." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6">
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
