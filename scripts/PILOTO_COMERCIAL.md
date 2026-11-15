# Verificação do piloto comercial

## Conferido nesta entrega
- 42 testes passaram: preços aprovados, permissões de cobrança, assinaturas, autenticidade de notificações, BDI/truncamento, isolamento real entre duas empresas, limite Free e preservação de planos administrativos.
- SINAPI PB maio/2026: 88316 = R$22,75 desonerado e R$24,05 não desonerado; 95378 = R$0,33 e R$0,36.
- Acesso autenticado à lista de orçamentos, editor e planos sem erros de execução no navegador.
- Exportação XLSX de orçamento existente com 10 abas, sem selecionar composições analíticas.
- Checkout e portal Stripe geraram links em modo de teste; nenhum pagamento foi efetuado.
- Contas e empresas temporárias dos testes foram removidas.

## Antes de convidar clientes pagantes
1. No Stripe em modo de teste, abrir o destino de eventos cadastrado para `https://lclpo.lovable.app/api/public/stripe-webhook` e copiar a chave de assinatura do destino para o campo seguro `STRIPE_WEBHOOK_SECRET` do projeto. Não enviar a chave pelo chat.
2. Publicar esta versão. O destino do Stripe aponta para o app publicado, não para a prévia.
3. Completar um pagamento de teste e conferir o estado da empresa, a notificação recebida e a mudança no portal. A assinatura administrativa existente é preservada intencionalmente.
4. Testar cancelamento, pagamento recusado e recuperação. Antes de produção, configurar chave, preços e destino de eventos no mesmo modo; recursos de teste não cobram dinheiro real.
5. Validar cadastro e criação da empresa sem intervenção administrativa, recuperação de conta, termos, privacidade e cópia/restauração de segurança.
6. Validar exportação completa com composições analíticas e PDF. A consulta das composições no orçamento existente permaneceu carregando durante a tentativa; essa parte não foi declarada concluída.

## Executar os testes
`bunx vitest run` executa os testes locais; a suíte de banco é explicitamente opt-in.

`RUN_DB_TESTS=true bunx vitest run src/lib/pilot.integration.test.ts` usa as variáveis de servidor já fornecidas no ambiente. Cria somente empresas e contas temporárias identificadas como testes e remove-as ao concluir. Nunca imprimir credenciais ou sessões. Não adicionar credenciais ao repositório.

## Pendências externas
- O formulário de `STRIPE_WEBHOOK_SECRET` foi recusado; a rota permanece fechada com resposta 503 sem essa chave, portanto notificações automáticas ainda não estão operacionais.
- Publicação não executada e pagamento de teste não concluído. Não anunciar cobrança automática como ativa até validar esses passos.