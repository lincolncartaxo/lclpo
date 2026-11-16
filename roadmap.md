# Roadmap

## Preparação para piloto comercial
- [ ] Concluir a retomada: corrigir demora e verificar exportações analíticas XLSX/PDF em orçamento real.
- [x] Implementar cobrança Stripe por empresa, histórico e autorização de gestão.
- [ ] Ativar notificações automáticas: aguarda STRIPE_WEBHOOK_SECRET (formulário recusado), publicação e pagamento de teste.
- [x] Adicionar e executar testes de cálculos com referências reais e regras de preço.
- [x] Validar isolamento entre empresas e limites com testes de acesso (contas temporárias removidas).
- [x] Verificar acesso, orçamento existente, exportação XLSX sem analíticas, checkout e portal sem cobrança real.
- [ ] Validar cadastro completo e exportações analíticas/PDF antes do piloto; requisitos e limitações em scripts/PILOTO_COMERCIAL.md.

- [x] Permitir preenchimento do cronograma diretamente em percentual (0 a 100).
- [x] Corrigir o somatório automático das etapas e subetapas pela hierarquia dos itens.
- [x] Exportar Planilha Orçamentária em JSON no formato Transferegov (aba Relatório).
- [ ] Frentes de obra / mês de conclusão por item no JSON Transferegov (hoje: frente única, mês 1).
- [x] JSON Transferegov modalidade BM (parcelas do cronograma) + verificação de pendências.
- [x] Importar planilha Excel para orçamentos criados.
- [ ] Importação enxuta: exigir apenas item, quantidade, código e fonte; descrição/unidade/preço vêm do banco.
- [ ] Avaliar últimas alterações e sugerir melhorias.
- [ ] Módulo de licitação (desconto individual ou linear) + relatórios.
- [ ] Módulo de medições (BM01, BM02...) por planilha de licitação.
