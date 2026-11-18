# Relatório de prontidão para release comercial

**Projeto:** LclPlan (`lincolncartaxo/lclpo`)
**Data da verificação:** 18/11/2026

## Resultado executivo

### Atualização desta rodada (18/11/2026, após 13:38 UTC)

- Entrega de e-mails confirmada por Lincoln. Identificação legal e contato de suporte informados e incorporados em `/termos`, `/privacidade` e `/suporte`. Conteúdo para piloto, sem certificação jurídica.
- Atualizações compatíveis eliminam os alertas de esbuild, minimatch, seroval, sharp, source-map-js, undici, vite e zod. `bun audit` permanece com **picomatch 4.0.7, alto**, sem versão corrigida disponível no registro consultado. Não ignorado.
- **52 testes aprovados nesta rodada: 30 locais + 22 de integração reais**, incluindo isolamento, limites e preços/quantidades históricos das medições. Executado com `RUN_DB_TESTS=true`; credenciais não foram expostas. Fixtures removidas.
- Fluxo real autenticado com orçamento descartável: desconto individual 10% em item de R$100 × 100, BDI 25% → total licitado R$11.250; BM01 20 unidades → R$2.250, saldo 80; tentativa de 81 unidades recusada sem criar boletim; BM02 10 → R$1.125, acumulado 30, saldo 70. XLSX/PDF baixados e conteúdo verificado; dados temporários removidos.
- Migrações 0013–0014 adicionam medições transacionais, autorização de orçamento, limites acumulados, preços/BDI históricos e limpeza correta na exclusão integral de orçamento. Testes locais permanentes adicionados, e teste de integração de acesso/limites das medições mantido na suíte.
- Importação exige mapeamento item, código, quantidade e fonte; descrição, unidade e preços vêm da base por padrão. Unidade da base prevalece; espera a persistência das etapas antes de anunciar sucesso.
- CSRF aplicado somente a funções internas. Páginas legais, login, painel e planos verificados no navegador sem erros de execução; suporte móvel sem transbordamento. Endpoint público `/api/public/health` disponível, sem dados privados.
- Stripe: destino de teste habilitado na URL publicada e sete eventos corretos. `checkout.session.completed` ainda aparece com `pending_webhooks=1` e entrega sem sucesso. Entrega original e correspondência da assinatura continuam bloqueio externo; reenvio manual não resolve essa prova.
- `scripts/OPERACAO_COMERCIAL.md` descreve monitoramento, exportação oficial, restauração isolada e incidentes. Usuário confirmou no painel o backup de **18/11/2026 às 09:39:02 UTC**. Ensaio de recuperação e alerta externo não comprovados; nenhum rollback de dados de produção executado.

### Bloqueios atuais antes do lançamento amplo
1. Conferir resposta da entrega Stripe; corrigir credencial pelo formulário seguro se necessário, publicar e repetir pagamento/recusa/cancelamento em teste. Produção requer chave/preços/destino do mesmo modo, sem cobrança real criada nesta rodada.
2. Realizar ensaio em ambiente separado do responsável; backup mais recente informado pelo usuário: 18/11/2026, 09:39:02 UTC. Não existe ferramenta de restauração isolada Cloud disponível ao agente.
3. Ativar monitor externo e alertas com conta/destinatário; endpoint de saúde não equivale a alertas configurados.
4. Revisão jurídica profissional das políticas, incluindo retenção/reembolso. Dados da empresa já confirmados, revisão não certificada.
5. Atualização corrigida de picomatch pelo mantenedor ou decisão explícita de risco; sem supressão do alerta.
6. Publicar as alterações desta rodada; código salvo não significa publicação.

As seções seguintes são evidências históricas anteriores a esta rodada.

A revisão no Lovable em 18/11/2026 confirmou **45 testes aprovados**, incluindo 21 testes reais de banco. A publicação foi solicitada e `/login` respondeu HTTP 200. O pagamento Stripe de teste Pro foi concluído em BRL (12900 centavos), sem dinheiro real; o plano apareceu ativo no aplicativo após reenvio manual do evento real, assinado com a chave configurada. **Entrega automática do Stripe ainda não comprovada.** O release permanece indicado para piloto controlado, não para cobrança pública ampla.

## Evidências atualizadas em 18/11/2026

- Cadastro agora cria empresa Free e associação owner na mesma transação, ignorando empresa/papel enviados em metadados. Teste real confirma que não concede admin global.
- 45/45 testes passaram com `RUN_DB_TESTS=true bunx vitest run`: 24 locais e 21 de banco. Contas e empresas descartáveis da suíte foram removidas.
- Conta temporária confirmada: login em navegador → painel → checkout → pagamento fictício → plano Pro ativo → portal → logout. Login móvel sem transbordamento horizontal. A assinatura fictícia foi cancelada e os dados temporários removidos.
- Stripe confirmou checkout `complete`, pagamento `paid`, BRL 12900, modo teste. A empresa permaneceu Free inicialmente; reenvio manual do evento `checkout.session.completed` à URL publicada retornou 200 e registrou `applied`. Repetição também retornou 200. Isso valida o processamento e idempotência, **não comprova entrega automática nem correspondência com a chave do destino Stripe**.
- Formulário de recuperação implementado na página pública de login; requisições de confirmação e recuperação do e-mail indicado pelo usuário retornaram 200. Leitura dos e-mails, confirmação e redefinição pela pessoa ainda pendentes. Não foi desativada a confirmação de e-mail.
- Auditoria básica atual não encontrou problemas; análise profunda de código não executada. O cálculo público foi restaurado para o helper recursivo com RLS, sem SQL dinâmico.
- `bun audit` encontrou DOMPurify 3.4.16 transitivo no PDF apesar de 3.4.18 direto. Override aplicado; nova auditoria não lista DOMPurify. Ainda lista esbuild, minimatch, picomatch, seroval, sharp, source-map-js, undici, vite e zod. Não aplicar atualização forçada ou declarar segurança integral.
- Logs automáticos confirmaram compilação sem erros. Não se repetiram lint ou exportações completas nesta rodada; evidências de XLSX/PDF anteriores continuam históricas.

