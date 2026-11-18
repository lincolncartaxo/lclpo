import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { pageMetadata } from "@/lib/route-metadata";

export const Route = createFileRoute("/suporte")({ head: () => pageMetadata("Suporte e Cancelamento", "Contato de suporte do LclPlan para acesso, cobrança, cancelamento e direitos de privacidade."), component: Support });
function Support() {
  return <LegalLayout title="Suporte e cancelamento">
    <section className="space-y-4"><h2 className="text-xl font-semibold">Fale com o responsável</h2><p>Informe o e-mail da conta, nome da empresa e o problema encontrado. Nunca envie senhas, dados completos de cartão ou chaves de acesso.</p><Button asChild><a href="mailto:lincolncartaxo@hotmail.com?subject=Suporte%20LclPlan"><Mail className="size-4" />lincolncartaxo@hotmail.com</a></Button><p className="text-sm text-muted-foreground">O atendimento não tem prazo garantido nesta fase de piloto.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Assinatura</h2><p>O responsável da empresa pode consultar pagamentos e solicitar cancelamento em Planos → Gerenciar assinatura. Se não conseguir acessar, envie um e-mail com o assunto “Cancelamento LclPlan”. Pedidos de reembolso podem ser enviados pelo mesmo canal, sem prejuízo dos direitos legais.</p><Button variant="outline" asChild><Link to="/planos">Minha assinatura</Link></Button></section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Privacidade e exclusão</h2><p>Use o assunto “Privacidade LclPlan” para solicitar acesso, correção ou exclusão dos seus dados. Exporte os orçamentos antes de solicitar exclusão; poderemos exigir confirmação de identidade e autorização do responsável pela empresa.</p></section>
  </LegalLayout>;
}