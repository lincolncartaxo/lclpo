# Preparar o LclPlan para um piloto comercial

## Objetivo
Concluir cobrança e validar precisão e segurança antes de convidar poucos clientes para um piloto. Preservar os planos e preços já aprovados, sem adicionar novos módulos.

## 1. Cobrança por empresa
- Vincular o cliente e a assinatura Stripe à empresa, em vez de depender do e-mail de cada usuário.
- Permitir a gestão da cobrança somente ao responsável ou administrador autorizado da empresa.
- Receber notificações automáticas do Stripe sobre pagamentos, alterações, cancelamentos e inadimplência, verificando sua autenticidade e evitando processamento duplicado.
- Preservar planos concedidos manualmente e os dados dos clientes quando uma assinatura ficar inativa.
- Manter abertura em outra aba, limite de espera, link alternativo e opção de copiar o link.
- Mostrar o estado real da assinatura; um retorno do pagamento não será tratado como confirmação sem consulta ao Stripe.

## 2. Precisão dos cálculos
- Criar testes para composição simples e recursiva, UF, mês, regime, truncamento, BDI e total.
- Conferir referências reais disponíveis, incluindo 88316 e 95378, sem assumir preços antigos como válidos para qualquer data-base.
- Corrigir divergências comprovadas dentro desse escopo, respeitando coeficientes universais e preços da referência do orçamento.

## 3. Segurança entre empresas
- Conferir as regras efetivamente instaladas, não apenas os arquivos históricos.
- Testar leitura e alteração de orçamentos, itens e cronogramas entre empresas distintas, assim como permissões de cobrança e limites dos planos.
- Corrigir falhas comprovadas sem ampliar o acesso às bases oficiais.

## 4. Verificação do piloto
- Exercitar o caminho de acesso ao app, orçamento e exportação com uma conta autorizada e conferir o resultado na tela.
- Verificar a criação do pagamento e o acesso ao portal em modo de teste, sem efetuar cobrança real.
- Registrar o que ainda depende de publicação, configuração Stripe ou participação do usuário. Não declarar lançamento pronto sem essas verificações.

## Detalhes técnicos
- Usar funções autenticadas do TanStack Start para operações internas e uma rota pública específica para notificações Stripe, com verificação da assinatura sobre o corpo original.
- Manter alterações do banco aditivas, com permissões explícitas e proteção por empresa; registrar eventos com idempotência.
- Usar testes automatizados e consultas de verificação para regras financeiras e autorização, além de conferir o fluxo na prévia.

## Limites desta entrega
Não inclui novos módulos de licitação ou medições, reformulação visual, cobrança real, publicação automática nem criação de textos jurídicos. Importação transacional, onboarding completo e restauração de backups continuam como próximos requisitos antes de expansão comercial.