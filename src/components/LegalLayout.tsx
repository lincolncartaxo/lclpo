import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";

export function LegalLinks() {
  return <nav aria-label="Informações legais" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
    <Link to="/termos" className="hover:underline">Termos de uso</Link>
    <Link to="/privacidade" className="hover:underline">Privacidade</Link>
    <Link to="/bases-publicas" className="hover:underline">Bases e atualização</Link>
    <Link to="/suporte" className="hover:underline">Suporte e cancelamento</Link>
  </nav>;
}

export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b"><div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4"><Link to="/" aria-label="Página inicial LclPlan"><Brand /></Link><Button variant="outline" asChild><Link to="/login">Acessar conta</Link></Button></div></header>
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10"><h1 className="text-3xl font-semibold">{title}</h1>{children}</main>
    <footer className="border-t px-6 py-6"><div className="mx-auto max-w-3xl space-y-3"><LegalLinks /><div className="text-center text-xs leading-5 text-muted-foreground"><p className="font-medium text-foreground">LCL SERVICOS DE ENGENHARIA LTDA - ME · CNPJ 28.536.867/0001-85</p><p>Avenida Governador Flávio Ribeiro Coutinho, nº 500, Sala 601 · Jardim Oceania · João Pessoa–PB · CEP 58037-005</p><p><a className="hover:underline" href="mailto:contato@lclprojetos.com">contato@lclprojetos.com</a> · (83) 3578.3426</p></div></div></footer>
  </div>;
}
