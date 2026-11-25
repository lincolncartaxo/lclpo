# Plano — Cotações corporativas e Fonte na CPU

## Objetivo
Adicionar ao LclPlan um módulo de cotações restrito à empresa, reutilizável por todos os orçamentos da organização, e exibir a origem dos preços na composição de preços unitários.

## Implementação
- Banco: criar cotações, linhas de cotação e vínculo opcional com orçamento/item, com `organization_id`, RLS por membro da empresa e funções de gravação/seleção.
- Regras: cada cotação identifica item/serviço, descrição, unidade, data, quantidade desejada de propostas, fornecedores e contatos; cálculo escolhido entre mediana, média aritmética e menor valor; resultado pode ser usado como preço de item.
- UI: substituir o placeholder da aba Cotação por gestão dentro do orçamento; adicionar acesso global no menu para cotações da empresa; criar e editar cotações, fornecedores e método de cálculo.
- Orçamento: permitir aplicar o preço calculado de uma cotação a um item do orçamento, preservando a fonte `COTAÇÃO` e a referência da cotação.
- Relatório: acrescentar a coluna Fonte nas linhas da composição analítica/CPU e exportações XLSX/PDF.

## Estrutura
- `supabase/migrations/20261125_cotacoes_empresa.sql`: tabelas, índices, constraints, RPC de organização e RLS.
- `src/routes/_authenticated/cotacoes.tsx`: painel corporativo de cotações.
- `src/routes/_authenticated/orcamento.$id.tsx`: aba Cotação funcional, aplicação ao item e Fonte na CPU.
- `src/routes/_authenticated.tsx`: navegação global para Cotações.
- `src/integrations/supabase/types.ts`: tipos das novas tabelas/RPCs.

## Design
- **Amostra de estilo**: painel operacional de engenharia, escolhido (0,78): tabelas densas, ações explícitas e estados visíveis.
- **Princípios**: rastreabilidade da origem, isolamento por empresa, edição rápida e cálculo transparente.
- **Paleta**: manter a paleta atual do LclPlan; usar âmbar para cotações pendentes e verde para cotação pronta.
- **Interação**: criar a cotação com a quantidade de propostas desejadas, preencher fornecedores em linhas repetíveis e aplicar o resultado diretamente ao orçamento.

## Critérios de aceitação
- Cotações de uma empresa não aparecem para outra empresa.
- O usuário informa quantas propostas pretende coletar e o sistema mostra o progresso.
- Cada proposta registra descrição, data, unidade, fornecedor, CNPJ, contato, nome do contato e valor.
- Média, mediana e menor valor produzem o valor calculado correto.
- Uma cotação pronta pode ser aplicada a um item de qualquer orçamento da mesma empresa.
- A CPU mostra a Fonte, inclusive quando o preço vem de cotação.
