# Verificação do piloto comercial

## Conferido nesta entrega
- 44 testes passaram em 16/11/2026: preços aprovados, permissões de cobrança, assinaturas, autenticidade de notificações, BDI/truncamento, isolamento real entre duas empresas, limite Free, preservação de planos administrativos, códigos com zeros à esquerda e cálculo da composição 87294 sem timeout.
- SINAPI PB maio/2026: 88316 = R$22,75 desonerado e R$24,05 não desonerado; 95378 = R$0,33 e R$0,36.
- Acesso autenticado à lista de orçamentos, editor e planos sem erros de execução no navegador.
- Exportação completa XLSX de orçamento existente com 10 abas, incluindo Composições, e PDF de 3,3 MB; os códigos das composições foram confirmados no texto extraído do PDF.
- Checkout e portal Stripe geraram links em modo de teste; nenhum pagamento foi efetuado.
- Contas e empresas temporárias dos testes foram removidas.

## Antes de convidar clientes pagantes
1. `STRIPE_WEBHOOK_SECRET` foi salvo pelo formulário seguro em 16/11/2026. Confirmar sua correspondência com o destino de eventos de teste em `https://lclpo.lovable.app/api/public/stripe-webhook` através de uma entrega real assinada, após publicação.
2. Publicar esta versão. O destino do Stripe aponta para o app publicado, não para a prévia.
3. Completar um pagamento de teste e conferir o estado da empresa, a notificação recebida e a mudança no portal. A assinatura administrativa existente é preservada intencionalmente.
4. Testar cancelamento, pagamento recusado e recuperação. Antes de produção, configurar chave, preços e destino de eventos no mesmo modo; recursos de teste não cobram dinheiro real.
5. Validar cadastro e criação da empresa sem intervenção administrativa, recuperação de conta, termos, privacidade e cópia/restauração de segurança.
6. Exportação completa com composições analíticas e PDF validada em 16/11/2026 no orçamento Escola 8 salas - Boa Vista. Índices normalizados e busca por código exato resolveram a interrupção por timeout, preservando o acesso por usuário e os cálculos recursivos.

## Executar os testes
`bunx vitest run` executa os testes locais; a suíte de banco é explicitamente opt-in.

`RUN_DB_TESTS=true bunx vitest run src/lib/pilot.integration.test.ts` usa as variáveis de servidor já fornecidas no ambiente. Cria somente empresas e contas temporárias identificadas como testes e remove-as ao concluir. Nunca imprimir credenciais ou sessões. Não adicionar credenciais ao repositório.

## Pendências externas
- Chave de assinatura salva; a correspondência com o destino Stripe ainda precisa de validação por evento assinado. Não declarar notificações automáticas operacionais antes desse teste.
- Publicação não executada e pagamento de teste não concluído. Não anunciar cobrança automática como ativa até validar esses passos.