## Próximos passos necessários

1. No Stripe, conferir entrega original do evento de teste ao destino publicado e sua resposta. A API não devolve a chave de assinatura de um destino existente; comparar/corrigir por formulário seguro se houver assinatura inválida.
2. Usuário confirmar o cadastro e definir senha pelos e-mails enviados; confirmar que os links voltam ao domínio publicado. Entrega na caixa de entrada não verificada.
3. Validar pagamento recusado, recuperação e cancelamento pelo portal com atualização automática; cancelamento de limpeza via API não substitui esse teste.
4. Resolver as dependências restantes com versões compatíveis e repetir testes; considerar análise profunda de segurança antes de ampliar o público.
5. Definir e revisar juridicamente termos, privacidade/LGPD, suporte, cancelamento/reembolso; comprovar backup/restauração, alertas e rollback. Esses requisitos não são atendidos apenas por publicar.

## Relatório original recebido (referência histórica)

As seções abaixo descrevem o ambiente da auditoria recebida. O bloqueio de credencial e os números de testes/auditoria não representam a verificação atual acima.

## Checks executados

| Check | Resultado |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | PASSOU |
| `npm test` | PASSOU: 24 testes; 20 testes de integração opt-in não executados |
| `npm run typecheck` | PASSOU |
| `npm run lint` | PASSOU sem erros ou warnings |
| `npm run build` | PASSOU |
| `git diff --check` | PASSOU |
| Importação Excel | `xlsx` direto removido; frontend e scripts usam `xlsx-js-style` |
| DOMPurify | Fixado em `3.4.18`; vulnerabilidade crítica removida |

Os comandos `test` e `typecheck` foram adicionados ao `package.json` para tornar a validação reproduzível em CI.

## Testes locais cobertos

- Cálculos financeiros de orçamento e regras de truncamento/BDI.
- Regras de assinatura, planos, permissões de cobrança e ciclo de assinatura.
- Verificação criptográfica de webhook Stripe, incluindo corpo alterado, assinatura ausente e timestamp expirado.

## Teste de integração bloqueado

A suíte `src/lib/pilot.integration.test.ts` contém 20 testes reais de isolamento multiempresa, RLS, limites Free, preços SINAPI e idempotência de billing. Ela exige `SUPABASE_SERVICE_ROLE_KEY`, que não está disponível neste ambiente. A execução com `RUN_DB_TESTS=true` confirmou o bloqueio antes de criar dados:

```text
Error: Server test connection unavailable
```

Executar no ambiente autorizado, sem imprimir credenciais:

```bash
RUN_DB_TESTS=true npm test -- src/lib/pilot.integration.test.ts
```

## Auditoria de dependências

Após remover o pacote direto `xlsx` e fixar DOMPurify, o audit de produção passou de 20 para 19 vulnerabilidades. A vulnerabilidade crítica do DOMPurify foi eliminada. Permanecem vulnerabilidades transitivas em `picomatch`, `sharp`, `source-map-js`, `undici`, `seroval` e versões de `zod` do toolchain TanStack/Cloudflare. O npm indica correção automática com `--force` ou downgrade/upgrade quebrador em parte desses casos; isso não foi aplicado sem uma matriz de compatibilidade e nova bateria de testes.

Há também um aviso de pacote deprecated durante `npm ci` (`@esbuild-kit/*`) e o projeto deve acompanhar as versões suportadas do toolchain antes de exposição ampla.

## Bloqueios externos antes de cobrar clientes

1. Publicar a versão atual no Lovable.
2. Enviar um evento Stripe de teste assinado para a URL publicada e confirmar que o webhook retorna sucesso e atualiza a empresa correta.
3. Completar checkout de teste, portal, cancelamento, pagamento recusado e recuperação.
4. Executar a suíte Supabase com `SUPABASE_SERVICE_ROLE_KEY` no ambiente seguro.
5. Validar cadastro, criação automática da empresa, recuperação de conta e logout em navegador real.
6. Confirmar termos de uso, privacidade/LGPD, contato de suporte, cancelamento/reembolso e política de backup/restauração.
7. Configurar observabilidade, alertas de erro, backup e procedimento de rollback.
8. Reavaliar as 19 vulnerabilidades transitivas e atualizar o toolchain em uma branch separada, mantendo build, testes e migrações aprovados.

## Conclusão

**Status: pronto para staging/piloto controlado; não aprovado ainda para anúncio de cobrança automática em produção.** O código local está validado, mas a aprovação comercial depende dos testes reais de Supabase/Stripe e da decisão de segurança sobre as vulnerabilidades transitivas restantes.
