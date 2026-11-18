# Relatório de prontidão para release comercial

**Projeto:** LclPlan (`lincolncartaxo/lclpo`)
**Data da verificação:** 18/11/2026

## Resultado executivo

A aplicação está tecnicamente compilável e os testes locais passam. Não é possível declarar o release plenamente comercializável ainda porque os testes de integração reais de Supabase/RLS/billing não foram executados neste ambiente e o `npm audit` ainda acusa vulnerabilidades transitivas de alto risco no toolchain.

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
