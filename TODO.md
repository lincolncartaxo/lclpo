# TODO — Cotações corporativas e Fonte na CPU

- [ ] Criar cotações restritas à empresa, com identificação do item/serviço, descrição, unidade, data e quantidade de propostas desejadas.
  - Critérios: uma cotação pertence a uma organização; RLS impede acesso de outra empresa; quantidade de propostas é obrigatória e aparece como progresso.
- [ ] Cadastrar propostas e fornecedores dentro de cada cotação.
  - Critérios: registrar fornecedor, CNPJ, contato, nome do contato, data, unidade, descrição e valor; permitir editar e excluir; impedir valor negativo.
- [ ] Calcular preço cotado por média aritmética, mediana ou menor valor.
  - Critérios: método selecionável; resultado recalculado após alterações; indicar quando a quantidade mínima desejada ainda não foi atingida.
- [ ] Disponibilizar cotações em todo o sistema e permitir aplicar o valor a itens dos orçamentos da mesma empresa.
  - Critérios: menu global; aba no orçamento; aplicação grava preço, fonte COTAÇÃO e referência rastreável.
- [ ] Exibir Fonte na composição de preços unitários e nas exportações.
  - Critérios: coluna Fonte preenchida para cada insumo/composição analítica e para o item pai; manter fonte original ou COTAÇÃO.
- [ ] Atualizar tipos, testes e validações.
  - Critérios: typecheck, testes automatizados e build concluídos sem erro; revisar migration e RLS.
